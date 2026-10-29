from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'overlay/apps/web/src/app/mastery/workspace-ui.tsx'
CSS=ROOT/'overlay/apps/web/src/app/mastery/workspace-ui.module.css'
PREVIEW=ROOT/'design/tenet-neutral-ink-ui-preview.html'


def test_icon_only_navigation_preserves_accessible_names():
    ui=SRC.read_text()
    assert 'className={styles.dock}' in ui
    assert 'aria-label={n.label}' in ui
    assert 'data-tooltip={n.label}' in ui
    assert 'className={styles.brandLabel}' in ui
    assert 'className={styles.navIcon}' in ui
    assert '{n.label}</Link>' not in ui


def test_navigation_icons_are_consistent_vector_glyphs():
    ui=SRC.read_text()
    assert 'function NavIcon' in ui
    for icon in ('home','book','grid','clock','chart'):
        assert f'{icon}:' in ui
    assert 'strokeLinecap="round"' in ui
    assert 'strokeLinejoin="round"' in ui


def test_sidebar_is_compact_floating_pill_without_labels():
    css=CSS.read_text()
    assert '.dock{' in css
    assert 'border-radius:24px' in css
    assert '.side{width:76px;flex:0 0 76px' in css
    assert '.navItem::after' in css  # Brand/nav may share the same tooltip rule.
    assert '.navItem:focus-visible::after' in css
    assert '.focusMode .side{display:none}' in css


def test_preview_includes_same_pill_and_custom_svg_icons():
    html=PREVIEW.read_text()
    assert '<div class="dock">' in html
    assert 'data-tooltip="Question Bank"' in html
    assert 'aria-label="Practice Tests"' in html
    assert '<svg' in html
    assert '.side{width:76px;flex:0 0 76px' in html
