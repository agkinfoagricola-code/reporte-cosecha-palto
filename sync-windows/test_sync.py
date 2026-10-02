import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import openpyxl
import parsers
import sync

class ParsersTest(unittest.TestCase):
    def workbook(self, name, headers, rows):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        path = Path(folder.name)/name
        wb = openpyxl.Workbook()
        if name == 'balanza.xlsx':
            wb.active.title = 'DATOS'
        wb.active.append(headers)
        for r in rows:
            wb.active.append(r)
        wb.save(path)
        return path

    def test_hours_are_segments(self):
        path = self.workbook('tareo.xlsx', ['Fecha','CodOperario','CodLabor','HORA_INI_LAB','HORA_FIN_LAB','totHoras'],
          [[dt.datetime(2026,9,28),1,5129,'06:30','09:20',32],
           [dt.datetime(2026,9,28),1,5129,'09:20','12:00',32],
           [dt.datetime(2026,9,28),1,5129,'09:20','12:00',32],
           [dt.datetime(2026,9,28),2,5137,'07:30','09:30',9]])
        rows = parsers.read(path,2026)
        self.assertEqual(len(rows),3)
        self.assertAlmostEqual(rows[0]['horas'],2+50/60)
        self.assertAlmostEqual(rows[1]['horas'],2+40/60)
        self.assertEqual(rows[2]['horas'],2)
        self.assertEqual(rows[2]['codlab'],5137)

    def test_invalid_hours_reject_file(self):
        path = self.workbook('tareo.xlsx',['Fecha','CodOperario','CodLabor','HORA_INI_LAB','HORA_FIN_LAB'],
                             [[dt.datetime(2026,9,28),1,5129,'12:00','09:30']])
        with self.assertRaisesRegex(ValueError,'Fin anterior'):
            parsers.read(path,2026)

    def test_balanza_confirmed_rule_and_year(self):
        path = self.workbook('balanza.xlsx',['FECHA COSECHA','LOTE','RED','VARIEDAD','KG. NETOS','DESCARTE'],
          [[dt.datetime(2026,5,16),7,'Z','VENTURA',1112.37,9.57],
           [dt.datetime(2025,5,16),7,'1','VENTURA',999,9]])
        r = parsers.read(path,2026)
        self.assertEqual(len(r),1)
        self.assertEqual(r[0]['red'],'R01')
        self.assertAlmostEqual(r[0]['kg'],1121.94)

    def test_history_and_idempotence(self):
        old = [{'fecha':'2026-09-01','codigo':1},{'fecha':'2026-09-28','codigo':2}]
        incoming = [{'fecha':'2026-09-28','codigo':3}]
        result = parsers.merge(parsers.TABLES[2],old,incoming)
        self.assertEqual(result,[old[0],incoming[0]])
        self.assertEqual(result,parsers.merge(parsers.TABLES[2],result,incoming))

    def test_area_preserved_as_area_not_sum(self):
        old = [{'fecha':'2026-09-01','lote':7,'red':'R01','sector':'S01','variedad':'VENTURA','superficie':2}]
        incoming = [{**old[0],'superficie':3,'haAvan':1}]
        result = parsers.merge(parsers.TABLES[1],old,incoming)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['superficie'],3)

    def test_jabas_dont_invent_weight_or_erase_other_dates(self):
        base = {'fecha':'2026-09-28','lote':7,'red':'R01','variedad':'VENTURA','kg':50,'envases':3}
        readings = [{**base,'cantidad':5}]
        result = parsers.apply_jabas([base,{**base,'fecha':'2026-09-20'}],readings)
        self.assertEqual(result[0]['kg'],50)
        self.assertEqual(result[0]['envases'],5)
        self.assertEqual(result[1]['envases'],3)

