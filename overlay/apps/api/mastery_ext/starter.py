"""Initial topic priorities based on user-provided study history.
These are starting hypotheses, not current psychometric estimates.
"""

FOCUS = [
    (('sat','math'), ['Geometry & trigonometry','Conditional probability','Statistical claims','Linear equations']),
    (('sat','reading'), ['Cross-text connections','Words in context','Inference overreach','Evidence interpretation']),
    (('sat','english'), ['Cross-text connections','Words in context','Inference overreach','Evidence interpretation']),
    (('act','english'), ['Clause boundaries','Neither/nor agreement','Contrast transitions','Paragraph organization']),
    (('act','math'), ['Geometry & trigonometry','Conditional probability','Statistical claims','Linear equations']),
    (('physics',), ['Position–velocity graph translation','Average speed','Free fall','Projectile motion']),
    (('algebra',), ['Sigma notation','Arithmetic series','Geometric series','Sequence indexing']),
]

def starting_priorities(course_name: str) -> list[str]:
    name=course_name.casefold()
    for keys,topics in FOCUS:
        if all(key in name for key in keys):return topics
    if 'sat' in name:return FOCUS[0][1]+FOCUS[1][1]
    return []
