"""Original, deterministic and independently verifiable practice generation.

This is not a reproduction of SAT, ACT or exam provider content and is NOT
psychometrically calibrated. Each generated item contains the answer, a
worked explanation, a non-spoiling hint and exact concept tags. No LLM or
PDF required. Questions remain in OpenTutor's canonical PracticeProblem bank.
"""
from __future__ import annotations

from fractions import Fraction
import hashlib
import random

TRACKS = ('SAT Math', 'SAT Reading & Writing', 'ACT English', 'Algebra 2', 'Physics')


def _rng(track: str, seed: str) -> random.Random:
    digest = hashlib.sha256(f'mastery-v3:{track}:{seed}'.encode()).digest()
    return random.Random(int.from_bytes(digest[:8], 'big'))


def _mc(prompt: str, answer: str, wrong: list[str], rng: random.Random, *, skill: str,
        explanation: str, hint: str, level: int = 3, graph: dict | None = None) -> dict:
    distractors = [str(x) for x in wrong if str(x) != str(answer)]
    options = list(dict.fromkeys([str(answer)] + distractors))
    if len(options) < 4:
        raise ValueError(f'Insufficient distinct choices for {skill}: {options}')
    options = options[:4]
    rng.shuffle(options)
    letters = 'ABCD'
    correct = letters[options.index(str(answer))]
    # Retain which original distractor construction produced each option.
    # This supports grounded offline error hypotheses, not speculative AI labels.
    distractor_index = {
        letters[i]: next((j for j, candidate in enumerate(wrong)
                          if str(candidate) == text), None)
        for i, text in enumerate(options) if text != str(answer)
    }
    return {'question': prompt, 'options': dict(zip(letters, options)),
            'correct_answer': correct, 'explanation': explanation,
            'knowledge_points': [skill], 'difficulty_layer': level,
            'problem_metadata': {'mastery_generated': 'v3', 'hint': hint,
                                 'graph': graph, 'original_answer': str(answer),
                                 'distractor_index': distractor_index},
            'question_type': 'mc'}


def _linear(rng: random.Random, level: int) -> dict:
    root = rng.choice([i for i in range(-13, 14) if i])
    a = rng.randint(3, 12)
    c = rng.randint(1, 10)
    if c == a: c += 2
    b = rng.randint(-9, 9)
    d = (a - c) * root + a * b
    # a(x+b) = cx+d => (a-c)x = d-ab
    return _mc(f'Solve for x: {a}(x {b:+d}) = {c}x {d:+d}', str(root),
               [str(-root), str(root + 2), str(root - 3)], rng, skill='Linear equations',
               explanation=f'Expand: {a}x {a*b:+d} = {c}x {d:+d}. Subtract {c}x and {a*b:+d}: ({a-c})x = {d-a*b}. Divide by {a-c} to obtain x = {root}.',
               hint='Distribute first. Collect every x term on one side before dividing.', level=level)


def _quadratic(rng: random.Random, level: int) -> dict:
    r1, r2 = rng.sample([i for i in range(-12, 13) if i], 2)
    s = r1+r2; prod = r1*r2; answer = max(r1,r2)
    return _mc(f'The equation x² {(-s):+d}x {prod:+d} = 0 has two roots. What is the GREATER root?',
               str(answer), [str(min(r1,r2)), str(-answer), str(answer+1)], rng,
               skill='Quadratics & factoring', level=level,
               explanation=f'Factor as (x {(-r1):+d})(x {(-r2):+d}) = 0. The roots are {r1} and {r2}; the greater root is {answer}.',
               hint='Find two numbers whose product is the constant and whose sum is the negative of the x coefficient.')


def _sequence(rng: random.Random, level: int) -> dict:
    first = rng.randint(-12, 14); diff = rng.choice([i for i in range(-8, 9) if i]); n = rng.randint(12, 55)
    answer = first + (n-1)*diff
    return _mc(f'An arithmetic sequence begins at {first} and has common difference {diff}. What is term {n}?',
               str(answer), [str(first+n*diff), str(first+(n-2)*diff), str(n*diff)], rng,
               skill='Arithmetic sequences', level=level,
               explanation=f'aₙ = a₁ + (n − 1)d = {first} + ({n} − 1)({diff}) = {answer}.',
               hint='Use aₙ = a₁ + (n − 1)d. Check whether your index starts at 0 or 1.')


def _series(rng: random.Random, level: int) -> dict:
    first = rng.randint(2, 10); diff = rng.randint(2, 9); n = rng.randint(15, 45)
    ans = n*(2*first+(n-1)*diff)//2
    terms = [first + k*diff for k in range(n)]
    assert sum(terms) == ans
    return _mc(f'The first term of an arithmetic series is {first}, the common difference is {diff}, and there are {n} terms. What is the SUM?',
               str(ans), [str(ans+diff), str(n*(first+diff)), str(ans-n)], rng,
               skill='Series & sigma notation', level=level,
               explanation=f'Sₙ = n[2a₁ + (n − 1)d]/2 = {n}[{2*first} + {n-1}({diff})]/2 = {ans}.',
               hint='Find the last term first, then multiply the average of first and last by the number of terms.')


def _geometric(rng: random.Random, level: int) -> dict:
    first = rng.randint(2, 8); ratio = rng.choice([2, 3]); n = rng.randint(5, 8)
    ans = first * ratio**(n-1)
    return _mc(f'A geometric sequence has first term {first} and common ratio {ratio}. Find the {n}th term.',
               str(ans), [str(first*ratio**n), str(first*ratio*(n-1)), str(first*ratio**(n-2))], rng,
               skill='Geometric sequences', level=level,
               explanation=f'aₙ = a₁r⁽ⁿ⁻¹⁾ = {first}×{ratio}^({n}−1) = {ans}.',
               hint='A geometric sequence multiplies, not adds. The first term uses exponent zero.')


def _probability(rng: random.Random, level: int) -> dict:
    a = rng.randint(6, 25); b = rng.randint(6, 25); c = rng.randint(6, 25); d = rng.randint(6, 25)
    # Given club membership: P(prefers math|club) = a/(a+b)
    f = Fraction(a, a+b)
    options = [str(Fraction(a,a+b)),str(Fraction(a,a+c)),str(Fraction(a,a+b+c+d)),str(Fraction(b,a+b))]
    if len(set(options))<4:
        options = [str(f),str(Fraction(a+1,a+b+1)),str(Fraction(b+1,a+b+1)),str(Fraction(a,a+b+c+d))]
    if len(set(options))<4:
        options=[str(f),str(Fraction(a,a+b+c+d)),str(Fraction(a+1,a+b+2)),str(Fraction(b,a+b+c+d))]
    if len(set(options))<4:
        return _probability(rng, level)
    return _mc(f'A survey found {a} club members like math, {b} club members do not, {c} nonmembers like math, and {d} nonmembers do not. If one CLUB MEMBER is chosen at random, what is the probability they like math?',
               str(f), options[1:],rng,skill='Conditional probability',level=level,
               explanation=f'The condition is club membership: restrict the denominator to {a}+{b}={a+b} club members. Probability = {a}/{a+b} = {f}.',
               hint='Circle the words “club member.” Ignore all nonmembers in the denominator.')