class TransportTest(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        for f in parsers.FILES:
            (self.root/f).write_text('test')
        self.hashes = {f:sync.fingerprint(self.root/f) for f in parsers.FILES}
        self.parsed = {t:[{'fecha':'2026-09-28','lote':7,'red':'R01','variedad':'VENTURA','cantidad':1}] for t in parsers.TABLES}
        self.snapshot = {t:{'data':[],'version':'remote'} for t in parsers.TABLES}
        self.config = {'folder':str(self.root),'year':2026}

    def test_manual_change_blocks_all_writes(self):
        from unittest.mock import Mock
        api = Mock(); api.request.return_value = self.snapshot
        state = {'files':{},'versions':{parsers.TABLES[0]:'older'}}
        with patch.object(sync,'collect',return_value=(self.hashes,self.parsed)):
            with self.assertRaisesRegex(ValueError,'cambios manuales'):
                sync.run_once(api,self.config,state)
        self.assertEqual(api.request.call_count,1)

    def test_error_does_not_mark_files_synced(self):
        from unittest.mock import Mock
        api = Mock();api.request.side_effect = [self.snapshot,RuntimeError('network')]
        with patch.object(sync,'BASE',self.root), patch.object(sync,'collect',return_value=(self.hashes,self.parsed)):
            with self.assertRaises(RuntimeError):
                sync.run_once(api,self.config,{})
        self.assertFalse((self.root/'state.json').exists())
        self.assertEqual(len(list((self.root/'backups').glob('*.gz'))),1)

    def test_success_is_saved_and_unchanged_files_not_uploaded(self):
        from unittest.mock import Mock
        versions = {t:'new' for t in parsers.TABLES}
        api = Mock();api.request.side_effect = [self.snapshot,{'received':0},versions]
        with patch.object(sync,'BASE',self.root), patch.object(sync,'collect',return_value=(self.hashes,self.parsed)):
            result = sync.run_once(api,self.config,{})
            self.assertEqual(result['versions'],versions)
            self.assertEqual(json.loads((self.root/'state.json').read_text())['files'],self.hashes)
            sync.run_once(api,self.config,result)
        self.assertEqual(api.request.call_count,3)

if __name__ == '__main__':
    unittest.main()

class DiagnosticTest(unittest.TestCase):
    def test_recursion_identified_without_exposing_response(self):
        import io
        import urllib.error
        api = sync.API({'supabase_url':'https://example.com','public_key':'public'})
        api.token='private-token';api.expires=10**15
        error=urllib.error.HTTPError('https://example.com',500,'error',{},io.BytesIO(
            b'{"code":"42P17","message":"private contents","details":"secret"}'))
        with patch('urllib.request.urlopen',side_effect=error):
            with self.assertRaisesRegex(RuntimeError,'lectura inicial.*42P17') as got:
                api.request('/rest/v1/rpc/sync_produccion_snapshot',{})
        self.assertNotIn('private',str(got.exception))
        self.assertNotIn('secret',str(got.exception))

    def test_auth_stage_is_reported(self):
        import io
        import urllib.error
        api=sync.API({'supabase_url':'https://example.com','public_key':'public'})
        error=urllib.error.HTTPError('https://example.com',500,'error',{},io.BytesIO(b'{"error_code":"unexpected_failure"}'))
        with patch('urllib.request.urlopen',side_effect=error):
            with self.assertRaisesRegex(RuntimeError,'inicio de sesión.*unexpected_failure'):
                api.request('/auth/v1/token?grant_type=password',{},False)

class ChunkTest(unittest.TestCase):
    def test_lost_confirmation_resumes_without_reuploading(self):
        from unittest.mock import Mock
        import gzip,hashlib
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            payload=json.dumps({'table':'á'*100})
            with gzip.open(root/'pending-payload.json.gz','wt',encoding='utf-8') as f: f.write(payload)
            sync.save_json(root/'pending.json',{'id':'job','hash':hashlib.md5(payload.encode()).hexdigest(),
                'next_part':0,'files':{'test':'hash'},'previous_versions':{},'changed':['test']})
            count=(len(payload)+49)//50
            api=Mock();api.request.side_effect=[{'received':i} for i in range(count)]+[RuntimeError('HTTP 520')]
            with patch.object(sync,'BASE',root),patch.object(sync,'CHUNK_CHARS',50):
                with self.assertRaises(RuntimeError): sync.send_pending(api)
                self.assertFalse((root/'state.json').exists())
                self.assertEqual(json.loads((root/'pending.json').read_text())['next_part'],count)
                api=Mock();api.request.return_value={'table':'server-hash'}
                result=sync.send_pending(api)
                self.assertEqual(api.request.call_count,1)
                self.assertEqual(api.request.call_args.args[0],'/rest/v1/rpc/sync_produccion_commit')
                self.assertEqual(result['versions'],{'table':'server-hash'})
                self.assertFalse((root/'pending.json').exists())

    def test_staging_is_bounded_and_preserves_all_content(self):
        from unittest.mock import Mock
        import gzip,hashlib
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); payload=json.dumps({'datos':['áéí雪'*100]*4},ensure_ascii=False)
            with gzip.open(root/'pending-payload.json.gz','wt',encoding='utf-8') as f: f.write(payload)
            sync.save_json(root/'pending.json',{'id':'job','hash':hashlib.md5(payload.encode()).hexdigest(),
                'next_part':0,'files':{},'previous_versions':{},'changed':['test']})
            captured=[]
            def request(path,body):
                if 'stage' in path:
                    captured.append(body['p_text']);return {'received':body['p_index']}
                return {'table':'ok'}
            api=Mock();api.request.side_effect=request
            with patch.object(sync,'BASE',root),patch.object(sync,'CHUNK_CHARS',50):
                sync.send_pending(api)
            self.assertTrue(all(len(c)<=50 for c in captured))
            self.assertEqual(''.join(captured),payload)
