#!/usr/bin/env python3
"""Install an explicitly selected Tenet app/DMG; never download executable code."""
from __future__ import annotations
import argparse
import contextlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
import uuid

BUNDLE_ID = 'app.masteryengine.mac'


def run(*args):
    return subprocess.run([str(a) for a in args], check=True, capture_output=True, text=True)


def validate(app: Path, require_manifest=True):
    if app.is_symlink() or not app.is_dir() or app.suffix != '.app':
        raise ValueError('Choose a complete Tenet application or disk image.')
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    if info.get('CFBundleIdentifier') != BUNDLE_ID:
        raise ValueError('This application is not a Tenet update.')
    if info.get('CFBundleExecutable') != 'MasteryEngine2':
        raise ValueError('The Tenet executable is missing.')
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', app)
    if 'arm64' not in run('/usr/bin/lipo', '-archs', app / 'Contents/MacOS/MasteryEngine2').stdout.split():
        raise ValueError('This update does not support Apple Silicon.')
    resources = app / 'Contents/Resources'
    for relative in ['node', 'python/bin/python3.11']:
        if not os.access(resources / relative, os.X_OK):
            raise ValueError('The offline runtime is incomplete.')
    for relative in ['mastery_launch.sh', 'opentutor/apps/web/.next/BUILD_ID', 'opentutor/apps/api/mastery_ext/router.py']:
        if not (resources / relative).is_file():
            raise ValueError('The learning workspace is incomplete.')
    manifest = resources / 'tenet-build.json'
    if not manifest.exists() and not require_manifest:
        return {'build_epoch': 0, 'source_commit': 'legacy'}
    meta = json.loads(manifest.read_text())
    if not isinstance(meta.get('build_epoch'), int) or meta['build_epoch'] <= 0:
        raise ValueError('The update has no valid build information.')
    commit = meta.get('source_commit', '')
    if len(commit) != 40 or any(c not in '0123456789abcdef' for c in commit):
        raise ValueError('The update has no valid source identity.')
    return meta


@contextlib.contextmanager
def candidate(source: Path, job: Path):
    if source.is_symlink():
        raise ValueError('Choose the original application or disk image.')
    if source.suffix.lower() != '.dmg':
        yield source
        return
    mount = job / 'mounted'
    mount.mkdir()
    attached = False
    try:
        run('/usr/bin/hdiutil', 'attach', '-nobrowse', '-readonly', '-mountpoint', mount, source)
        attached = True
        apps = list(mount.glob('*.app'))
        if len(apps) != 1:
            raise ValueError('The disk image must contain one Tenet application.')
        yield apps[0]
    finally:
        if attached:
            run('/usr/bin/hdiutil', 'detach', mount)


def clone_or_copy(source: Path, target: Path):
    """APFS clone first; a DMG/cross-volume copy needs its actual free space."""
    cloned = subprocess.run(['/bin/cp', '-cR', str(source), str(target)], capture_output=True)
    if cloned.returncode == 0:
        return
    if target.exists():
        shutil.rmtree(target)
    size = sum(p.lstat().st_size for p in source.rglob('*') if p.is_file() and not p.is_symlink())
    if shutil.disk_usage(target.parent).free < size + 64 * 1024 * 1024:
        raise ValueError('There is not enough free storage to install this update. Free some space and try again.')
    run('/usr/bin/ditto', source, target)


def wait_for_quit(pid: int):
    deadline = time.monotonic() + 60
    while pid:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            break
        if time.monotonic() >= deadline:
            raise ValueError('Quit Tenet before installing an update.')
        time.sleep(.2)
    for _ in range(50):
        occupied = False
        for port in (18765, 18766):
            with socket.socket() as sock:
                sock.settimeout(.2)
                occupied |= sock.connect_ex(('127.0.0.1', port)) == 0
        if not occupied:
            return
        time.sleep(.2)
    raise ValueError('A study workspace is still running. Quit it before installing an update.')


def backup_progress(data: Path, job: Path):
    backup = job / 'Study Backup'
    backup.mkdir(mode=0o700)
    for name in ['opentutor.sqlite3', 'mastery.sqlite3']:
        source = data / name
        if not source.exists():
            continue
        if source.is_symlink():
            raise ValueError('The study database uses an unsupported linked location.')
        with contextlib.closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src:
            with contextlib.closing(sqlite3.connect(backup / name)) as dst:
                src.backup(dst)
                if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('The study backup did not pass its integrity check.')


def install(source: Path, target: Path, data: Path, state: Path, wait_pid=0, launch=True):
    os.umask(0o077)
    if sys.platform != 'darwin':
        raise ValueError('Tenet updates require macOS.')
    source, data, state = source.absolute(), data.absolute(), state.absolute()
    target = target.absolute()
    if target.is_symlink() or target.suffix != '.app' or not target.parent.is_dir():
        raise ValueError('The installed application location is not supported.')
    if source.resolve() == target.resolve() or target.resolve() in source.resolve().parents:
        raise ValueError('Select a separate downloaded update.')
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    job = state / (time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8])
    job.mkdir(mode=0o700)
    lock = target.parent / '.tenet-install-lock'
    stage = target.parent / ('.tenet-update-' + uuid.uuid4().hex + '.app')
    previous = job / 'Previous Tenet.app'
    acquired = False
    moved_old = False
    installed = False
    try:
        lock.mkdir(mode=0o700)
        acquired = True
        with candidate(source, job) as app:
            new = validate(app)
            old = validate(target, require_manifest=False) if target.exists() else None
            if old and new['source_commit'] == old['source_commit']:
                raise ValueError('This Tenet build is already installed.')
            if old and new['build_epoch'] <= old['build_epoch']:
                raise ValueError('Choose a newer Tenet build. Your current version has been kept.')
            clone_or_copy(app, stage)
            validate(stage)
        wait_for_quit(wait_pid)
        backup_progress(data, job)
        if target.exists():
            os.rename(target, previous)
            moved_old = True
        try:
            os.rename(stage, target)
            installed = True
            validate(target)
            if launch:
                run('/usr/bin/open', '-n', target)
        except Exception:
            if installed:
                os.rename(target, job / 'Rejected Tenet.app')
            if moved_old:
                os.rename(previous, target)
                moved_old = False
            raise
        receipt = {'status': 'installed', 'application': str(target), 'source_commit': new['source_commit'],
                   'previous_app': str(previous) if moved_old else None, 'study_backup': str(job / 'Study Backup')}
        (job / 'receipt.json').write_text(json.dumps(receipt, indent=2))
        return receipt
    finally:
        if stage.exists():
            shutil.rmtree(stage)
        if acquired:
            lock.rmdir()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    parser.add_argument('--wait-pid', type=int, default=0)
    parser.add_argument('--interactive', action='store_true')
    args = parser.parse_args()
    support = Path.home() / 'Library/Application Support'
    try:
        result = install(args.source, args.target, support / 'MasteryEngine2', support / 'Tenet/Updates', args.wait_pid)
        print(json.dumps(result))
    except Exception as error:
        if args.interactive:
            message = str(error) if isinstance(error, ValueError) else 'The update could not be installed. Your previous version has been kept.'
            subprocess.run(['/usr/bin/osascript', '-e', 'on run argv\ndisplay alert "Tenet update" message (item 1 of argv) as critical\nend run', message], capture_output=True)
            if args.target.is_dir():
                subprocess.run(['/usr/bin/open', '-n', str(args.target)], capture_output=True)
        print(f'Tenet update failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
