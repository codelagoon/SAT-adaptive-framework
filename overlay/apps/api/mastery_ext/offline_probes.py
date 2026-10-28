"""Short, independently authored misconception *checks* requiring no AI.

A missed multiple-choice question is NOT sufficient to identify someone's
reasoning. These probes test a necessary prerequisite on an independent item.
A correct probe therefore narrows the gap; a wrong probe supports only the
claim that the probed principle was not applied on this occasion.
"""
from __future__ import annotations

import hashlib
import random
from fractions import Fraction


def _make(skill: str, question: str, options: list[str], key: int,
          explanation: str, principle: str, variant: str = '1') -> dict:
    if len(options) != 4 or len(set(options)) != 4 or not 0 <= key <= 3:
        raise ValueError(f'Invalid diagnostic options for {skill}')
    return {'probe_id':hashlib.sha256(f'{skill}|{variant}|{question}'.encode()).hexdigest()[:24],
            'skill':skill, 'question':question,
            'options':dict(zip('ABCD',options)), 'correct_answer':'ABCD'[key],
            'explanation':explanation,'principle':principle}


def _numeric(skill: str, token: str, rng: random.Random) -> dict | None:
    if skill == 'Conditional probability':
        members=rng.randint(9,26); math=rng.randint(2,members-2); nonmembers=rng.randint(8,19)
        p=str(Fraction(math,members))
        choices=[str(Fraction(math,members+nonmembers)),p,str(Fraction(members-math,members)),
                 str(Fraction(math,members-1))]
        if len(set(choices))<4:return _numeric(skill,token,rng)
        return _make(skill,f'A club has {members} members, including {math} who study math. There are also {nonmembers} nonmembers nearby. GIVEN that a randomly selected person belongs to the club, what is P(studies math)?',choices,1,
                     f'GIVEN club membership, the sample space has {members} people, not {members+nonmembers}. The probability is {math}/{members} = {p}.',
                     'Restrict the denominator to the conditioned group.',token)
    if skill == 'Velocity–time graphs':
        v=-rng.randint(3,12); t=rng.randint(3,9)
        return _make(skill,f'A velocity–time graph stays at {v} m/s for {t} seconds. What is signed displacement?',
          [f'{v*t} m',f'{-v*t} m',f'{v/t:.2f} m',f'{v+t} m'],0,
          f'Signed area is velocity × time = ({v})({t}) = {v*t} m. The direction makes it negative.',
          'Signed area below the time axis is negative displacement.',token)
    if skill == 'Free fall':
        t=rng.randint(3,9)
        return _make(skill,f'A rock is dropped from rest. With g=10 m/s², how far has it fallen after {t} seconds?',
          [f'{10*t} m',f'{5*t} m',f'{5*t*t} m',f'{10*t*t} m'],2,
          f's = ½gt² = 5×{t}² = {5*t*t} m. Using t instead of t² confuses constant acceleration with constant speed.',
          'From rest under constant acceleration, distance is proportional to time squared.',token)
    if skill == 'Arithmetic sequences':
        first=rng.randint(2,15);d=rng.randint(2,7);n=rng.randint(5,14); correct=first+(n-1)*d
        return _make(skill,f'Term 1 of an arithmetic sequence is {first}; the common difference is {d}. What is term {n}?',
          [str(first+n*d),str(correct),str(n*d),str(first+(n-2)*d)],1,
          f'aₙ = a₁+(n−1)d = {first}+({n}−1)({d}) = {correct}. There are {n-1} steps between term 1 and term {n}.',
          'One-based sequence indexing requires n−1 increments.',token) if len({first+n*d,correct,n*d,first+(n-2)*d})==4 else _numeric(skill,token,rng)
    if skill == 'Linear equations':
        a=rng.randint(2,8);b=rng.randint(2,9)
        return _make(skill,f'Which expression is equivalent to {a}(x+{b})?',
          [f'{a}x+{b}',f'{a}x+{a*b}',f'{a}x+{a+b}',f'{a*b}x'],1,
          f'Distribution multiplies BOTH terms: {a}·x+{a}·{b} = {a}x+{a*b}.',
          'Distribute to every term inside parentheses.',token) if len({f'{a}x+{b}',f'{a}x+{a*b}',f'{a}x+{a+b}',f'{a*b}x'})==4 else _numeric(skill,token,rng)
    if skill == 'Function composition':
        a=rng.randint(2,6);b=rng.randint(3,8);x=rng.randint(2,7)
        return _make(skill,f'f(t)=2t+{a}, g(t)={b}t. To calculate f(g({x})), what must be calculated FIRST?',
          [f'f({x})',f'g({x})',f'2{b}+{a}',f'f({a})'],1,
          f'Composition f(g(x)) applies g FIRST: g({x})={b*x}. Then substitute into f.',
          'Evaluate the inner function first.',token) if x != a else _numeric(skill,token,rng)
    if skill == 'Quadratic functions':
        h=rng.choice([i for i in range(-9,10) if i]);k=rng.randint(-7,7)
        return _make(skill,f'What is the x-coordinate of the vertex of y=(x {(-h):+d})² {k:+d}?',
          [str(-h),str(h),str(k),str(h+k)],1,
          f'Compare with y=(x−h)²+k. Here h={h}, so the vertex x-coordinate is {h}.',
          'The sign inside vertex form is opposite to the x-coordinate.',token) if len({-h,h,k,h+k})==4 else _numeric(skill,token,rng)
    if skill == 'Rational equations':
        h=rng.choice([i for i in range(-9,10) if i]);n=h+rng.randint(2,8)
        return _make(skill,f'Which x-value is excluded from the domain of (x−{n})/(x−({h}))?',
          [str(n),str(h),str(-h),str(h+1)],1,
          f'The denominator x−({h}) is zero at x={h}; that value is excluded, even if the numerator is zero elsewhere.',
          'Set the denominator equal to zero to find domain exclusions.',token) if len({n,h,-h,h+1})==4 else _numeric(skill,token,rng)
    if skill == 'Projectile motion':
        v=rng.randint(5,25);t=rng.randint(2,9)
        return _make(skill,f'A projectile has constant horizontal velocity {v} m/s and is airborne for {t} s. What is its horizontal displacement?',
          [f'{5*t*t} m',f'{v*t*t} m',f'{v*t} m',f'{v+t} m'],2,
          f'With no air resistance, horizontal acceleration is zero, so x=vₓt={v}×{t}={v*t} m.',
          'Separate horizontal and vertical components.',token) if len({5*t*t,v*t*t,v*t,v+t})==4 else _numeric(skill,token,rng)
    if skill == 'Average speed':
        v1,v2=3,9;t1,t2=2,4
        return _make(skill,'A person moves at 3 m/s for 2 s, then 9 m/s for 4 s. What is average speed?',
          ['6 m/s','7 m/s','8 m/s','9 m/s'],1,
          'Total distance = 3×2+9×4=42 m and total time=6 s, so average speed=7 m/s.',
          'Average speed is total distance divided by total time.',token)
    if skill == 'Series & sigma notation':
        n=rng.randint(4,9)
        correct=sum(3+2*i for i in range(n))
        return _make(skill,f'What is the SUM of the first {n} terms of 3, 5, 7, 9, ...?',
          [str(3+2*(n-1)),str(correct),str(n*3),str(correct+2)],1,
          f'There are {n} terms and the last is {3+2*(n-1)}. Sₙ=n(first+last)/2={n}(3+{3+2*(n-1)})/2={correct}.',
          'A series sum accumulates every term; it is not the last term.',token) if len({3+2*(n-1),correct,3*n,correct+2})==4 else _numeric(skill,token,rng)
    if skill == 'Quadratic root relationships':
        r,s=rng.randint(2,12),rng.randint(2,12)
        return _make(skill,f'If two roots are {r} and {s}, what is their PRODUCT?',
          [str(r+s),str(r*s),str(abs(r-s)),str(-r*s)],1,
          f'The product is ({r})({s})={r*s}. The sum {r+s} is a different relationship.',
          'Distinguish a sum of roots from a product of roots.',token) if len({r+s,r*s,abs(r-s),-r*s})==4 else _numeric(skill,token,rng)
    return None


