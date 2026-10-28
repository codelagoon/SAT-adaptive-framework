"""Runtime smoke tests with actual child processes and an HTTP readiness proxy.

We cannot compile macOS Cocoa on Linux, but can run the exact bash launcher
against test doubles for the production API and Next.js services.
"""
from pathlib import Path
import os
import signal
import socket
import subprocess
import sys
import time

import pytest

BASE=Path(__file__).resolve().parents[1]
LAUNCH=BASE/'scripts/mastery_launch.sh'


def free_ports():
    for port in (18765,18766):
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port)) == 0:
                return False
    return True


@pytest.fixture
def simulated_install(tmp_path):
    root=tmp_path/'opentutor'; resources=tmp_path/'resources'
    api=root/'apps/api'; web=root/'apps/web'
    (api/'.venv/bin').mkdir(parents=True)
    (web/'.next').mkdir(parents=True)
    (web/'node_modules/.bin').mkdir(parents=True)
    resources.mkdir()
    (resources/'node-path.txt').write_text(sys.executable+'\n')
    (web/'.next/BUILD_ID').write_text('test')
    mock_server=tmp_path/'server.py'
    mock_server.write_text('''
import http.server,os,sys
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        p=int(sys.argv[1]); route=self.path
        if p==18765 and route=="/api/health": status=200;body=b'{"status":"ok"}'
        elif p==18766 and route=="/api/mastery/health":
            status=200;body=b'{"status":"ok","user_id":"test"}'
        else: status=404;body=b'not found'
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(body)
    def log_message(self,*args):pass
http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),Handler).serve_forever()
''')
    py=api/'.venv/bin/python'
    py.write_text(f'''#!/bin/bash
if [[ "${{1:-}}" == '-m' && "${{2:-}}" == 'uvicorn' ]];then
  exec '{sys.executable}' '{mock_server}' 18765
else
  exec '{sys.executable}' "$@"
fi
''')
    py.chmod(0o755)
    nx=web/'node_modules/.bin/next'
    nx.write_text(f'''#!/bin/bash
exec '{sys.executable}' '{mock_server}' 18766
''')
    nx.chmod(0o755)
    return root,resources


def shutdown(proc):
    if proc.poll() is None:
        proc.terminate()
    try:out,err=proc.communicate(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill();out,err=proc.communicate(timeout=5)
    return ((out or b'')+(err or b'')).decode(errors='replace')


def test_real_launcher_starts_both_endpoints_and_exits_on_terminate(simulated_install):
    if not free_ports():pytest.skip('runtime ports already used')
    root,resources=simulated_install
    process=subprocess.Popen(['bash',str(LAUNCH),str(root),str(resources)],
                             stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    try:
        deadline=time.monotonic()+12
        while time.monotonic()<deadline:
            if process.poll() is not None:break
            try:
                import urllib.request
                with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:18766/api/mastery/health',timeout=.5) as res:
                    if b'"status":"ok"' in res.read():break
            except OSError:pass
            time.sleep(.1)
        if process.poll() is not None:
            details=process.communicate(timeout=5)[0]
            pytest.fail(f'launcher exited before health: {details.decode(errors="replace")}')
        # Let the launcher's own readiness loop finish before terminating it.
        time.sleep(2.5)
        assert process.poll() is None, 'launcher exited unexpectedly'
        import urllib.request
        for url in ('http://127.0.0.1:18765/api/health','http://127.0.0.1:18766/api/mastery/health'):
            with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(url,timeout=2) as response:
                assert b'"status":"ok"' in response.read()
    finally:
        output=shutdown(process)
    assert 'Mastery Engine: local API and production frontend are healthy' in output
    time.sleep(.3)
    assert free_ports(),f'child servers leaked after shutdown: {output}'


def test_port_collision_fails_without_using_unrelated_api(simulated_install):
    if not free_ports():pytest.skip('runtime ports already used')
    root,resources=simulated_install
    with socket.socket() as listener:
        listener.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        listener.bind(('127.0.0.1',18765));listener.listen(1)
        result=subprocess.run(['bash',str(LAUNCH),str(root),str(resources)],
                              capture_output=True,timeout=10,text=True)
    assert result.returncode!=0
    assert 'port 18765 is in use' in result.stderr


def test_env_file_metacharacters_are_never_shell_executed(simulated_install,tmp_path):
    if not free_ports():pytest.skip('runtime ports already used')
    root,resources=simulated_install
    canary=tmp_path/'DO_NOT_CREATE'
    (root/'.env').write_text(f'MALICIOUS=$(touch "{canary}")\nAUTH_ENABLED=true\n')
    process=subprocess.Popen(['bash',str(LAUNCH),str(root),str(resources)],
                             stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    try:
        deadline=time.monotonic()+12
        while time.monotonic()<deadline:
            if process.poll() is not None: break
            with socket.socket() as sock:
                if sock.connect_ex(('127.0.0.1',18766))==0:break
            time.sleep(.2)
    finally:output=shutdown(process)
    assert not canary.exists(),output
    assert 'source "${ROOT}/.env"' not in LAUNCH.read_text()


def test_swift_waits_for_real_extension_health_not_any_html_200():
    source=(BASE/'macos/MasteryApp.swift').read_text()
    assert '18766/api/mastery/health' in source
    assert '(json["status"] as? String) == "ok"' in source
    assert '18766/mastery' in source
    assert 'mastery_launch.sh' in source
