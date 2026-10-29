"""An inspectable pathway across all *currently supported* offline skills.

This is curriculum coverage for Mastery Engine's installed original question
families, NOT an official College Board/ACT content blueprint or a certification
that the practice bank covers an entire official exam.
"""
from __future__ import annotations
from collections import defaultdict
from mastery_ext.offline_coach import LESSONS

DOMAINS = {
 'SAT Math': {
  'Algebra': ['Linear equations','Linear functions','Systems of equations','Linear model comparison'],
  'Advanced Math': ['Quadratics & factoring','Quadratic functions','Quadratic root relationships','Rational equations','Exponents & exponential equations','Function composition'],
  'Problem Solving and Data Analysis': ['Ratios & proportions','Percent change','Data & averages','Conditional probability'],
  'Geometry and Trigonometry': ['Circle geometry','Geometry & trigonometry'],
  'Additional skill drills (not SAT blueprint claims)': ['Arithmetic sequences','Geometric sequences','Geometric series','Series & sigma notation','Sigma notation'],
 },
 'SAT Reading & Writing': {
  'Information and Ideas': ['Reading inference','Evidence interpretation','Causal inference','Evaluating statistical claims','Experimental design'],
  'Craft and Structure': ['Words in context','Cross-text connections'],
  'Expression of Ideas': ['Transitions','Contrast transitions'],
  'Standard English Conventions': ['Clause boundaries','Subject-verb agreement','Neither/nor agreement','Pronoun precision','Verb tense','Parallelism','Punctuation','Modifiers'],
  'Additional drills': ['Word choice'],
 },
 'ACT English': {
  'Conventions of Standard English': ['Clause boundaries','Subject-verb agreement','Neither/nor agreement','Pronoun precision','Verb tense','Parallelism','Punctuation','Modifiers'],
  'Production of Writing': ['Transitions','Contrast transitions','Word choice'],
 },
 'ACT Math': {
  'Preparing for Higher Math': ['Linear equations','Linear functions','Systems of equations','Quadratics & factoring','Quadratic functions','Quadratic root relationships','Rational equations','Exponents & exponential equations','Function composition','Geometry & trigonometry','Circle geometry'],
  'Integrating Essential Skills': ['Ratios & proportions','Percent change','Conditional probability','Data & averages','Linear model comparison'],
 },
 'ACT Reading': {
  'Key Ideas and Details': ['Reading inference','Evidence interpretation','Causal inference','Evaluating statistical claims','Experimental design'],
  'Craft and Structure': ['Words in context'],
  'Comparing and Integrating Knowledge': ['Cross-text connections'],
 },
 'ACT Science': {
  'Data Interpretation': ['ACT Science data interpretation','ACT Science rates and trends','Science graph interpretation','Velocity–time graphs'],
  'Scientific Investigation': ['Experimental controls','Measurement reliability'],
  'Evaluation of Models, Inferences and Experimental Results': ['Sampling and inference'],
 },
 'Algebra 2': {
  'Equations and Functions': ['Linear equations','Linear functions','Systems of equations','Quadratics & factoring','Quadratic functions','Quadratic root relationships','Rational equations','Function composition','Exponents & exponential equations'],
  'Sequences and Series': ['Arithmetic sequences','Geometric sequences','Geometric series','Series & sigma notation','Sigma notation'],
  'Applications': ['Percent change'],
 },
 'Physics': {
  'Kinematics': ['Average speed','Average velocity vs. speed','Acceleration','Position–time graph translation','Velocity–time graphs','Free fall','Projectile motion'],
  'Newtonian Dynamics': ['Newton’s second law'],
 },
}

# Only target relationships explicitly supported by a real lesson / question.
PREREQUISITES = {
 'Systems of equations':['Linear equations'],
 'Linear functions':['Linear equations'],
 'Linear model comparison':['Linear functions'],
 'Quadratics & factoring':['Linear equations'],
 'Quadratic functions':['Quadratics & factoring'],
 'Quadratic root relationships':['Quadratics & factoring'],
 'Rational equations':['Linear equations'],
 'Function composition':['Linear functions'],
 'Exponents & exponential equations':['Linear equations'],
 'Geometric series':['Geometric sequences'],
 'Series & sigma notation':['Arithmetic sequences'],
 'Sigma notation':['Arithmetic sequences'],
 'Conditional probability':['Ratios & proportions'],
 'Projectile motion':['Average velocity vs. speed','Free fall'],
 'Free fall':['Acceleration'],
 'Newton’s second law':['Acceleration'],
 'Velocity–time graphs':['Average velocity vs. speed'],
 'Position–time graph translation':['Average velocity vs. speed'],
 'Cross-text connections':['Reading inference'],
 'Evidence interpretation':['Reading inference'],
 'Causal inference':['Evidence interpretation'],
 'Evaluating statistical claims':['Evidence interpretation'],
 'Experimental design':['Evidence interpretation'],
 'ACT Science rates and trends':['ACT Science data interpretation'],
 'Measurement reliability':['Experimental controls'],
 'Sampling and inference':['ACT Science data interpretation'],
}

