"""Sincronizador local: credenciales solo en memoria; HTTPS verificado."""
import argparse
import getpass
import gzip
import hashlib
import json
import logging
import os
from pathlib import Path
import sys
import time
import urllib.request
import urllib.error
from parsers import FILES, TABLES, read, merge, apply_jabas

BASE = Path(__file__).resolve().parent


def save_json(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    tmp.replace(path)


def fingerprint(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


class API:
    def __init__(self, config):
        self.url = config['supabase_url'].rstrip('/')
        if not self.url.startswith('https://'):
            raise ValueError('Supabase requiere HTTPS')
        self.key = config['public_key']
        self.token = None
        self.refresh = None
        self.expires = 0

    def request(self, path, body, authenticated=True):
        if authenticated and time.time() >= self.expires - 90:
            self.session(self.request('/auth/v1/token?grant_type=refresh_token', {'refresh_token':self.refresh}, False))
        headers = {'apikey':self.key, 'Content-Type':'application/json'}
        if authenticated:
            headers['Authorization'] = 'Bearer ' + self.token
        req = urllib.request.Request(self.url + path, json.dumps(body).encode(), headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            # No registrar respuestas de autenticación, cuerpos, JWT ni datos personales.
            if e.code in (401,403):
                raise RuntimeError('Acceso rechazado: revise usuario, contraseña y rol admin.') from None
            if e.code == 409:
                raise RuntimeError('Conflicto con una carga reciente. No se guardó este lote.') from None
            raise RuntimeError(f'HTTP {e.code}: compruebe conexión y que ejecutó supabase_sync.sql.') from None

    def session(self, value):
        self.token = value['access_token']
        self.refresh = value['refresh_token']
        self.expires = time.time() + value['expires_in']

    def login(self):
        user = input('Usuario de la web (o correo): ').strip()
        if '@' not in user:
            user += '@agrokasa.com.pe'
        self.session(self.request('/auth/v1/token?grant_type=password',
                                  {'email':user, 'password':getpass.getpass('Contraseña (no se guarda): ')}, False))
        self.request('/rest/v1/rpc/sync_produccion_snapshot', {})


def collect(folder, year):
    paths = [folder / f for f in FILES]
    missing = [p.name for p in paths if not p.is_file()]
    if missing:
        raise ValueError('Faltan archivos: ' + ', '.join(missing))
    before = {p.name:(p.stat().st_size,p.stat().st_mtime_ns) for p in paths}
    if any(time.time()-p.stat().st_mtime < 5 for p in paths):
        raise ValueError('Hay un Excel recién guardado; esperando a que termine la escritura.')
    hashes = {p.name:fingerprint(p) for p in paths}
    parsed = {t:read(p, year) for p,t in zip(paths,TABLES)}
    for p in paths:
        if before[p.name] != (p.stat().st_size,p.stat().st_mtime_ns) or hashes[p.name] != fingerprint(p):
            raise ValueError('Un archivo cambió durante la lectura; se reintentará sin subir este lote.')
    return hashes, parsed


def prepare(snapshot, parsed, changed):
    desired = {t:merge(t,snapshot[t]['data'],parsed[t]) if f in changed else snapshot[t]['data']
               for f,t in zip(FILES,TABLES)}
    touched = {t for f,t in zip(FILES,TABLES) if f in changed}
    if FILES[0] in changed or FILES[3] in changed:
        desired[TABLES[0]] = apply_jabas(desired[TABLES[0]],desired[TABLES[3]])
        touched.add(TABLES[0])
    return {t:{'version':snapshot[t]['version'],'data':desired[t]} for t in touched}


def run_once(api, config, state, reconcile=False):
    folder = Path(config['folder'])
    current = {f:fingerprint(folder/f) for f in FILES if (folder/f).is_file()}
    if current == state.get('files'):
        return state
    hashes, parsed = collect(folder, config['year'])
    changed = {f for f in FILES if hashes[f] != state.get('files',{}).get(f)}
    snapshot = api.request('/rest/v1/rpc/sync_produccion_snapshot', {})
    changes = prepare(snapshot,parsed,changed)
    for t in changes:
        previous = state.get('versions',{}).get(t)
        if previous and previous != snapshot[t]['version'] and not reconcile:
            raise ValueError('La web tiene cambios manuales en '+t+'. No se sobrescriben. Revise y use RECONCILIAR.cmd si el Excel es la versión correcta.')
    # Backup local antes de cada lote: contiene datos personales; no subir a GitHub.
    backup = BASE/'backups'
    backup.mkdir(exist_ok=True)
    with gzip.open(backup/(time.strftime('%Y%m%d-%H%M%S')+f'-{time.time_ns()}.json.gz'),'wt',encoding='utf-8') as stream:
        json.dump({t:snapshot[t] for t in changes},stream)
    versions = api.request('/rest/v1/rpc/sync_produccion_apply', {'changes':changes})
    new_state = {'files':hashes, 'versions':{**state.get('versions',{}),**versions},
                 'last_success':time.strftime('%Y-%m-%d %H:%M:%S')}
    save_json(BASE/'state.json',new_state)
    logging.info('Actualizado: %s. Recargue la web para ver los datos.', ', '.join(sorted(changed)))
    return new_state


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--validate',action='store_true',help='Solo lectura local, no requiere cuenta')
    parser.add_argument('--once',action='store_true')
    parser.add_argument('--reconcile',action='store_true')
    args = parser.parse_args()
    config = json.loads((BASE/'config.json').read_text(encoding='utf-8-sig'))
    if args.validate:
        _, parsed = collect(Path(config['folder']), config['year'])
        for name,table in zip(FILES,TABLES):
            rows = parsed[table]
            print(f'{name}: {len(rows)} registros; {min(r["fecha"] for r in rows)} a {max(r["fecha"] for r in rows)}')
        print('Validación terminada. No se enviaron datos.')
        return
    # Evitar dos sincronizadores locales escribiendo a la vez.
    lock = (BASE/'sync.lock').open('a+b')
    lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
    if os.name == 'nt':
        import msvcrt
        msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
    else:
        import fcntl
        fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
    logging.basicConfig(level=logging.INFO,format='%(asctime)s %(message)s',
                        handlers=[logging.FileHandler(BASE/'sync.log',encoding='utf-8'),logging.StreamHandler()])
    state_path = BASE/'state.json'
    state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
    if not state or args.reconcile:
        print('Se conservarán fechas históricas. En los días incluidos, tareo y lecturas deben estar completos.')
        print('Balanza y hectáreas reemplazan solo claves presentes. Los datos de Palto no cambian.')
        if input('¿Estos Excel son la versión correcta que desea cargar? Escriba SI: ').strip().upper() != 'SI':
            return
    api = API(config)
    api.login()
    logging.info('Conectado. Carpeta: %s. Ctrl+C para detener.', config['folder'])
    while True:
        try:
            state = run_once(api,config,state,args.reconcile)
            args.reconcile = False
        except Exception as e:
            logging.error('%s',e)
            if args.once:
                raise SystemExit(1)
        if args.once:
            break
        time.sleep(max(10,config['interval_seconds']))
    lock.close()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nSincronizador detenido.')
    except Exception as e:
        print('No se pudo continuar:',e)
        sys.exit(1)