STATIC: dict[str, tuple[str,list[str],int,str,str]] = {
 'Cross-text connections':(
  'Text A: A new school bus route shortened average trips. Text B: Trips shortened in central neighborhoods but lengthened on the outskirts. What does B establish?',
  ['A is necessarily fabricated.','B qualifies the average by showing uneven effects.','No trips got shorter.','The route made all trips longer.'],1,
  'B describes a distribution hidden by the average; it qualifies rather than completely refutes A.',
  'A qualification narrows a claim without asserting its complete opposite.'),
 'Evidence interpretation':(
  'Two neighborhoods introduced bike lanes and new bus service simultaneously. Afterward, car trips fell. Which claim fits the evidence?',
  ['Bike lanes alone caused the decline.','Bus service alone caused the decline.','The changes coincided with fewer car trips, but their separate effects cannot be isolated.','Neither change could affect car trips.'],2,
  'Two interventions changed at once; a before/after observation cannot isolate either cause.',
  'Distinguish observation from an unsupported causal explanation.'),
 'Causal inference':(
  'Researchers observe that students who attended optional tutoring scored higher. What is a plausible alternative explanation?',
  ['All scoring systems must be broken.','Students choosing tutoring may have differed in motivation beforehand.','Tutoring never helps anyone.','Every student was randomly assigned to tutoring.'],1,
  'Self-selection is a confounder; correlation does not by itself establish tutoring caused the score gap.',
  'Consider selection effects and unmeasured differences.'),
 'Reading inference':(
  'A report says that SOME of the planted trees survived a drought. What is definitely supported?',
  ['All trees survived.','At least one planted tree survived.','No trees survived.','Survival was identical across species.'],1,
  '“Some survived” entails at least one, not all, and provides no species comparison.',
  'Draw only the conclusion justified by the given quantifier.'),
 'Words in context':(
  'In “The laboratory maintained an austere interior: unpainted walls, simple benches, and no decoration,” what does austere mean?',
  ['extravagant','restrained and plain','unusually dangerous','temporarily closed'],1,
  'The following examples define an unadorned, restrained setting.',
  'Use nearby details to determine contextual meaning.'),
 'Evaluating statistical claims':(
  'A survey at a city gym finds that 80% of gym visitors exercise four days per week. What population does this survey directly describe?',
  ['All adults in the city.','Only children.','The sampled gym visitors.','Every gym in the nation.'],2,
  'Sampling only gym visitors cannot directly support claims about all city residents.',
  'Keep a claim within its sampled population.'),
 'Experimental design':(
  'To test whether fertilizer affects growth, which design best isolates that effect?',
  ['Give fertilizer plots extra sunlight too.','Give similar randomly assigned plants equal water and light, varying only fertilizer.','Compare different species in different cities.','Measure only the tallest fertilized plant.'],1,
  'Holding water, light and species constant isolates fertilizer as the tested treatment.',
  'Control confounders and vary the independent variable.'),
 'Clause boundaries':(
  'Two independent clauses are “The experiment ended” and “The data remained inconclusive.” Which punctuation correctly joins them without a conjunction?',
  ['The experiment ended, the data remained inconclusive.','The experiment ended; the data remained inconclusive.','The experiment ended: and the data remained inconclusive.','The experiment ended the data remained inconclusive.'],1,
  'A semicolon joins two related independent clauses without a coordinating conjunction.',
  'Two independent clauses need an appropriate boundary.'),
 'Neither/nor agreement':(
  'Choose the verb: “Neither the teacher nor the students ___ ready yesterday.”',
  ['was','were','is','has'],1,
  'With neither/nor the nearer subject “students” is plural; “yesterday” requires past tense.',
  'Match the verb to the nearer subject and the timeline.'),
 'Subject-verb agreement':(
  'Choose: “The collection of photographs ___ in the archive.”',
  ['are','is','have','were'],1,
  '“Collection” is the singular head subject, not the plural noun in the prepositional phrase.',
  'Find the grammatical head subject.'),
 'Contrast transitions':(
  '“The new train was more expensive to operate; ___, it cut travel times sharply.” Which transition best signals contrast?',
  ['therefore','similarly','however','for example'],2,
  '“However” marks the surprising benefit in contrast to the higher operating cost.',
  'Identify the logical relation between clauses.'),
 'Transitions':(
  '“The reservoir level fell sharply; ___, the city restricted irrigation.” Which transition expresses consequence?',
  ['meanwhile','however','for example','therefore'],3,
  'Restrictions follow as a consequence of low water levels.',
  'Choose a transition expressing cause versus contrast.'),
 'Modifiers':(
  'Complete correctly: “Walking into the classroom, ___.”',
  ['the empty chairs were noticed','the lesson began suddenly','the students opened their notebooks','there was a clock on the wall'],2,
  'The subject following the introductory modifier should be the people who were walking.',
  'Attach an introductory modifier to the person performing the action.'),
 'ACT Science data interpretation':(
  'A table shows temperature 10, 20, 30°C and sensor output 4, 7, 10 units. Which statement is directly supported?',
  ['Output increases with temperature in these observations.','Temperature always causes this output everywhere.','Output decreases as temperature rises.','The sensor never makes errors.'],0,
  'In the observations, higher temperatures align with higher outputs; causation beyond these data is unproved.',
  'Describe what the given data actually show.'),
 'Linear functions':(
  'The line y=4x−7 crosses the y-axis at which value?',
  ['4','−7','7','−4'],1,
  'The y-intercept occurs when x=0, leaving y=−7.',
  'The intercept is the constant term, not the slope.'),
 'Geometric sequences':(
  'A geometric sequence starts at 2 and doubles. What is its FOURTH term?',
  ['8','10','12','16'],3,
  'Terms: 2, 4, 8, 16. The exponent is n−1.',
  'Count multiplicative steps from term one.'),
 'Sigma notation':(
  'What is Σ(k=1 to 4) (2k)?',
  ['8','10','20','24'],2,
  '2(1+2+3+4)=2×10=20.',
  'Sum every term in the indicated range.'),
 'Average velocity vs. speed':(
  'A runner travels 20 m east and then 20 m west over 10 s. What is average velocity?',
  ['0 m/s','4 m/s east','4 m/s west','2 m/s east'],0,
  'Displacement returns to zero; average velocity is 0/10 = 0 m/s even though distance was 40 m.',
  'Velocity depends on displacement, not total distance.'),
 'Linear model comparison':(
  'A service has a $10 base charge and $4 per mile. What is its cost for 3 miles?',
  ['$12','$14','$22','$30'],2,
  'Total cost = 10+4×3=22 dollars.',
  'Separate the fixed fee from the variable rate.'),
 'Rational equations':(
  'For the expression (x+3)/(x−4), which value is excluded?',
  ['−3','0','3','4'],3,
  'The denominator vanishes when x=4.',
  'A denominator cannot equal zero.'),
}


def probe_for(skill: str, origin: str) -> dict | None:
    """Return a stable probe for the original problem and skill; no solution leak."""
    seed=int.from_bytes(hashlib.sha256(f'probe-v1|{skill}|{origin}'.encode()).digest()[:8],'big')
    rng=random.Random(seed)
    p=_numeric(skill,origin,rng)
    if p:return p
    record=STATIC.get(skill)
    return _make(skill,*record,variant=origin) if record else None


def public_probe(probe: dict) -> dict:
    return {k:probe[k] for k in ('probe_id','skill','question','options','principle')}


def evaluate(probe: dict, choice: str) -> dict:
    answer=choice.strip().upper()
    if answer not in probe['options']:
        raise ValueError('Answer must be A, B, C, or D')
    correct=answer==probe['correct_answer']
    return {'correct':correct,'correct_answer':probe['correct_answer'],
            'explanation':probe['explanation'],
            'interpretation':('You applied this prerequisite correctly here. That does not establish why the original question was missed; try a new harder problem.'
             if correct else 'You did not apply this prerequisite correctly on the probe. Review the worked explanation, then retry the underlying skill.'),
            'confidence':'observed on one diagnostic question, not proof of a stable misconception'}
