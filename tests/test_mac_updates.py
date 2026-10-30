"""Real filesystem/package tests for explicit local Mac updates."""
import importlib.util
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('tenet_installer', Path(__file__).resolve().parents[1] / 'scripts/install_tenet_update.py')
installer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = installer
spec.loader.exec_module(installer)

import json
import os
import plistlib
import shutil
import sqlite3
import subprocess
import pytest

pytestmark = pytest.mark.skipif(sys.platform != 'darwin', reason='Real macOS package tools required')


@pytest.fixture(scope='session', autouse=True)
def arm64_fixture_binary(tmp_path_factory):
    global NATIVE_BINARY
    NATIVE_BINARY = tmp_path_factory.mktemp('tenet-native-fixture') / 'runtime'
    subprocess.run(['xcrun', 'clang', '-target', 'arm64-apple-macos13', '-x', 'c', '-', '-o', str(NATIVE_BINARY)],
                   input='int main(void) { return 0; }', text=True, capture_output=True, check=True)


def make_app(path, epoch, bundle_id=installer.BUNDLE_ID):
    contents = path / 'Contents'
    resources = contents / 'Resources'
    (contents / 'MacOS').mkdir(parents=True)
    shutil.copyfile(NATIVE_BINARY, contents / 'MacOS/MasteryEngine2')
    (contents / 'MacOS/MasteryEngine2').chmod(0o755)
    info = {'CFBundleIdentifier': bundle_id, 'CFBundleExecutable': 'MasteryEngine2',
            'CFBundleName': 'Tenet', 'CFBundlePackageType': 'APPL', 'CFBundleVersion': str(epoch)}
    (contents / 'Info.plist').write_bytes(plistlib.dumps(info))
    for relative in ['node', 'python/bin/python3.11', 'mastery_launch.sh',
                     'opentutor/apps/web/.next/BUILD_ID', 'opentutor/apps/api/mastery_ext/router.py']:
        f = resources / relative
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text('Disposable package fixture')
        f.chmod(0o755 if relative in ['node', 'python/bin/python3.11'] else 0o644)
    (resources / 'tenet-build.json').write_text(json.dumps({'source_commit': f'{epoch:040x}', 'build_epoch': epoch}))
    subprocess.run(['/usr/bin/codesign', '--force', '--deep', '--sign', '-', str(path)], check=True, capture_output=True)
    return path


@pytest.fixture
def setup(tmp_path):
    target = make_app(tmp_path / 'Installed Apps/Tenet.app', 100)
    source = make_app(tmp_path / "Downloaded $(touch PWNED) ' update.app", 200)
    data = tmp_path / 'Study data'
    data.mkdir()
    for name in ['opentutor.sqlite3', 'mastery.sqlite3']:
        with sqlite3.connect(data / name) as db:
            db.execute('CREATE TABLE saved (id INTEGER PRIMARY KEY, note TEXT)')
            db.execute('INSERT INTO saved VALUES (1, ?)', ('Preserve my answer',))
    (data / 'uploads').mkdir()
    (data / 'uploads/worksheet.txt').write_text('Keep this worksheet')
    return source, target, data, tmp_path / 'Update history'


def test_update_preserves_progress_and_previous_app(setup):
    source, target, data, state = setup
    result = installer.install(source, target, data, state, launch=False)
    assert installer.validate(target)['build_epoch'] == 200
    assert installer.validate(Path(result['previous_app']))['build_epoch'] == 100
    for name in ['opentutor.sqlite3', 'mastery.sqlite3']:
        for dbfile in [data / name, Path(result['study_backup']) / name]:
            with sqlite3.connect(dbfile) as db:
                assert db.execute('SELECT * FROM saved').fetchall() == [(1, 'Preserve my answer')]
    assert (data / 'uploads/worksheet.txt').read_text() == 'Keep this worksheet'
    assert not (target.parent / '.tenet-install-lock').exists()
    assert not list(target.parent.glob('.tenet-update-*'))


@pytest.mark.parametrize('case', ['wrong-app', 'damaged', 'older', 'same-build'])
def test_invalid_update_leaves_installed_app_and_data_untouched(setup, case):
    source, target, data, state = setup
    if case == 'wrong-app':
        shutil.rmtree(source)
        make_app(source, 200, 'org.example.other')
    elif case == 'damaged':
        (source / 'Contents/Resources/tenet-build.json').write_text('{}')
    else:
        shutil.rmtree(source)
        make_app(source, 100 if case == 'same-build' else 50)
    before = (data / 'mastery.sqlite3').read_bytes()
    with pytest.raises((ValueError, subprocess.CalledProcessError)):
        installer.install(source, target, data, state, launch=False)
    assert installer.validate(target)['build_epoch'] == 100
    assert (data / 'mastery.sqlite3').read_bytes() == before
    assert not list(target.parent.glob('.tenet-update-*'))


def test_failed_activation_restores_previous_app(setup, monkeypatch):
    source, target, data, state = setup
    real_rename = os.rename
    def fail_stage_move(a, b):
        if Path(a).name.startswith('.tenet-update-') and Path(b) == target:
            raise OSError('Simulated filesystem replacement failure')
        return real_rename(a, b)
    monkeypatch.setattr(installer.os, 'rename', fail_stage_move)
    with pytest.raises(OSError, match='replacement failure'):
        installer.install(source, target, data, state, launch=False)
    assert installer.validate(target)['build_epoch'] == 100
    with sqlite3.connect(data / 'mastery.sqlite3') as db:
        assert db.execute('SELECT note FROM saved').fetchone()[0] == 'Preserve my answer'


def test_real_dmg_install_mounts_and_detaches(setup, tmp_path):
    source, target, data, state = setup
    image_source = tmp_path / 'Disk contents'
    image_source.mkdir()
    shutil.move(source, image_source / 'Tenet.app')
    dmg = tmp_path / 'Tenet update.dmg'
    subprocess.run(['/usr/bin/hdiutil', 'create', '-ov', '-format', 'UDZO', '-fs', 'HFS+',
                    '-volname', 'Tenet Update Test', '-srcfolder', str(image_source), str(dmg)], check=True, capture_output=True)
    result = installer.install(dmg, target, data, state, launch=False)
    assert result['status'] == 'installed'
    assert installer.validate(target)['build_epoch'] == 200
    mounted = subprocess.check_output(['/usr/bin/hdiutil', 'info', '-plist'])
    assert str(state).encode() not in mounted
