"""Test the portable bundle contract without pretending Linux builds a Mach-O app."""
from pathlib import Path
import os
import socket
import subprocess
import sys
import time
import urllib.request
import tempfile
import unittest

BASE = Path(__file__).resolve().parents[1]
LAUNCH = BASE / 'scripts/mastery_portable_launch.sh'
BUILD = BASE / 'scripts/build_portable_macos.sh'
WORKFLOW = BASE / '.github/workflows/build-mac-dmg.yml'


def ports_free():
    for port in (18765, 18766):
        with socket.socket() as s:
            if s.connect_ex(('127.0.0.1', port)) == 0:
                return False
    return True


class PortablePackagingTest(unittest.TestCase):
    def test_scripts_parse(self):
        for filename in (LAUNCH, BUILD):
            subprocess.run(['bash','-n',str(filename)],check=True)

    def test_app_packaging_has_no_external_install_paths(self):
        text = LAUNCH.read_text()
        self.assertIn('"${RESOURCE_DIR}/python/bin/python3.11"', text)
        self.assertIn('"${RESOURCE_DIR}/node"', text)
        self.assertIn('"${RESOURCE_DIR}/opentutor"', text)
        self.assertNotIn('opentutor-path.txt',text)
        self.assertNotIn('node-path.txt',text)
        self.assertNotIn('npm install',text)
        self.assertNotIn('pip install',text)
        self.assertNotIn('git clone',text)
        self.assertNotIn('next dev',text)
        self.assertIn('127.0.0.1:18766',text)
        self.assertIn('127.0.0.1:18765',text)

    def test_build_requires_mac_arm_and_pins_source(self):
        text = BUILD.read_text()
        self.assertIn('Darwin',text)
        self.assertIn('arm64',text)
        self.assertIn('dbaab74ffe76d167427ddc4448e4e81dfc38b2a9',text)
        self.assertIn('Contents/Resources',text)
        self.assertIn('macos13',text)
        self.assertIn('hdiutil create',text)
        self.assertIn('uv python install 3.11',text)
        self.assertIn('npm run build',text)
        self.assertIn('--target',text)
        self.assertNotIn('cp /opt/homebrew/bin/python3.11',text)

    def test_ci_runs_bundle_smoke_before_artifact_upload(self):
        text=WORKFLOW.read_text()
        self.assertIn('runs-on: macos-15',text)
        self.assertIn('setup-uv',text)
        self.assertIn('smoke-test',text)
        self.assertIn('Upload installable DMG artifact',text)
        self.assertLess(text.index('Smoke test bundled runtime'),text.index('Upload installable DMG artifact'))
        self.assertIn('mastery_launch.sh',text)
        self.assertIn('mastery/prepare',text)
        self.assertIn('quiz/submit',text)
        self.assertIn("'DELETE'",text)

    def test_local_runtime_smoke_simulation(self):
        if not ports_free():
            self.skipTest('Ports already used')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); res=root/'Contents/Resources'; api=res/'opentutor/apps/api'
            web=res/'opentutor/apps/web'; pbin=res/'python/bin'
            for directory in [api/'mastery_ext',web/'.next',web/'node_modules/next/dist/bin',pbin]:
                directory.mkdir(parents=True,exist_ok=True)
            (web/'.next/BUILD_ID').write_text('fake')
            (web/'node_modules/next/dist/bin/next').write_text('// fake')
            (api/'main.py').write_text('# fake')
            mock=root/'mock.py'
            mock.write_text('''import http.server,sys
class H(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  isok=(sys.argv[1]=='18765' and self.path=='/api/health') or (sys.argv[1]=='18766' and self.path=='/api/mastery/health')
  self.send_response(200 if isok else 404)
  self.send_header('Content-Type','application/json')
  self.end_headers();self.wfile.write(b'{"status":"ok"}' if isok else b'{}')
 def log_message(self,*args):pass
http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),H).serve_forever()
''')
            py=pbin/'python3.11'
            py.write_text(f'''#!/bin/bash
if [[ "${{1:-}}" == '-m' && "${{2:-}}" == 'uvicorn' ]]; then exec '{sys.executable}' '{mock}' 18765; fi
exec '{sys.executable}' "$@"
''');py.chmod(0o755)
            node=res/'node'
            node.write_text(f'''#!/bin/bash
exec '{sys.executable}' '{mock}' 18766
''');node.chmod(0o755)
            process=subprocess.Popen(['bash',str(LAUNCH),str(res/'opentutor'),str(res)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            try:
                ready=False
                deadline=time.monotonic()+9
                while time.monotonic()<deadline:
                    if process.poll() is not None:break
                    try:
                        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:18766/api/mastery/health',timeout=.5) as r:
                            if b'"status":"ok"' in r.read():ready=True;break
                    except OSError:pass
                    time.sleep(.15)
                if not ready:
                    process.terminate()
                    details=process.communicate(timeout=5)[0]
                    self.fail(f'Mock API & web did not start (exit={process.returncode}): {details.decode(errors="replace")}')
                self.assertIsNone(process.poll())
            finally:
                process.terminate()
                try:process.communicate(timeout=7)
                except subprocess.TimeoutExpired:process.kill();process.communicate(timeout=3)


if __name__=='__main__': unittest.main()