def _functions(rng: random.Random, level: int) -> dict:
    slope = rng.choice([i for i in range(-7, 8) if i]); intercept=rng.randint(-15,15); x1=rng.randint(-8,-1);x2=rng.randint(1,8)
    y1=slope*x1+intercept;y2=slope*x2+intercept
    return _mc(f'A linear function passes through ({x1}, {y1}) and ({x2}, {y2}). What is f(0)?',
               str(intercept), [str(slope),str(y2),str(intercept+slope)],rng,
               skill='Linear functions',level=level,
               explanation=f'Slope = ({y2}−({y1}))/({x2}−({x1})) = {slope}. In y = mx + b, substitute ({x1},{y1}) to get b = {intercept}. Thus f(0) = {intercept}.',
               hint='Calculate the slope from the two points. Then solve for b in y = mx + b.')


def _percent(rng: random.Random, level: int) -> dict:
    start=rng.choice([80,100,120,160,200,240,400]); up=rng.choice([10,20,25,50]); down=rng.choice([10,20,25,50]); ans=Fraction(start*(100+up)*(100-down),10000)
    def fmt(x):return str(int(x)) if x.denominator==1 else f'{float(x):.2f}'.rstrip('0').rstrip('.')
    answer=fmt(ans)
    wrong=[fmt(Fraction(start*(100+up-down),100)),fmt(Fraction(start*(100+up)*(100+down),10000)),fmt(Fraction(start*(100-up)*(100-down),10000))]
    if len(set([answer]+wrong))<4:return _percent(rng, level)
    return _mc(f'A price of ${start} increases by {up}%, then decreases by {down}%. What is the FINAL price in dollars?',
               answer, wrong,rng,skill='Percent change',level=level,
               explanation=f'Multiply sequentially: {start} × (1+{up}/100) × (1−{down}/100) = ${answer}. The percentages use different bases.',
               hint='Do not add percent changes. Multiply by two successive factors.')


def _physics_freefall(rng:random.Random,level:int)->dict:
    t=rng.randint(2,13); initial=rng.randint(0,13);g=10;ans=initial*t+5*t*t
    return _mc(f'A rock moves downward at an initial speed of {initial} m/s. Ignore air resistance and use g = 10 m/s². How far does it fall in {t} seconds?',
               f'{ans} m',[f'{10*t} m',f'{initial*t+10*t*t} m',f'{initial*t+5*t} m'],rng,
               skill='Free fall',level=level,
               explanation=f'Taking downward positive: displacement = v₀t + ½gt² = ({initial})({t}) + ½(10)({t})² = {ans} m.',
               hint='Use displacement = v₀t + ½gt²; the initial downward speed is not always zero.')


def _physics_projectile(rng:random.Random,level:int)->dict:
    speed=rng.randint(8,22);time=rng.randint(2,6);ans=speed*time
    return _mc(f'A ball rolls horizontally from a ledge at {speed} m/s and is airborne for {time} seconds. Neglect drag. How far does it move HORIZONTALLY?',
               f'{ans} m',[f'{5*time*time} m',f'{speed+time} m',f'{speed*time*time} m'],rng,
               skill='Projectile motion',level=level,
               explanation=f'Horizontal acceleration is zero. Horizontal displacement = vₓt = {speed}×{time} = {ans} m. Gravity only changes vertical motion.',
               hint='Separate x and y motion. Gravity does not accelerate the ball horizontally.')


def _physics_average(rng:random.Random,level:int)->dict:
    v1=rng.choice([3,5,8,10]);v2=rng.choice([12,15,20]);t1=rng.randint(2,6);t2=rng.randint(2,6)
    num=v1*t1+v2*t2;den=t1+t2; ans=Fraction(num,den)
    def fmt(x):return str(int(x)) if x.denominator==1 else f'{float(x):.2f}'.rstrip('0').rstrip('.')
    wrong=[fmt(Fraction(v1+v2,2)),fmt(Fraction(num,t1)),fmt(Fraction(num,den+1))]
    if len(set([fmt(ans)]+wrong))<4:return _physics_average(rng,level)
    return _mc(f'A runner travels at {v1} m/s for {t1} seconds, then {v2} m/s for {t2} seconds in the same direction. What is the AVERAGE SPEED in m/s?',
               fmt(ans),wrong,rng,skill='Average speed',level=level,
               explanation=f'Total distance = {v1}×{t1} + {v2}×{t2} = {num} m. Total time = {den} s. Average speed = {num}/{den} = {fmt(ans)} m/s.',
               hint='Compute total distance and total time separately. Do not simply average the two speeds.')


def _physics_graph(rng:random.Random,level:int)->dict:
    t=rng.randint(3,6); v0=rng.randint(2,6); v1=v0+rng.randint(4,9);ans=Fraction(v0+v1,2)*t
    def fmt(x):return str(int(x)) if x.denominator==1 else f'{float(x):.1f}'
    wrong=[fmt(Fraction(v1-v0,t)),fmt(Fraction(v1*t)),fmt(Fraction((v1-v0)*t,2))]
    if len(set([fmt(ans)]+wrong))<4:return _physics_graph(rng,level)
    return _mc(f'The velocity–time graph shows a straight line from ({0} s, {v0} m/s) to ({t} s, {v1} m/s). What is the DISPLACEMENT?',
               f'{fmt(ans)} m',[f'{x} m' for x in wrong],rng,
               skill='Velocity–time graphs',level=level,
               explanation=f'Displacement is area under velocity–time graph: trapezoid area = ({v0}+{v1})/2 × {t} = {fmt(ans)} m.',
               hint='The slope represents acceleration; the AREA under a velocity–time graph represents displacement.',
               graph={'kind':'velocity_time','points':[[0,v0],[t,v1]],'x_label':'Time (s)','y_label':'Velocity (m/s)'})


READING = [
('A city introduced bus lanes while expanding routes. Ridership rose, but an independent survey found that most new riders lived near the expanded routes rather than along the lanes.',
 'Which conclusion is best supported?', 'The route expansion may explain more of the new ridership than the bus lanes.',
 ['The bus lanes caused all new riders to switch from cars.','The route expansion had no effect on travel.','The bus lanes reduced service reliability.'],
 'The survey locates new riders near expanded routes; that supports an association, not proof of causation.', 'Separate the two changes and match the evidence to one of them.', 'Causal inference'),
('Researchers found that plants watered with filtered water grew taller than plants given tap water. However, the filtered-water group also received more sunlight.',
 'Which additional study would BEST test whether water type caused the difference?', 'Give groups equal sunlight while varying water type.',
 ['Give both groups more sunlight and more water.','Measure only the tallest plant from each group.','Compare plants grown in entirely different soils.'],
 'The sunlight difference is a confounder. Hold sunlight constant while changing only water.', 'What variable changed along with the water?', 'Experimental design'),
('An economist wrote, “The policy reduced average commute time.” A second economist noted that commutes fell only in the city center and grew longer in outlying neighborhoods.',
 'How does the second economist qualify the first claim?', 'The citywide average masks uneven neighborhood outcomes.',
 ['The policy had no effect anywhere.','Commute times fell in every neighborhood.','The data must have been fabricated.'],
 'An average can improve even when some groups are worse off; the second claim shows heterogeneity.', 'Distinguish an overall average from the distribution across subgroups.', 'Cross-text connections'),
('A museum replaced lengthy wall labels with short captions. Visitors spent less time reading, yet later recalled more details about individual objects.',
 'Which inference is most defensible?', 'Shorter labels may help visitors focus their attention on objects.',
 ['Short labels guarantee perfect memory.','Visitors stopped engaging with the displays.','Long labels necessarily contain incorrect details.'],
 'The observed association suggests improved focus; it does not prove inevitability or universal effects.', 'Eliminate conclusions with absolute language unsupported by the study.', 'Reading inference'),
('A report tracked changes in a coastal ecosystem. Fish populations recovered after fishing restrictions, although unusually warm currents occurred during the same period.',
 'Which statement best reflects the limits of the evidence?', 'The restrictions may have contributed to recovery, but other changes cannot be excluded.',
 ['Warm currents prove fishing restrictions failed.','The restrictions alone must have caused recovery.','The populations never recovered.'],
 'A simultaneous environmental change prevents attributing all recovery to one policy.', 'Look for a cautious claim that handles competing explanations.', 'Evidence interpretation'),
]

