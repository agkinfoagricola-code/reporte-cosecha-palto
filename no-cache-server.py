"""
Servidor local para desarrollo que NUNCA cachea archivos — reemplazo directo de
`python -m http.server`. Úsalo igual, solo que corriendo este script en vez del módulo:

    python no-cache-server.py 5500

Así el navegador siempre pide la última versión de cada archivo (js, html, css),
sin necesidad de Incógnito, Ctrl+Shift+R, ni borrar caché manualmente.
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    server = HTTPServer(('', port), NoCacheHandler)
    print(f'Sirviendo SIN caché en http://localhost:{port}  (Ctrl+C para detener)')
    server.serve_forever()
