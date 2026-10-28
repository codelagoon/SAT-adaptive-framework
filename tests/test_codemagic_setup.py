from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class CodemagicConfiguration(unittest.TestCase):
    def test_build_config_is_valid_and_manual(self):
        config = (ROOT/'codemagic.yaml').read_text()
        assert 'instance_type: mac_mini_m2' in config
        assert 'max_build_duration: 120' in config
        assert 'triggering:' not in config  # no automatic paid builds
        assert 'Prove bundled app can create, grade, and erase a temporary course' in config
        assert config.index('Prove bundled app can create, grade, and erase a temporary course') < config.index('Publish DMG only after a successful live smoke test')
        assert 'release/*.dmg' in config
        assert 'release/SHA256SUMS.txt' in config

    def test_live_smoke_checks_real_services_and_dmg(self):
        script = ROOT/'scripts/codemagic_smoke.sh'
        subprocess.run(['bash','-n',str(script)], check=True)
        src = script.read_text() + (ROOT/'scripts/verify_bundled_runtime.py').read_text()
        for needle in ('/api/health','/api/mastery/health','/quiz/submit','/courses/','/mastery/prepare','hdiutil attach','codesign --verify'):
            assert needle in src
        assert 'mock' not in src.lower()
