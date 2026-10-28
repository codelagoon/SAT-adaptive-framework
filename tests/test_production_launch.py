from pathlib import Path
import subprocess
import sys

BASE=Path(__file__).resolve().parents[1]

def test_production_launcher_has_no_download_or_dev_server():
    p=BASE/'scripts/mastery_launch.sh'
    source=p.read_text()
    subprocess.run(['bash','-n',str(p)],check=True)
    assert 'next" start' in source
    assert 'uvicorn main:app' in source
    assert '--host 127.0.0.1 --port 18765' in source
    for forbidden in ('pip install','npm install','npm ci','git clone','next dev'):
        assert forbidden not in source
    assert '.next/BUILD_ID' in source
    assert 'curl --noproxy' in source and '/api/mastery/health' in source
    assert 'source "${ROOT}/.env"' not in source


def test_installer_prepares_compiled_runtime_before_mac_app():
    source=(BASE/'scripts/install_mac.sh').read_text()
    assert source.index('npm run build') < source.index('build_macos.sh')
    assert 'requirements-core.txt' in source
    assert 'npm ci' in source
    assert 'apply_overlay.py' in source
    mac=(BASE/'macos/MasteryApp.swift').read_text()
    assert 'mastery_launch.sh' in mac and '18766/mastery' in mac
    assert 'quickstart.sh' not in mac


def test_no_silent_injection_into_unknown_course():
    sys.path.insert(0,str(BASE/'overlay/apps/api'))
    from mastery_ext.question_bank import category_for
    assert category_for('U.S. History')==''
    assert category_for('SAT Math')=='SAT Math'

def test_study_page_only_selects_offline_sources():
    # Native OpenTutor can retain AI-generated and uploaded worksheets, but
    # Mastery offline practice must not accidentally select those items.
    router=(BASE/'overlay/apps/api/mastery_ext/router.py').read_text()
    anchor=router[router.index('async def next_problem('):router.index('async def skip_repair(')]
    assert "PracticeProblem.source=='mastery_offline'" in anchor
