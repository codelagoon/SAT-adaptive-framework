"""Replacement contract: the old screen must be unreachable, not merely hidden."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT/'overlay/apps/web/src/app/mastery'


def test_tenet_is_the_only_primary_workspace():
    ui = (APP/'workspace-ui.tsx').read_text()
    assert 'Tenet' in ui
    assert 'Legacy study tools' not in ui
    assert 'href="/mastery/legacy"' not in ui
    for section in ('learn','bank','solve','tests','analytics'):
        assert f'<MasteryWorkspace section="{section}"' in (APP/section/'page.tsx').read_text()
    assert '<MasteryWorkspace section="home"' in (APP/'page.tsx').read_text()


def test_old_route_redirects_without_rendering_previous_ui():
    old = (APP/'legacy/page.tsx').read_text()
    assert 'redirect("/mastery")' in old
    assert 'buildArgumentGraph' not in old
    archive = ROOT/'docs/archive/mastery-v09-debate-page.tsx.txt'
    assert archive.is_file() and 'buildArgumentGraph(debate.cards)' in archive.read_text()


def test_neutral_ink_tokens_drive_all_workspaces():
    css = (APP/'workspace-ui.module.css').read_text()
    assert ':global(.dark) .shell' in css
    assert '--canvas:#fff' in css and '--panel:#fff' in css
    assert '--tenet-surface:#1b1c1f' in css
    assert '--tenet-accent:#b2b8c2' in css
    assert 'background:var(--panel)' in css
    assert 'height:100dvh' in css
    # The global accent must no longer be Graphite/Steel Blue.
    assert '--tenet-accent:#87addb' not in css


def test_no_native_dropdowns_returned_in_new_workspaces():
    ui=(APP/'workspace-ui.tsx').read_text()
    assert 'function PremiumSelect' in ui
    assert '<select' not in ui.lower()
