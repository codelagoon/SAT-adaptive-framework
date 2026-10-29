import importlib.util
from pathlib import Path
import pytest
BASE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('installer',BASE/'scripts/apply_overlay.py')
installer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

def fixture_source(tmp_path):
    files={
      'apps/api/main.py':'# OpenTutor entrypoint',
      'apps/web/package.json':'{"name":"opentutor-web"}',
      'apps/api/schemas/quiz.py':f'from pydantic import BaseModel\n{installer.RESPONSE_SCHEMA_ANCHOR}\n',
      'apps/api/services/router_registry.py':f'begin\n{installer.ROUTER_ANCHOR}\nend',
      'apps/api/routers/quiz_submission.py':f'begin\n{installer.CLASSIFIER_ANCHOR}\n{installer.SUBMISSION_ANCHOR}\n{installer.RESPONSE_ID_ANCHOR}\nend',
      'apps/api/routers/courses_crud.py':f'begin\n{installer.DELETE_COURSE_ANCHOR}\nend',
      'apps/web/next.config.ts':f'const nextConfig: NextConfig = {{\n  async rewrites() {{ return {{ beforeFiles:[\n{installer.WEB_COURSE_ANCHOR}\n] }}; }}\n}}; export default nextConfig;',
        'apps/web/src/app/_components/dashboard-sidebar.tsx':f'begin\n{installer.SIDEBAR_ANCHOR}\nend',
      'apps/web/src/app/layout.tsx':f'{installer.FONT_IMPORT}\n{installer.FONT_CONFIG}\n<html {installer.FONT_CLASS}>\n{installer.THEME_PROVIDER_ANCHOR}',
      'scripts/quickstart.sh':f'#!/bin/bash\n{installer.FASTSETUP_ANCHOR}\n{installer.WEB_BIND_ANCHOR}\n',
      'apps/web/src/app/globals.css':f'{installer.FONT_CSS_ANCHOR}sans-serif;\n',
    }
    for relative,source in files.items():
        p=tmp_path/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(source)
    return tmp_path

def test_overlay_patches_and_is_idempotent(tmp_path):
    root=fixture_source(tmp_path)
    installer.apply(root)
    installer.apply(root)
    assert 'mastery_ext.router' in (root/'apps/api/services/router_registry.py').read_text()
    assert 'record_attempt' in (root/'apps/api/routers/quiz_submission.py').read_text()
    assert 'Mastery Engine 2.0' in (root/'apps/web/src/app/_components/dashboard-sidebar.tsx').read_text()
    assert (root/'apps/web/src/app/mastery/page.tsx').exists()
    assert '/api/courses/' in (root/'apps/web/next.config.ts').read_text()
    assert (root/'apps/web/src/app/layout.tsx').read_text().count('disableTransitionOnChange') == 1

def test_fails_closed_before_modifications(tmp_path):
    root=fixture_source(tmp_path)
    router=root/'apps/api/services/router_registry.py'
    initial=router.read_text()
    (root/'apps/api/routers/quiz_submission.py').write_text('upstream changed')
    with pytest.raises(RuntimeError,match='Compatibility check'):
        installer.apply(root)
    assert router.read_text()==initial