# Author new, original short scaffolded lessons where the prior source lacked coverage.
EXTRA_LESSONS = {
 'ACT Science rates and trends': ('Rate is vertical change divided by horizontal change, using the axis units. A steeper slope means a greater change per unit.',
  'A quantity rises from 8 to 20 over 3 minutes. Its average rate is (20−8)/3 = 4 units/minute.',
  'Does the question ask for a rate, a total change, or a comparison?'),
 'Experimental controls': ('A controlled experiment changes one independent variable while holding plausible confounders constant.',
  'To test fertilizer effect on growth, randomize seedlings to fertilizer or none and keep light, soil, water and measurement time consistent.',
  'Which variable changed besides the treatment, and might it explain the result?'),
 'Measurement reliability': ('Repeated measures estimate variability; reliability is not the same as accuracy or lack of bias.',
  'A scale reads 2 g too high every time: results are consistent but systematically biased.',
  'Would repeating this measurement correct a systematic offset?'),
 'Sampling and inference': ('The sample design determines how far a conclusion can generalize. Random assignment supports causal inference; random sampling supports population generalization.',
  'A study of volunteers from one club cannot directly establish a percentage for all students at a school.',
  'Who was sampled, and was participation random?'),
 'Science graph interpretation': ('Inspect axes, units, and scale before identifying a trend. An observed association alone does not establish causation.',
  'If the dependent value increases from 4 to 16 as time increases from 1 to 5 s, average slope is (16−4)/(5−1)=3 units/s.',
  'Does the trend hold across the entire range or only some points?'),
}


def get_track(track: str, *, questions: list[dict] | None = None) -> dict:
    if track not in DOMAINS:raise ValueError('Unsupported academic track')
    all_skills=[s for skills in DOMAINS[track].values() for s in skills]
    if len(set(all_skills))!=len(all_skills):raise AssertionError('Duplicate skill in track')
    coverage=defaultdict(int)
    for q in questions or []:
        for skill in q.get('knowledge_points',[]):coverage[str(skill)]+=1
    lessons={**LESSONS,**EXTRA_LESSONS}
    domains=[]
    for domain,skills in DOMAINS[track].items():
        domains.append({'name':domain,'skills':[{ 'name':skill,'prerequisites':PREREQUISITES.get(skill,[]),
          'lesson': {'principle':lessons[skill][0],'worked_example':lessons[skill][1],
                     'check':lessons[skill][2]} if skill in lessons else None,
          'available_questions':coverage[skill]} for skill in skills]})
    return {'track':track,'domains':domains,'question_coverage_known':questions is not None,
            'unmapped_question_skills':sorted(set(coverage)-set(all_skills)),
            'missing_lessons':[skill for skill in all_skills if skill not in lessons],
            'scope':'Installed original practice; not an official full exam content blueprint'}


def select_diagnostic(questions: list[dict], track: str, *, max_questions: int = 12) -> dict:
    """Pick one unexposed problem per available skill, spread across domains.

    Return only public stems/options. Initial diagnostic is *unscored* until
    the existing quiz submission route records actual answers. No answer leak.
    """
    blueprint=get_track(track,questions=questions)
    candidate={}
    for q in questions:
        if not q.get('question') or not q.get('options'):continue
        for skill in q.get('knowledge_points',[]):
            if skill not in candidate:candidate[skill]=q
    chosen=[]; seen=set()
    # Round-robin across domains ensures diagnostic does not overfocus algebra.
    domains=blueprint['domains']
    for slot in range(max(len(d['skills']) for d in domains)):
        for domain in domains:
            if slot>=len(domain['skills']):continue
            skill=domain['skills'][slot]['name'];q=candidate.get(skill)
            if q and q['id'] not in seen and len(chosen)<max_questions:
                chosen.append({'id':q['id'],'question':q['question'],
                    'options':q['options'],'skill':skill,
                    'domain':domain['name'],'difficulty_layer':q.get('difficulty_layer')})
                seen.add(q['id'])
    return {'track':track,'questions':chosen,'question_count':len(chosen),
            'note':'Unscored start; no baseline estimate until answers are submitted. Difficulty is not calibrated.'}
