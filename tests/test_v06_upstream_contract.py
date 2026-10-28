from pathlib import Path
import importlib.util
BASE=Path(__file__).resolve().parents[1]

def test_installer_pins_compatible_open_tutor_commit():
    code=(BASE/'scripts/install_mac.sh').read_text()
    assert 'dbaab74ffe76d167427ddc4448e4e81dfc38b2a9' in code
    assert 'git -C "${HOME_DIR}/OpenTutor" checkout --detach "$UPSTREAM_SHA"' in code
    assert 'fail closed if incompatible' in code


def test_upstream_course_deletion_patch_is_safely_idempotent(tmp_path):
    spec=importlib.util.spec_from_file_location('overlay_installer',BASE/'scripts/apply_overlay.py')
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    from test_patcher import fixture_source
    root=fixture_source(tmp_path)
    mod.apply(root)
    before=(root/'apps/api/routers/courses_crud.py').read_text()
    mod.apply(root)
    after=(root/'apps/api/routers/courses_crud.py').read_text()
    assert before==after
    assert 'forget_course(str(user.id), str(course_id), owned_problem_ids)' in after
