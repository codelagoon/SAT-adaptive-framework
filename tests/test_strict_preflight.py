"""Test compiled-launcher rewrite and packaging guards without assuming Linux can make a DMG."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "scripts/build_portable_macos.sh"
LAUNCH = ROOT / "scripts/mastery_portable_launch.sh"
SWIFT = ROOT / "macos/MasteryApp.swift"
SMOKE = ROOT / "scripts/codemagic_smoke.sh"

class StrictPreflight(unittest.TestCase):
    def test_portable_swift_rewrite_executes(self):
        text = BUILD.read_text()
        anchor = '"${SOURCE_DIR}/macos/MasteryApp.swift" "${BUILD_DIR}/MasteryPortable.swift" <<\'PY\'\n'
        self.assertEqual(text.count(anchor), 1)
        code = text.split(anchor, 1)[1].split("\nPY\n", 1)[0]
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "MasteryPortable.swift"
            subprocess.run([sys.executable, "-c", code, str(SWIFT), str(output)], check=True)
            patched = output.read_text()
            self.assertIn('resourceURL.appendingPathComponent("opentutor"', patched)
            self.assertNotIn("opentutor-path.txt", patched)
            self.assertNotIn("/opt/homebrew/bin", patched)
            self.assertIn("Library/Application Support/MasteryEngine2/deeptutor-data", patched)

    def test_data_is_local_not_inside_signed_app(self):
        text = LAUNCH.read_text()
        self.assertIn('DATABASE_URL="sqlite+aiosqlite:///', text)
        self.assertIn("opentutor.sqlite3", text)
        self.assertIn("MASTERY_DATA_DIR=", text)
        self.assertIn("UPLOAD_DIR=", text)
        self.assertNotIn("/opt/homebrew", text)

    def test_binary_host_dependencies_guarded(self):
        text = BUILD.read_text()
        self.assertIn('otool -L', text)
        self.assertIn("Bundled Node depends on external libraries", text)
        self.assertIn('lipo -archs', text)

    def test_real_ui_diagnosis_and_data_deletion_checked(self):
        text = SMOKE.read_text() + (ROOT/'scripts/verify_bundled_runtime.py').read_text()
        for needle in ("/mastery'", "Learn where it gets difficult",
                       "/offline-diagnosis/", "diagnostic_probes",
                       "SELECT * FROM", "hdiutil attach", "codesign --verify"):
            self.assertIn(needle, text)
        subprocess.run(["bash", "-n", str(SMOKE)], check=True)

if __name__ == "__main__":
    unittest.main()
