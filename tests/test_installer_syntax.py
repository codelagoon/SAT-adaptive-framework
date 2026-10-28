"""The Mac installer must at least parse on CI before shipping."""
from pathlib import Path
import subprocess


def test_all_shell_scripts_parse():
    root = Path(__file__).resolve().parents[1]
    scripts = sorted((root / "scripts").glob("*.sh"))
    assert scripts
    for script in scripts:
        result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
        assert result.returncode == 0, f"{script.name}: {result.stderr}"
