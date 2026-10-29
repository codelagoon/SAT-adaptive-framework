from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
CORE=BASE/'overlay/apps/web/src/app/mastery/openSourceDebateCore.ts'
PAGE=BASE/'docs/archive/mastery-v09-debate-page.tsx.txt'
NOTICES=BASE/'THIRD_PARTY_NOTICES.md'

def test_open_source_debate_core_is_licensed_and_used():
    core=CORE.read_text()
    page=PAGE.read_text()
    notices=NOTICES.read_text()
    assert 'Argdown core (MIT)' in core
    assert 'ArguMentor debate-core (MIT)' in core
    assert 'RelationType.SUPPORT' in core
    assert 'RelationType.ATTACK' in core
    assert 'RelationType.UNDERCUT' in core
    assert 'buildArgumentGraph(debate.cards)' in page
    assert "phaseForRound('public_forum'" in page
    assert 'Copyright (c) 2026 Arshia Keshvari' in notices
    assert 'Christian Voigt and contributors' in notices

def test_debateflow_code_not_vendored_under_unclear_license():
    tree='\n'.join(str(p) for p in BASE.rglob('*') if p.is_file())
    assert 'DebateFlow' not in tree