GRAMMAR = [
('The committee reviewed the proposal ____ it requested another cost estimate.', 'before approving it;',
 ['before approving it,','before approving it:','before approving it'],
 'The semicolon separates two independent clauses: “The committee reviewed the proposal before approving it” and “it requested another cost estimate.”',
 'Ask whether both sides of the punctuation can stand as complete sentences.', 'Clause boundaries'),
('Neither the principal nor the teachers ____ available to answer questions.', 'were',
 ['was','is','has been'],
 'With neither/nor, the verb agrees with the nearer subject, “teachers,” which is plural.',
 'Check the noun closest to the verb.', 'Subject-verb agreement'),
('The trial was small; ____, the investigators considered the findings preliminary.', 'therefore',
 ['however','meanwhile','similarly'],
 'Because the sample was small, the investigators treated results cautiously; “therefore” indicates consequence.',
 'Decide whether the second idea contrasts with or follows from the first.', 'Transitions'),
('The architect, ____ designs are featured in the gallery, will speak tonight.', 'whose',
 ['who','whom','which'],
 '“Whose” shows that the designs belong to the architect.',
 'The blank expresses possession, not the subject or object of a verb.', 'Pronoun precision'),
('By the time the train arrived, the passengers ____ for forty minutes.', 'had waited',
 ['wait','will wait','are waiting'],
 'Past perfect marks an action completed before another past action.',
 'Which event happened first, and what tense makes that sequence clear?', 'Verb tense'),
]


def _reading(rng:random.Random,level:int)->dict:
    passage,prompt,answer,wrong,explanation,hint,skill=rng.choice(READING)
    return _mc(f'{passage}\n\n{prompt}',answer,wrong,rng,skill=skill,
               explanation=explanation,hint=hint,level=level)


def _grammar(rng:random.Random,level:int)->dict:
    prompt,answer,wrong,explanation,hint,skill=rng.choice(GRAMMAR)
    return _mc(f'Choose the best revision:\n\n{prompt}',answer,wrong,rng,skill=skill,
               explanation=explanation,hint=hint,level=level)


_FAMILIES={
    'SAT Math': [_linear,_quadratic,_sequence,_series,_geometric,_probability,_functions,_percent],
    'Algebra 2': [_linear,_quadratic,_sequence,_series,_geometric,_functions,_percent],
    'Physics': [_physics_graph,_physics_freefall,_physics_projectile,_physics_average],
    'SAT Reading & Writing': [_reading,_grammar],
    'ACT English': [_grammar],
}


def generate(track: str, seed: str, count: int = 48) -> list[dict]:
    if track not in _FAMILIES: raise ValueError('Unknown learning track')
    if not 1<=count<=120:raise ValueError('Count outside allowed range')
    rng=_rng(track,seed)
    families=_FAMILIES[track]
    result=[]
    for i in range(count):
        # Mix difficult and simpler transfer checks. Cold starts still pick hard first.
        level = 3 if i%5 < 3 else 2 if i%5 == 3 else 1
        family=families[i%len(families)]
        item=family(rng,level)
        item['difficulty_layer']= (1 if family.__name__ in FOUNDATION_FAMILIES else 3 if family.__name__ in ADVANCED_FAMILIES else 2)
        item['problem_metadata']['mastery_seed_key']=f'{track}|{seed}|{i}'
        item['problem_metadata']['track']=track
        result.append(item)
    return result

# Additional independent mathematical families. Their outputs are checked by
# numeric invariants in tests, and each has explicit misconception distractors.

def _system(rng:random.Random,level:int)->dict:
    x=rng.randint(-9,9);y=rng.randint(-8,8)
    a=rng.choice([2,3,4,5]);b=rng.choice([1,2,3]);c=rng.choice([1,3,4,6]);d=rng.choice([1,2,4,5]);
    if a*d==b*c:d+=1
    p=a*x+b*y;q=c*x+d*y
    return _mc(f'The system {a}x {b:+d}y = {p} and {c}x {d:+d}y = {q} has one solution. What is x?',
        str(x),[str(y),str(-x),str(x+2)],rng,skill='Systems of equations',level=level,
        explanation=f'Eliminate y: multiply the first equation by {d} and the second by {b}, then subtract. ({a*d-b*c})x = {p*d-q*b}, hence x = {x}.',
        hint='Use elimination so one variable disappears. Check signs when subtracting.')


def _exponential(rng:random.Random,level:int)->dict:
    base=rng.choice([2,3,4,5]);power=rng.randint(2,5);mult=rng.randint(2,8);value=mult*base**power
    return _mc(f'If {mult}·{base}ˣ = {value}, what is x?',str(power),[str(power-1),str(power+1),str(base*power)],rng,
        skill='Exponents & exponential equations',level=level,
        explanation=f'Divide by {mult} to get {base}ˣ = {base**power} = {base}^{power}. The exponents must match, so x = {power}.',
        hint='Isolate the exponential expression before comparing powers.')


def _vertex(rng:random.Random,level:int)->dict:
    h=rng.choice([n for n in range(-8,9) if n]); k=rng.randint(-12,12);a=rng.choice([-3,-2,-1,1,2,3])
    return _mc(f'The graph of f(x) = {a}(x {(-h):+d})² {k:+d} has vertex (h, k). What is h?',str(h),
        [str(-h),str(k),str(h+1)],rng,skill='Quadratic functions',level=level,
        explanation=f'The vertex form is a(x − h)² + k. In this equation, x {(-h):+d} means x − ({h}); therefore h = {h}.',
        hint='Vertex form is a(x−h)²+k. Beware the sign inside parentheses.')


def _triangle(rng:random.Random,level:int)->dict:
    triple=rng.choice([(3,4,5),(5,12,13),(8,15,17),(7,24,25)]);scale=rng.randint(1,15)
    a,b,c=[t*scale for t in triple]
    return _mc(f'A right triangle has legs of length {a} and {b}. What is the hypotenuse length?',str(c),
        [str(a+b),str(abs(a-b)),str(c+scale)],rng,skill='Geometry & trigonometry',level=level,
        explanation=f'Apply the Pythagorean theorem: c²={a}²+{b}²={a*a+b*b}; c={c}.',
        hint='The square of the hypotenuse is the sum of the squares of the legs.')


def _circle(rng:random.Random,level:int)->dict:
    radius=rng.randint(3,15);angle=rng.choice([30,45,60,90,120]);frac=Fraction(angle,360)*2*radius
    def fmt(f):
        return f'{f.numerator}π' if f.denominator==1 else f'{f.numerator}π/{f.denominator}'
    ans=fmt(frac)
    wrong=[fmt(frac*2),fmt(Fraction(angle,360)*radius),fmt(Fraction(angle,180)*radius*radius)]
    return _mc(f'A circle has radius {radius} and a central angle of {angle}°. What is the exact MINOR ARC length?',ans,wrong,rng,
        skill='Circle geometry',level=level,
        explanation=f'Arc length is angle/360 times circumference: ({angle}/360)(2π·{radius}) = {ans}.',
        hint='Use the fraction of the full 360° circumference, not the sector area.')


