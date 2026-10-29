from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'overlay/apps/web/src/app/mastery'
UI = (ROOT / 'workspace-ui.tsx').read_text()
CSS = (ROOT / 'workspace-ui.module.css').read_text()


def test_tenet_brand_and_linear_style_navigation():
    assert '>Tenet<' in UI
    assert 'Mastery Engine <span>' not in UI
    assert 'label:"Solve"' not in UI  # Solve is a focused route, not navigation clutter


def test_no_native_dropdowns_in_study_workspace():
    assert '<select' not in UI and '</select>' not in UI
    assert 'PremiumSelect' in UI
    assert 'role="listbox"' in UI and 'role="option"' in UI
    assert 'aria-expanded' in UI


def test_neutral_ink_palette_and_single_viewport_layout():
    assert '--tenet-accent:#b2b8c2' in CSS
    assert '--tenet-surface:#1b1c1f' in CSS
    assert 'height:100dvh' in CSS
    assert 'overflow:hidden' in CSS
    assert '.content{width:100%;max-width:none;flex:1;min-height:0;overflow-y:auto' in CSS


def test_dense_home_workspace_replaces_big_hero_cards():
    assert 'styles.studyQueue' in UI
    assert 'styles.inspector' in UI
    assert 'styles.homeFeature' not in UI
    assert 'styles.quickLinks' not in UI


def test_shared_controls_are_themed_not_browser_default():
    assert '.premiumSelect' in CSS
    assert '.dropdownMenu' in CSS
    assert '.choiceActive' in CSS
    assert '.lessonLayout' in CSS
    assert '.bankRow' in CSS
    assert '.statGrid' in CSS
