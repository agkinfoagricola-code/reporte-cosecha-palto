"""Lectura validada de los cuatro formatos acordados, sin modificar originales."""
import datetime as dt
import math
import re
from collections import defaultdict
import openpyxl

FILES = ('balanza.xlsx', 'supervisorHa.xlsx', 'tareo.xlsx', 'lecturaind.xlsx')
TABLES = ('balanza_arandano_data', 'hectareas_arandano_data', 'tareo_arandano_data', 'lecturaind_arandano_data')


def number(v):
    n = float(v or 0)
    if not math.isfinite(n) or n < 0:
        raise ValueError('Cantidad negativa o no finita')
    return n


def date(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return dt.date.fromisoformat(str(v)[:10]).isoformat()


def clock(v):
    if isinstance(v, (dt.datetime, dt.time)):
        return v.hour * 60 + v.minute + v.second / 60
    if isinstance(v, (float, int)) and 0 <= v < 1:
        return v * 1440
    m = re.fullmatch(r'(\d{1,2}):(\d{2})(?::(\d{2}))?', str(v).strip())
    if not m or int(m[1]) > 23 or int(m[2]) > 59 or int(m[3] or 0) > 59:
        raise ValueError('Hora inválida')
    return int(m[1]) * 60 + int(m[2]) + int(m[3] or 0) / 60


def location(v):
    m = re.fullmatch(r'L(\d+)\s+(R\S+)\s+(S\S+)', str(v).strip(), re.I)
    if not m:
        raise ValueError('Ubicación inválida; se espera Lxx Rxx Sxx')
    return {'lote': int(m[1]), 'red': m[2].upper(), 'sector': m[3].upper()}


def read(path, year):
    kind = path.name
    headers = {
        FILES[0]: ('FECHA COSECHA', 'LOTE', 'RED', 'VARIEDAD', 'KG. NETOS', 'DESCARTE'),
        FILES[1]: ('fecRegistro', 'Ubicacion', 'VARIEDAD', 'Hectarea', 'Total'),
        FILES[2]: ('Fecha', 'CodOperario', 'CodLabor', 'HORA_INI_LAB', 'HORA_FIN_LAB'),
        FILES[3]: ('FEC. COSECHA', 'UBICACION', 'VARIEDAD', 'CNT', 'NACEXP', 'COD_OPE', 'ETIQUETA IND', 'ETIQUETA LRS'),
    }[kind]
    date_key = headers[0]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out, seen = [], set()
    try:
        ws = wb['DATOS'] if kind == FILES[0] else wb.worksheets[0]
        rows = ws.iter_rows(values_only=True)
        names = None
        for i, row in enumerate(rows, 1):
            names = [str(v).strip() if v is not None else '' for v in row]
            if set(headers) <= set(names):
                break
            if i >= 10:
                raise ValueError('No se encontraron las columnas requeridas')
        else:
            raise ValueError('Archivo sin encabezado')
        for line, values in enumerate(rows, i + 1):
            r = dict(zip(names, values))
            if r.get(date_key) in (None, ''):
                # Los archivos exportados contienen pies sin fecha.
                if kind == FILES[2] and r.get('CodOperario') not in (None, ''):
                    raise ValueError(f'Fila {line}: trabajador sin fecha')
                continue
            try:
                fecha = date(r[date_key])
                if int(fecha[:4]) != year:
                    continue
                if kind == FILES[0]:
                    lote, red = int(r['LOTE']), str(r['RED']).strip()
                    variedad = str(r['VARIEDAD']).strip().upper()
                    if (fecha, lote, red, variedad) == ('2026-05-16', 7, 'Z', 'VENTURA'):
                        red = '1'  # Corrección confirmada por el propietario.
                    if not red.isdigit():
                        raise ValueError('Red no numérica no autorizada')
                    exp, nac = number(r['KG. NETOS']), number(r['DESCARTE'])
                    o = dict(fecha=fecha, lote=lote, red='R'+red.zfill(2), variedad=variedad,
                             kgExportable=exp, kgNacional=nac, kg=exp+nac)
                elif kind == FILES[1]:
                    o = dict(fecha=fecha, **location(r['Ubicacion']),
                             variedad=str(r['VARIEDAD']).strip().upper(), superficie=number(r['Hectarea']),
                             haAvan=number(r['Total']), cerrado=str(r.get('Cerrado')).lower() in ('si', 'sí'))
                elif kind == FILES[2]:
                    codlab = int(r['CodLabor'])
                    if codlab not in (5129, 5014, 5132, 5137):
                        continue
                    start, end = clock(r['HORA_INI_LAB']), clock(r['HORA_FIN_LAB'])
                    if end < start:
                        raise ValueError('Fin anterior al inicio; revisar el tramo')
                    o = dict(fecha=fecha, codigo=int(r['CodOperario']), codlab=codlab,
                             inicioMin=start, finMin=end, horas=(end-start)/60, horasFormato='decimal',
                             grupo=str(r.get('CodGrupo') or ''), ubicacion=str(r.get('SubLote') or ''),
                             variedad=str(r.get('VARIEDAD') or '').strip().upper())
                else:
                    destino = str(r['NACEXP']).strip().upper()
                    if destino not in ('NAC', 'EXP'):
                        raise ValueError('Destino distinto de NAC/EXP')
                    o = dict(fecha=fecha, **location(r['UBICACION']),
                             variedad=str(r['VARIEDAD']).strip().upper(), cantidad=number(r['CNT']),
                             destino=destino, codigo=str(r['COD_OPE']),
                             etiqueta=str(r['ETIQUETA IND']), etiquetaLrs=str(r['ETIQUETA LRS']),
                             grupo=str(r.get('GGEN') or ''), presentacion=str(r.get('PRESENTACION') or ''))
                # Balanza admite filas adicionales de un mismo grupo; no descartar pesos iguales.
                key = tuple(o.items())
                if kind != FILES[0] and key in seen:
                    continue
                seen.add(key)
                out.append(o)
            except (ValueError, TypeError, KeyError) as e:
                raise ValueError(f'{kind}, fila {line}: {e}') from None
    finally:
        wb.close()
    if not out:
        raise ValueError(f'{kind}: no hay datos válidos para {year}')
    if kind == FILES[0]:
        groups = {}
        for r in out:
            k = tuple(r[c] for c in ('fecha','lote','red','variedad'))
            if k not in groups:
                groups[k] = dict(r)
            else:
                for c in ('kg','kgExportable','kgNacional'):
                    groups[k][c] += r[c]
        out = list(groups.values())
    return out


def merge(table, existing, incoming):
    """Sustituir claves de balanza/Ha; días completos de tareo/lecturas."""
    if table in TABLES[2:]:
        dates = {r['fecha'] for r in incoming}
        return [r for r in existing if r['fecha'] not in dates] + incoming
    fields = ('fecha','lote','red','variedad') + (('sector',) if table == TABLES[1] else ())
    def key(r):
        return tuple(str(r.get(f, '')).strip().upper() for f in fields)
    combined = {key(r): dict(r) for r in existing}
    for r in incoming:
        combined[key(r)] = {**combined.get(key(r), {}), **r}
    return list(combined.values())


def apply_jabas(balanza, lecturas):
    counts = defaultdict(float)
    dates = {r['fecha'] for r in lecturas}
    for r in lecturas:
        counts[(r['fecha'],str(r['lote']),r['red'],r['variedad'])] += r['cantidad']
    return [{**r, 'envases': counts[(r['fecha'],str(r['lote']),r['red'],r['variedad'])]}
            if r['fecha'] in dates else r for r in balanza]