def _mean(rng:random.Random,level:int)->dict:
    vals=rng.sample(range(4,32),4);missing=rng.randint(3,29)
    total=sum(vals)+missing;mean=Fraction(total,5)
    if mean.denominator!=1: return _mean(rng,level)
    return _mc(f'Five test scores have a mean of {int(mean)}. Four of them are {", ".join(map(str,vals))}. What is the fifth score?',str(missing),
        [str(missing+5),str(total),str(missing-5)],rng,skill='Data & averages',level=level,
        explanation=f'Five scores sum to 5×{mean}={total}; the given four sum to {sum(vals)}. Missing score = {total} − {sum(vals)} = {missing}.',
        hint='Multiply the mean by the number of scores to find the total.')


def _ratio(rng:random.Random,level:int)->dict:
    x=rng.randint(2,9);y=rng.randint(2,9);k=rng.randint(3,12);a=x*k;b=y*k
    return _mc(f'A recipe uses flour and sugar in the ratio {x}:{y}. If it uses {a} grams of flour, how many grams of sugar are required?',str(b),
        [str(a+y),str(a),str(x*y)],rng,skill='Ratios & proportions',level=level,
        explanation=f'Each ratio unit is {a}/{x}={k} grams. Sugar = {y}×{k} = {b} grams.',
        hint='Find the scale factor from ratio units to actual grams.')


def _sigma(rng:random.Random,level:int)->dict:
    a=rng.randint(2,11);b=rng.randint(-8,8);n=rng.randint(7,25)
    ans=a*n*(n+1)//2+b*n
    return _mc(f'Evaluate Σ from k=1 to {n} of ({a}k {b:+d}).',str(ans),
        [str(ans+a*n),str(ans-a*n),str(ans+b*n+a)],rng,
        skill='Sigma notation',level=level,
        explanation=f'Σ({a}k {b:+d}) = {a}Σk + {b}Σ1 = {a}·{n}({n}+1)/2 + ({b})·{n} = {ans}.',
        hint='Split the sum into a multiple of Σk and n copies of the constant.')


def _geosum(rng:random.Random,level:int)->dict:
    first=rng.randint(2,7);ratio=rng.choice([2,3]);n=rng.randint(5,8)
    ans=first*(ratio**n-1)//(ratio-1)
    return _mc(f'A geometric SERIES has first term {first}, common ratio {ratio}, and {n} terms. Find its sum.',str(ans),
        [str(first*ratio**(n-1)),str(ans+first),str(first*(ratio**(n-1)-1)//(ratio-1))],rng,
        skill='Geometric series',level=level,
        explanation=f'Sₙ = a₁(rⁿ−1)/(r−1) = {first}({ratio}^{n}−1)/({ratio}−1) = {ans}.',
        hint='Use the sum formula, not the nth-term formula.')


def _physics_acceleration(rng:random.Random,level:int)->dict:
    v0=rng.randint(-6,8);a=rng.choice([n for n in range(-6,7) if n]);t=rng.randint(3,9);v=v0+a*t
    return _mc(f'An object changes velocity at a constant rate from {v0} m/s to {v} m/s over {t} s. What is its acceleration?',
        f'{a} m/s²',[f'{v-v0} m/s²',f'{v0+v} m/s²',f'{a+2} m/s²'],rng,skill='Acceleration',level=level,
        explanation=f'a = Δv/Δt = ({v}−({v0}))/{t} = {a} m/s².',
        hint='Acceleration is the change in velocity divided by time.')


def _physics_force(rng:random.Random,level:int)->dict:
    mass=rng.randint(2,13);a=rng.randint(2,9);ans=mass*a
    return _mc(f'A {mass} kg cart accelerates at {a} m/s². What net horizontal force acts on the cart?',
        f'{ans} N',[f'{mass+a} N',f'{mass} N',f'{a} N'],rng,skill='Newton’s second law',level=level,
        explanation=f'Newton’s second law gives net force F=ma={mass}×{a}={ans} N.',
        hint='Multiply mass by acceleration; do not confuse net force with velocity.')


def _physics_position(rng:random.Random,level:int)->dict:
    x0=rng.randint(-8,9);speed=rng.choice([n for n in range(-7,8) if n]);t=rng.randint(3,8);x1=x0+speed*t
    distractors=[f'{x1} m/s',f'{speed*t} m/s',f'{-speed} m/s']
    if len(set([f'{speed} m/s']+distractors))<4:return _physics_position(rng,level)
    return _mc(f'The position–time graph joins (0 s, {x0} m) and ({t} s, {x1} m) with a straight line. What is the velocity?',
        f'{speed} m/s',distractors,rng,skill='Position–time graph translation',level=level,
        explanation=f'Velocity equals position–time slope: ({x1}−({x0}))/({t}−0) = {speed} m/s. A straight line implies constant velocity.',
        hint='Take rise in position divided by run in time. The graph’s height is not speed.',
        graph={'kind':'position_time','points':[[0,x0],[t,x1]],'x_label':'Time (s)','y_label':'Position (m)'})


def _physics_velocity_sign(rng:random.Random,level:int)->dict:
    v=rng.randint(2,12);t=rng.randint(2,7)
    return _mc(f'A velocity–time graph is a horizontal line at −{v} m/s from t=0 to t={t} s. What is the displacement?',
        f'−{v*t} m',[f'{v*t} m',f'0 m',f'−{v} m'],rng,skill='Velocity–time graphs',level=level,
        explanation=f'Displacement is signed area under the v–t graph: (−{v})({t})=−{v*t} m.',
        hint='A line below the time axis has negative signed area; speed stays positive but displacement can be negative.',
        graph={'kind':'velocity_time','points':[[0,-v],[t,-v]],'x_label':'Time (s)','y_label':'Velocity (m/s)'})


def _physics_avgvelocity(rng:random.Random,level:int)->dict:
    east=rng.randint(90,240)//10*10;west=rng.randint(20,80)//10*10;time=rng.choice([20,25,40,50]);ans=Fraction(east-west,time)
    def fmt(x):return f'{float(x):.2f}'.rstrip('0').rstrip('.')
    options=[f'{fmt(ans)} m/s east',f'{fmt(Fraction(east+west,time))} m/s east',f'{fmt(Fraction(east-west,time+10))} m/s east',f'{fmt(Fraction(east,time))} m/s east']
    if len(set(options))<4:return _physics_avgvelocity(rng,level)
    return _mc(f'A student walks {east} m east then {west} m west in {time} s. What is their AVERAGE VELOCITY (nearest hundredth)?',options[0],options[1:],rng,
        skill='Average velocity vs. speed',level=level,
        explanation=f'Net displacement is {east}−{west}={east-west} m east. Divide by {time} s to obtain {fmt(ans)} m/s east. Distance would use {east+west} m.',
        hint='Velocity uses signed displacement, not total distance.')


def _physics_projectile_height(rng:random.Random,level:int)->dict:
    t=rng.randint(2,7);speed=rng.randint(8,22);h=5*t*t
    return _mc(f'A ball leaves a cliff horizontally at {speed} m/s and lands after {t} s. With g=10 m/s² and negligible drag, how high is the cliff?',
        f'{h} m',[f'{speed*t} m',f'{10*t} m',f'{10*t*t} m'],rng,skill='Projectile motion',level=level,
        explanation=f'Horizontal speed does not affect the fall time. The vertical drop is (1/2)gt² = 5×{t}² = {h} m.',
        hint='Ignore the horizontal speed. Use the vertical motion equation from rest.')


def _physics_science(rng:random.Random,level:int)->dict:
    # ACT Science: an original tabular experimental comparison (not a full passage).
    values=sorted(rng.sample(range(10,38),4));t=rng.choice([5,10,15]);scale=rng.randint(2,5)
    x=values[0];p=values[1];q=values[2];r=values[3]
    prompt=(f'A controlled experiment recorded sensor output in four test chambers after {t} days. '
            f'At temperatures {x}°C, {p}°C, {q}°C, and {r}°C, sensor readings were '
            f'{x*scale}, {p*scale}, {q*scale}, and {r*scale} units, respectively. '
            'What result is DIRECTLY supported by these recorded data?')
    answer='Higher temperatures coincided with higher recorded sensor readings in these four chambers.'
    return _mc(prompt,answer,['Temperature has been proven to raise every type of sensor reading in all experiments.',
        'The recorded sensor values were constant across all four chambers.',
        'The experiment establishes that the sensor caused the temperature increases.'],rng,
        skill='ACT Science data interpretation',level=level,
        graph={'kind':'science_scatter','points':[[x,x*scale],[p,p*scale],[q,q*scale],[r,r*scale]],'x_label':'Temperature (°C)','y_label':'Sensor reading'},
        explanation=f'In this table, sensor output rises in the same order as temperature ({x*scale} to {r*scale}). The data do not establish a universal law or reverse causation.',
        hint='Separate the measured pattern from a universal causal claim.')


from mastery_ext.language_bank import READING as CURATED_READING, GRAMMAR as CURATED_GRAMMAR

_FAMILIES.update({
 'SAT Math':[_linear,_quadratic,_sequence,_series,_geometric,_probability,_functions,_percent,
             _system,_exponential,_vertex,_triangle,_circle,_mean,_ratio,_sigma,_geosum],
 'ACT Math':[_linear,_quadratic,_system,_exponential,_vertex,_triangle,_circle,_mean,_ratio,_percent,_probability,_functions],
 'Algebra 2':[_linear,_quadratic,_sequence,_series,_geometric,_functions,_sigma,_geosum,_system,_exponential,_vertex,_percent],
 'Physics':[_physics_graph,_physics_freefall,_physics_projectile,_physics_average,_physics_acceleration,
             _physics_force,_physics_position,_physics_velocity_sign,_physics_avgvelocity,_physics_projectile_height],
 'ACT Science':[_physics_science,_physics_graph,_physics_average,_physics_acceleration],
 'SAT Reading & Writing':[_reading,_grammar],
 'ACT Reading':[_reading],
 'ACT English':[_grammar],
})
TRACKS = tuple(_FAMILIES)


def generate_verified(track: str, seed: str, count: int = 96) -> list[dict]:
    """Deterministic, locally generated numerical practice and finite verbal drills.

    Verbal questions are drawn from authored records and are never presented as
    limitless unique items; `count` above the authored pool is capped.
    """
    if track not in _FAMILIES:
        raise ValueError('Unknown learning track')
    if not 1 <= count <= 400:
        raise ValueError('Count must be 1..400')
    rng=_rng(track,seed)
    if track in ('SAT Reading & Writing','ACT Reading','ACT English'):
        if track=='SAT Reading & Writing':
            pool=[(v,'reading') for v in CURATED_READING]+[(v,'grammar') for v in CURATED_GRAMMAR]
        elif track=='ACT Reading':pool=[(v,'reading') for v in CURATED_READING]
        else:pool=[(v,'grammar') for v in CURATED_GRAMMAR]
        rng.shuffle(pool)
        out=[]
        for i,(entry,kind) in enumerate(pool[:count]):
            passage,prompt,answer,wrong,explanation,hint,skill=entry if kind=='reading' else (*entry[:1], None,*entry[1:])
            if kind=='reading': question=f'{passage}\n\n{prompt}'
            else: question=f'Choose the best completion:\n\n{entry[0]}'
            item=_mc(question,answer,wrong,rng,skill=skill,level=(3 if skill in {'Causal inference','Evaluating statistical claims','Cross-text connections','Evidence interpretation','Experimental design','Clause boundaries','Modifiers'} else 1 if skill=='Word choice' else 2),
                     explanation=explanation,hint=hint)
            item['problem_metadata']['mastery_seed_key']=f'curated|{track}|{hashlib.sha256(question.encode()).hexdigest()[:20]}'
            item['problem_metadata']['track']=track
            item['problem_metadata']['question_hash']=hashlib.sha256(question.encode()).hexdigest()[:20]
            item['problem_metadata']['authored']=True
            out.append(item)
        return out
    families=_FAMILIES[track]
    out=[];seen=set()
    for i in range(count):
        family=families[i%len(families)]
        level=3 if i%5<3 else 2 if i%5==3 else 1
        for attempt in range(150):
            try:item=family(rng,level)
            except (ValueError, ZeroDivisionError):continue
            normalized=' '.join(item['question'].split()).casefold()
            if normalized not in seen:break
        else:raise ValueError(f'Failed to generate distinct question in {family.__name__}')
        seen.add(normalized)
        item['difficulty_layer']= (1 if family.__name__ in FOUNDATION_FAMILIES else 3 if family.__name__ in ADVANCED_FAMILIES else 2)
        item['problem_metadata']['mastery_seed_key']=f'{track}|{seed}|{i}'
        item['problem_metadata']['track']=track
        item['problem_metadata']['question_hash']=hashlib.sha256(item['question'].encode()).hexdigest()[:20]
        item['problem_metadata']['family']=family.__name__
        out.append(item)
    return out

# Higher-order transfer problems, all built from explicit mathematical
# constructions rather than free-form model text.

def _rational_equation(rng:random.Random,level:int)->dict:
    x=rng.randint(-11,12);b=x+rng.choice([-7,-5,-4,-3,3,4,5,7]);k=rng.choice([-4,-3,-2,2,3,4]);a=x-k*(x-b)
    assert x!=b and Fraction(x-a,x-b)==k
    return _mc(f'For x ≠ {b}, solve the rational equation (x {(-a):+d}) / (x {(-b):+d}) = {k}. What is x?',
        str(x),[str(b),str(a),str(x+k)],rng,skill='Rational equations',level=3,
        explanation=f'Multiply both sides by x−({b}): x−({a}) = {k}(x−({b})). Collect terms to get x={x}. The excluded value x={b} is not used.',
        hint='Multiply through by the denominator; then test the result against the excluded value.')


def _roots_sum_difference(rng:random.Random,level:int)->dict:
    u,v=rng.sample([n for n in range(-13,14) if n],2)
    sum_roots=u+v;delta=abs(u-v);prod=u*v
    return _mc(f'The two distinct real roots of a monic quadratic have sum {sum_roots} and their DIFFERENCE in absolute value is {delta}. What is their PRODUCT?',
        str(prod),[str(sum_roots*delta),str(prod+delta),str(-prod)],rng,
        skill='Quadratic root relationships',level=3,
        explanation=f'Let the roots be r₁ and r₂. Using r₁+r₂={sum_roots} and |r₁−r₂|={delta}, the roots are ({sum_roots}+{delta})/2 and ({sum_roots}−{delta})/2: {max(u,v)} and {min(u,v)}. Their product is {prod}.',
        hint='Solve for the roots from their sum and difference, then multiply. Vieta’s formulas also help.')


def _composite_inverse(rng:random.Random,level:int)->dict:
    a=rng.choice([-5,-4,-3,2,3,4,5]);b=rng.randint(-15,15);c=rng.choice([-4,-3,-2,2,3,4]);d=rng.randint(-12,12);x=rng.randint(-8,9)
    target=a*(c*x+d)+b
    return _mc(f'Let f(x)={a}x {b:+d} and g(x)={c}x {d:+d}. If f(g(t))={target}, what is t?',
        str(x),[str(x+1),str(-x),str(c*x+d)],rng,
        skill='Function composition',level=3,
        explanation=f'First compose: f(g(t))={a}({c}t {d:+d}) {b:+d}. Set equal to {target}: {a*c}t {a*d+b:+d} = {target}. Solve to get t={x}.',
        hint='Write f(g(t)) first. Undo the OUTER function before undoing the inner one.')


def _two_dials(rng:random.Random,level:int)->dict:
    r=rng.randint(2,6);s=rng.randint(2,6);a=rng.randint(2,8);b=rng.randint(2,8)
    if r==s:s+=1
    x=rng.randint(4,16);y=rng.randint(4,16)
    cost1=a+r*x;cost2=b+s*x
    # Rather than arbitrary fixed fee solutions, derive a break-even time as root.
    fixed1=rng.randint(3,35);fixed2=fixed1+(r-s)*x
    if fixed2<0:return _two_dials(rng,level)
    assert fixed1+r*x==fixed2+s*x
    return _mc(f'Two delivery services charge a base fee plus a per-mile fee. Service A charges ${fixed1} plus ${r} per mile; B charges ${fixed2} plus ${s} per mile. At how many miles do they charge the SAME total?',
        str(x),[str(x+2),str(abs(fixed2-fixed1)),str(x-2)],rng,
        skill='Linear model comparison',level=3,
        explanation=f'Set costs equal: {fixed1}+{r}m={fixed2}+{s}m, so ({r}−{s})m={fixed2-fixed1} and m={x}.',
        hint='Create one expression for each service and solve where they intersect.')


def _conditional_drawing(rng:random.Random,level:int)->dict:
    red=rng.randint(4,16);blue=rng.randint(4,16);green=rng.randint(3,12)
    p=Fraction(red,red+green+blue-1)
    wrong=[str(Fraction(red,red+blue+green)),str(Fraction(red,red+blue)),str(Fraction(red-1,red+blue+green-1))]
    if len(set([str(p)]+wrong))<4:return _conditional_drawing(rng,level)
    return _mc(f'A bag has {red} red, {blue} blue, and {green} green counters. Two are drawn without replacement. GIVEN that the first counter is BLUE, what is the probability the second is RED?',
        str(p),wrong,rng,skill='Conditional probability',level=3,
        explanation=f'One blue is already removed. There are {red+blue+green-1} counters left and still {red} red; conditional probability = {red}/{red+blue+green-1} = {p}.',
        hint='Update BOTH the total and the color count after the first known draw.')


def _quadratic_intersection(rng:random.Random,level:int)->dict:
    h=rng.randint(-11,11);k=rng.randint(-9,9);a=rng.choice([-4,-2,-1,1,2,3,4]);offset=rng.randint(3,9)
    level_y=k+a*offset**2;right=h+offset
    return _mc(f'The parabola y={a}(x {(-h):+d})² {k:+d} intersects the horizontal line y={level_y} at two points. What is the LARGER x-coordinate?',
        str(right),[str(h-offset),str(level_y),str(offset)],rng,
        skill='Quadratic functions',level=3,
        explanation=f'Set {a}(x−({h}))²+({k})={level_y}, so (x−({h}))²={offset**2}. Therefore x={h}±{offset}; the larger coordinate is {right}.',
        hint='Subtract the vertical shift and divide by the coefficient before taking both square roots.')


def _velocity_two_segments(rng:random.Random,level:int)->dict:
    v0=rng.randint(5,14);t1=rng.randint(3,7);t2=rng.randint(2,7);v1=-rng.randint(3,10)
    signed=Fraction(v0*t1+v1*t2)
    wrong=[str(Fraction(v0*t1-v1*t2)),str(Fraction((v0+v1)*(t1+t2),2)),str(Fraction(v0*t1))]
    if len(set([str(signed)]+wrong))<4:return _velocity_two_segments(rng,level)
    return _mc(f'A velocity–time graph is horizontal at +{v0} m/s from 0 to {t1} seconds, then horizontal at {v1} m/s from {t1} to {t1+t2} seconds. Find TOTAL SIGNED DISPLACEMENT.',
        f'{signed} m',[f'{w} m' for w in wrong],rng,skill='Velocity–time graphs',level=3,
        explanation=f'Add signed areas: first segment {v0}×{t1}={v0*t1} m; second {v1}×{t2}={v1*t2} m. Net displacement is {signed} m. The negative segment subtracts displacement.',
        hint='Compute each rectangle’s signed area. Above the axis is positive; below is negative.',
        graph={'kind':'velocity_time_steps','points':[[0,v0],[t1,v0],[t1,v1],[t1+t2,v1]],
               'x_label':'Time (s)','y_label':'Velocity (m/s)'})


def _projectile_time_height(rng:random.Random,level:int)->dict:
    vy=rng.choice([20,30,40,50]);vx=rng.randint(5,30);g=10;peak=vy*vy//(2*g)
    wrong=[f'{vy*vy//g} m',f'{vx*vy//g} m',f'{vy//g} m']
    if len(set([f'{peak} m']+wrong))<4:return _projectile_time_height(rng,level)
    return _mc(f'A projectile leaves level ground with horizontal speed {vx} m/s and upward speed {vy} m/s. With g=10 m/s² and no drag, what is its MAXIMUM VERTICAL HEIGHT?',
        f'{peak} m',wrong,rng,skill='Projectile motion',level=3,
        explanation=f'At the top vᵧ=0. From vᵧ²=v₀ᵧ²−2gH, H=({vy})²/(2×10)={peak} m. Horizontal speed does not affect vertical height.',
        hint='Use only the initial vertical speed. At peak height vertical velocity is zero.')

_FAMILIES['SAT Math'].extend([_rational_equation,_roots_sum_difference,_composite_inverse,_two_dials,_conditional_drawing,_quadratic_intersection])
_FAMILIES['ACT Math'].extend([_rational_equation,_roots_sum_difference,_composite_inverse,_two_dials,_conditional_drawing,_quadratic_intersection])
_FAMILIES['Algebra 2'].extend([_rational_equation,_roots_sum_difference,_composite_inverse,_quadratic_intersection])
_FAMILIES['Physics'].extend([_velocity_two_segments,_projectile_time_height])
_FAMILIES['ACT Science'].extend([_velocity_two_segments,_projectile_time_height])

# Structural difficulty is grounded in the operations required; never label a
# basic single-step exercise as 'advanced' just because of a random seed.
FOUNDATION_FAMILIES={'_linear','_triangle','_ratio','_physics_force','_physics_acceleration',
 '_physics_freefall','_physics_projectile','_geometric','_sequence','_exponential'}
ADVANCED_FAMILIES={'_rational_equation','_roots_sum_difference','_composite_inverse',
 '_two_dials','_conditional_drawing','_quadratic_intersection','_velocity_two_segments',
 '_projectile_time_height','_physics_graph','_physics_avgvelocity','_probability','_physics_position'}
# A technical drill can be hard for one student, but difficulty labels here
# describe structural complexity, not measured exam percentiles.

# Real contrasting levels for repair and transfer. These items assess the SAME
# skill as their harder family, with meaningfully fewer reasoning steps.
def _conditional_foundation(rng: random.Random, level: int) -> dict:
    red, blue = rng.randint(3, 19), rng.randint(3, 18)
    answer = str(Fraction(red, red + blue))
    distractors = [str(Fraction(red,blue)),str(Fraction(blue,red+blue)),str(Fraction(red,red+blue+1))]
    if len(set([answer]+distractors)) != 4: return _conditional_foundation(rng,level)
    return _mc(f'A bag contains {red} red and {blue} blue tokens. A token is known to come from THIS bag. What is the probability it is red?',
       answer,distractors,rng,skill='Conditional probability',level=1,
       explanation=f'The sample space is this bag: {red}+{blue}={red+blue} tokens. Of these, {red} are red, so P(red)={red}/{red+blue}={answer}.',
       hint='The probability denominator must count only equally likely outcomes in the sample space.')


def _composition_forward(rng: random.Random, level: int) -> dict:
    a=rng.randint(2,6); b=rng.randint(-8,8); c=rng.randint(2,5); d=rng.randint(-8,8); x=rng.randint(-4,7)
    inner=c*x+d; result=a*inner+b
    wrong=[str(c*(a*x+b)+d),str(a*x+b),str(inner)]
    if len(set([str(result)]+wrong))!=4:return _composition_forward(rng,level)
    return _mc(f'Let f(x)={a}x {b:+d} and g(x)={c}x {d:+d}. Find f(g({x})).',str(result),wrong,rng,
       skill='Function composition',level=2,
       explanation=f'First compute g({x})={c}({x})+({d})={inner}. Then f({inner})={a}({inner})+({b})={result}.',
       hint='Start with the inner function g; then substitute its result into f.')


def _rational_exclusion(rng: random.Random, level: int) -> dict:
    a=rng.randint(-9,9); b=rng.randint(-12,12)
    if a==b:b+=2
    options=[str(b),str(a),str(-b),str(b+1)]
    if len(set(options))!=4:return _rational_exclusion(rng,level)
    return _mc(f'For the rational expression (x {(-a):+d})/(x {(-b):+d}), which value of x must be EXCLUDED from the domain?',
       str(b),options[1:],rng,skill='Rational equations',level=1,
       explanation=f'The denominator is x−({b}). Setting it equal to zero yields x={b}; division by zero is undefined.',
       hint='Set the denominator—not the numerator—equal to zero.')


def _velocity_constant(rng: random.Random, level: int) -> dict:
    v=rng.choice([i for i in range(-12,13) if i]);t=rng.randint(2,12);answer=v*t
    wrong=[str(abs(v)*t),str(v+t),str(v*t+v)]
    if len(set([str(answer)]+wrong))!=4:return _velocity_constant(rng,level)
    return _mc(f'A velocity–time graph is horizontal at {v} m/s from t=0 to t={t} s. What is the SIGNED DISPLACEMENT?',
       f'{answer} m',[f'{x} m' for x in wrong],rng,skill='Velocity–time graphs',level=1,
       explanation=f'Signed displacement is rectangular area v×Δt=({v})({t})={answer} m. A negative velocity yields negative displacement.',
       hint='Find the signed rectangle area; do not replace negative velocity by positive speed.',
       graph={'kind':'velocity_time','points':[[0,v],[t,v]],'x_label':'Time (s)','y_label':'Velocity (m/s)'})


def _model_substitution(rng: random.Random, level: int) -> dict:
    base=rng.randint(3,25);rate=rng.randint(2,9);n=rng.randint(3,20);answer=base+rate*n
    wrong=[str(rate*n),str(base*n+rate),str(base+rate+n)]
    if len(set([str(answer)]+wrong))!=4:return _model_substitution(rng,level)
    return _mc(f'A delivery firm charges ${base} plus ${rate} per mile. What is the TOTAL charge for {n} miles?',
       str(answer),wrong,rng,skill='Linear model comparison',level=1,
       explanation=f'Total = fixed charge + per-mile charge × miles = {base}+{rate}×{n}=${answer}.',
       hint='A fixed fee is charged only once; multiply the rate by the number of miles.')


def _sum_roots_basic(rng: random.Random, level: int) -> dict:
    r=rng.randint(-12,12); s=rng.randint(-12,12)
    if r==s: s+=3
    total=r+s;wrong=[str(r*s),str(r-s),str(-total)]
    if len(set([str(total)]+wrong))!=4:return _sum_roots_basic(rng,level)
    return _mc(f'Two real roots are {r} and {s}. What is the SUM of the roots?',str(total),wrong,rng,
       skill='Quadratic root relationships',level=1,
       explanation=f'Add both roots, including signs: ({r})+({s})={total}.',
       hint='The word SUM means addition, not multiplication.')


def _arithmetic_reverse(rng: random.Random, level: int) -> dict:
    a=rng.randint(-12,13);d=rng.choice([i for i in range(-9,10) if i]);n=rng.randint(9,28)
    last=a+(n-1)*d;wrong=[str(d+1),str(last-a),str(-d)]
    if len(set([str(d)]+wrong))!=4:return _arithmetic_reverse(rng,level)
    return _mc(f'An arithmetic sequence has first term {a} and {n}th term {last}. What is the COMMON DIFFERENCE?',
       str(d),wrong,rng,skill='Arithmetic sequences',level=3,
       explanation=f'aₙ=a₁+(n−1)d, so ({last})=({a})+({n-1})d. Thus d=({last}−({a}))/{n-1}={d}.',
       hint='Solve aₙ=a₁+(n−1)d for d rather than computing another term.')


def _freefall_interval(rng: random.Random, level: int) -> dict:
    v=rng.randint(0,12);start=rng.randint(2,6);duration=rng.randint(2,5)
    end=start+duration;distance=v*duration+5*(end**2-start**2)
    wrong=[str(v*duration+5*duration**2),str(v*end+5*end**2),str(10*(end-start))]
    if len(set([str(distance)]+wrong))!=4:return _freefall_interval(rng,level)
    return _mc(f'From time t=0, a rock falls downward with initial speed {v} m/s and g=10 m/s². How far does it travel BETWEEN t={start} s and t={end} s?',
       f'{distance} m',[f'{w} m' for w in wrong],rng,skill='Free fall',level=3,
       explanation=f'Find total distance s(t)={v}t+5t². The interval distance is s({end})−s({start})={v}×({duration})+5({end}²−{start}²)={distance} m.',
       hint='Compute position at BOTH times and subtract. Acceleration has already been acting before the interval.')


def _linear_nested(rng: random.Random, level: int) -> dict:
    root=rng.choice([i for i in range(-10,11) if i]);a=rng.randint(2,8);b=rng.randint(-8,8);c=rng.randint(-9,9)
    if c==0:c=3
    # a[2(x+b)-c] + d = e(x+b), with chosen root.
    e=rng.choice([i for i in range(1,13) if i != 2*a])
    d=e*(root+b)-a*(2*(root+b)-c)
    answer=str(root); wrong=[str(-root),str(root+1),str(root-2)]
    if len(set([answer]+wrong))!=4:return _linear_nested(rng,level)
    return _mc(f'Solve for x: {a}[2(x {b:+d}) {(-c):+d}] {d:+d} = {e}(x {b:+d})',
       answer,wrong,rng,skill='Linear equations',level=3,
       explanation=f'Distribute both brackets: {2*a}x {2*a*b-a*c+d:+d} = {e}x {e*b:+d}. Collect x terms: ({2*a-e})x={e*b-(2*a*b-a*c+d)}. Thus x={root}.',
       hint='Expand the INNER parentheses before multiplying by the outer coefficient.')


def _simple_quadratic_vertex(rng: random.Random, level: int) -> dict:
    h=rng.randint(-13,13); k=rng.randint(-13,13);a=rng.choice([-3,-2,1,2,3]);wrong=[str(-h),str(k),str(h+k)]
    if len(set([str(h)]+wrong))!=4:return _simple_quadratic_vertex(rng,level)
    return _mc(f'The parabola y={a}(x {(-h):+d})² {k:+d} What is the x-coordinate of its vertex?',str(h),wrong,rng,
       skill='Quadratic functions',level=1,
       explanation=f'Vertex form y=a(x−h)²+k gives h={h}, since the value inside the parentheses is x−({h}).',
       hint='Compare the equation with y=a(x−h)²+k. Reverse the sign inside the parentheses.')


# These are original, constrained scaffold generators, not recycled higher-level
# questions with an artificially lowered difficulty tag.
_FAMILIES['SAT Math'].extend([_conditional_foundation,_composition_forward,_rational_exclusion,
  _model_substitution,_sum_roots_basic,_arithmetic_reverse,_linear_nested,_simple_quadratic_vertex])
_FAMILIES['ACT Math'].extend([_conditional_foundation,_composition_forward,_rational_exclusion,
  _model_substitution,_sum_roots_basic,_linear_nested,_simple_quadratic_vertex])
_FAMILIES['Algebra 2'].extend([_composition_forward,_rational_exclusion,_sum_roots_basic,
  _arithmetic_reverse,_linear_nested,_simple_quadratic_vertex])
_FAMILIES['Physics'].extend([_velocity_constant,_freefall_interval])
_FAMILIES['ACT Science'].extend([_velocity_constant,_freefall_interval])
FOUNDATION_FAMILIES.update({'_conditional_foundation','_rational_exclusion','_velocity_constant',
 '_model_substitution','_sum_roots_basic','_simple_quadratic_vertex'})
ADVANCED_FAMILIES.update({'_arithmetic_reverse','_freefall_interval','_linear_nested'})

# These constrained experimental-science families replace the overreliance on
# physics calculations in ACT Science packs. The underlying OpenTutor document
# ingest and worksheet support are unchanged.
from mastery_ext.science_bank import SCIENCE_FAMILIES
_FAMILIES['ACT Science'] = SCIENCE_FAMILIES + [_physics_science, _physics_graph,
    _velocity_two_segments]
FOUNDATION_FAMILIES.update({'_identify_control','_proportional_slope'})
ADVANCED_FAMILIES.update({'_rate_from_measurements','_controlled_comparison',
                          '_calibration_interpolation','_sample_bias'})

# Additional explicit difficulty contrasts for timed physics drills and geometry.
def _average_speed_foundation(rng: random.Random, level: int) -> dict:
    speed=rng.randint(2,13);duration=rng.randint(2,12);distance=speed*duration
    wrong=[str(speed+duration),str(distance+speed),str(duration)]
    if len(set([str(distance)]+wrong))<4:return _average_speed_foundation(rng,level)
    return _mc(f'A cyclist travels at a constant speed of {speed} m/s for {duration} seconds. How many METERS does the cyclist cover?',
       str(distance),wrong,rng,skill='Average speed',level=1,
       explanation=f'With constant speed, distance = speed × time = {speed} × {duration} = {distance} m.',
       hint='Multiply the speed by the elapsed time.')


def _average_speed_multileg(rng: random.Random, level: int) -> dict:
    speeds=[rng.randint(3,15),rng.randint(5,20),rng.randint(2,13)]
    times=[rng.randint(2,7),rng.randint(3,9),rng.randint(3,8)]
    num=sum(s*t for s,t in zip(speeds,times));den=sum(times)
    answer=round(num/den,2)
    wrong=[round(sum(speeds)/3,2),round(num/times[0],2),round(num/(den+3),2)]
    if len(set([answer]+wrong))<4:return _average_speed_multileg(rng,level)
    return _mc(f'A runner travels at {speeds[0]} m/s for {times[0]} s, then {speeds[1]} m/s for {times[1]} s, then {speeds[2]} m/s for {times[2]} s. What is the AVERAGE SPEED in m/s, rounded to 2 decimal places?',
       f'{answer:.2f}',[f'{w:.2f}' for w in wrong],rng,
       skill='Average speed',level=3,
       explanation=f'Total distance = {speeds[0]}×{times[0]} + {speeds[1]}×{times[1]} + {speeds[2]}×{times[2]} = {num} m. Total time = {den} s; average speed = {num}/{den} = {answer:.2f} m/s.',
       hint='Compute each leg’s distance, add all distances, and divide by total time; do not average the three speeds directly.')


def _average_velocity_foundation(rng: random.Random, level: int) -> dict:
    east=rng.randint(10,100);seconds=rng.randint(5,30)
    correct='0 m/s';wrong=[f'{Fraction(2*east,seconds)} m/s east',f'{Fraction(east,seconds)} m/s east',f'{Fraction(east,seconds)} m/s west']
    if len(set([correct]+wrong))<4:return _average_velocity_foundation(rng,level)
    return _mc(f'A person walks {east} m east and then {east} m west, returning to the starting point after {seconds} s in total. What is the average VELOCITY?',
       correct,wrong,rng,skill='Average velocity vs. speed',level=1,
       explanation=f'Net displacement is {east}−{east}=0 m. Average velocity = displacement/time = 0/{seconds} = 0 m/s; average SPEED would be positive.',
       hint='Velocity depends on displacement. Where did the person finish relative to where they started?')


def _right_triangle_missing_leg(rng: random.Random, level: int) -> dict:
    triple=rng.choice([(3,4,5),(5,12,13),(8,15,17),(7,24,25)]); scale=rng.randint(3,13)
    a,b,c=[n*scale for n in triple]
    correct=str(b);wrong=[str(a),str(c),str(c-a)]
    if len(set([correct]+wrong))<4:return _right_triangle_missing_leg(rng,level)
    return _mc(f'A right triangle has hypotenuse {c} and one leg {a}. Find the OTHER leg.',
       correct,wrong,rng,skill='Geometry & trigonometry',level=3,
       explanation=f'By the Pythagorean theorem, missing leg² = {c}²−{a}² = {b*b}; therefore the missing leg = {b}. You must subtract SQUARES, not lengths.',
       hint='Solve b²=c²−a². The hypotenuse is the longest side.')

_FAMILIES['Physics'].extend([_average_speed_foundation,_average_speed_multileg,_average_velocity_foundation])
_FAMILIES['SAT Math'].append(_right_triangle_missing_leg)
_FAMILIES['ACT Math'].append(_right_triangle_missing_leg)
_FAMILIES['ACT Science'] = SCIENCE_FAMILIES + [_physics_science,_physics_graph,_velocity_two_segments]
FOUNDATION_FAMILIES.update({'_rate_foundation','_variation_foundation','_sample_scope_foundation',
 '_average_speed_foundation','_average_velocity_foundation'})
ADVANCED_FAMILIES.update({'_average_speed_multileg','_right_triangle_missing_leg','_precision_vs_accuracy'})
