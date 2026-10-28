"""Deterministic ACT-style science reasoning practice; not official ACT items.

Every question arises from a constrained experiment or table with a checkable
solution. Unlike a physics word problem, these target measurement, comparison,
controls, rate of change, and evidence limits. Designed for offline use.
"""
from __future__ import annotations
from fractions import Fraction
import random
from mastery_ext.practice_bank import _mc


def _rate_from_measurements(rng: random.Random, level: int) -> dict:
    """Two consecutive intervals with different rates; infer the latter."""
    start=rng.randint(8,35); early=rng.randint(2,9); late=rng.choice([i for i in range(2,11) if i!=early]); dt=rng.randint(2,8)
    middle=start+early*dt; end=middle+late*dt
    distractors=[str(early), str(Fraction(end-start,2*dt)), str(end-middle)]
    if len(set([str(late)]+distractors))<4:return _rate_from_measurements(rng,level)
    return _mc(f'An enzyme experiment records product concentration (µmol/L) at equally spaced times: at 0 min: {start}; at {dt} min: {middle}; at {2*dt} min: {end}. What is the AVERAGE production rate during the SECOND interval, in µmol/L per minute?',
      str(late), distractors, rng,skill='ACT Science rates and trends',level=3,
      explanation=f'Use only the second interval: ({end}−{middle})/({2*dt}−{dt})={end-middle}/{dt}={late} µmol/L/min.',
      hint='Second interval means subtract the middle measurement from the final measurement, then divide by elapsed minutes.',
      graph={'kind':'science_scatter','points':[[0,start],[dt,middle],[2*dt,end]],'x_label':'Time (min)','y_label':'Product (µmol/L)'})


def _controlled_comparison(rng: random.Random, level: int) -> dict:
    temp=rng.choice([15,20,25,30]); base=rng.randint(15,40); treatment=rng.randint(3,17); temp_delta=rng.randint(4,13)
    if treatment==temp_delta:return _controlled_comparison(rng,level)
    q=(f'Four identical plant batches were studied for 7 days. Batch A: {temp}°C, no fertilizer, average growth {base} mm. '
       f'Batch B: {temp}°C, fertilizer, growth {base+treatment} mm. '
       f'Batch C: {temp+5}°C, no fertilizer, growth {base+temp_delta} mm. '
       f'Batch D: {temp+5}°C, fertilizer, growth {base+temp_delta+treatment} mm. '
       f'At {temp}°C, what is the observed fertilizer-associated difference in growth?')
    answer=f'{treatment} mm'
    wrong=[f'{temp_delta} mm',f'{treatment+temp_delta} mm',f'{base+treatment} mm']
    if len(set([answer]+wrong))<4:return _controlled_comparison(rng,level)
    return _mc(q,answer,wrong,rng,skill='Experimental controls',level=3,
      explanation=f'Compare A and B at identical {temp}°C: {base+treatment}−{base}={treatment} mm. Comparing across temperatures would mix treatment effects with a second variable.',
      hint='Identify two groups with the SAME temperature and different fertilizer exposure.')


def _replication_precision(rng: random.Random, level: int) -> dict:
    base=rng.randint(30,65); spread=rng.randint(7,19)
    # Both groups have the SAME mean but different spread.
    a=[base-1,base,base+1]; b=[base-spread,base,base+spread]
    return _mc(f'Two laboratories independently measured the same standard solution. Lab A reported readings {a[0]}, {a[1]}, {a[2]}; Lab B reported {b[0]}, {b[1]}, {b[2]}. Which statement is supported?',
       'Both labs have the same mean, but Lab A has less variation.',[
        'Lab A has a higher mean AND more variation.',
        'Lab B has a higher mean, despite fewer observations.',
        'Both labs have identical spreads because their means match.'
       ],rng,skill='Measurement reliability',level=2,
       explanation=f'Each mean is {base}. Lab A ranges only {a[-1]-a[0]} units; Lab B ranges {b[-1]-b[0]} units. Precision/consistency is distinct from accuracy, which cannot be judged without the true value.',
       hint='Find each mean and compare maximum minus minimum; do not infer accuracy without a known reference.')


def _calibration_interpolation(rng: random.Random, level: int) -> dict:
    offset=rng.randint(2,10); slope=rng.randint(3,9); x=rng.randint(3,10); x2=x+rng.randint(4,9)
    y0=offset; y2=offset+slope*x2; target=offset+slope*x
    return _mc(f'A sensor is calibrated at concentration 0 mg/L (signal {y0} units) and {x2} mg/L (signal {y2} units). It is known that signal varies linearly with concentration. A sample gives signal {target}. What concentration does it contain?',
        f'{x} mg/L',[f'{Fraction(target,slope)} mg/L',f'{x2-x} mg/L',f'{target} mg/L'],rng,
        skill='Science graph interpretation',level=3,
        explanation=f'The signal has an offset {offset} and slope ({y2}−{offset})/{x2}={slope} units per mg/L. Concentration = ({target}−{offset})/{slope} = {x} mg/L.',
        hint='First remove the baseline signal at concentration zero, then divide by the calibration slope.',
        graph={'kind':'science_scatter','points':[[0,y0],[x2,y2]],'x_label':'Concentration (mg/L)','y_label':'Signal (units)'})


def _sample_bias(rng: random.Random, level: int) -> dict:
    club=rng.randint(70,94); nonclub=rng.randint(18,42); sample=rng.randint(60,150)
    return _mc(f'A researcher wants to estimate how many students at a school prefer studying in the morning. They survey {sample} students recruited only from a before-school club; {club}% of respondents say they prefer mornings. A separate afternoon-club survey finds {nonclub}% prefer mornings. Which conclusion is best justified?',
       'The before-school sample may overrepresent students already inclined toward mornings.',[
        'Exactly the same percentage of ALL students must prefer mornings.',
        'The schoolwide preference can be determined by averaging the two percentages without their group sizes.',
        'The afternoon-club result demonstrates that the morning survey was fabricated.'
       ],rng,skill='Sampling and inference',level=3,
       explanation='Recruitment is related to the outcome: joining a before-school club is likely associated with morning preferences. Neither convenience sample alone justifies a schoolwide percentage.',
       hint='Ask whether the people most likely to answer the survey were randomly drawn from the intended population.')


def _identify_control(rng: random.Random, level: int) -> dict:
    dosage=rng.choice([5,10,15,20]);temp=rng.choice([18,22,26])
    duration=rng.randint(4,21);volume=rng.choice([100,150,200,250,350,500,700])
    organism,measurement=rng.choice([('algal cultures','biomass'),('duckweed','leaf area'),
        ('water plants','stem length'),('soil bacteria','colony count'),
        ('seedlings','root length'),('aquatic moss','dry mass')])
    return _mc(f'In a controlled study of whether a nutrient supplement changes {organism} {measurement}, four {volume}-mL cultures were maintained for {duration} days. Each receives equal light and temperature {temp}°C. Culture 1 receives no supplement; cultures 2–4 receive {dosage}, {2*dosage}, and {3*dosage} mg of supplement respectively. What is Culture 1’s PRIMARY experimental role?',
        'It provides a no-supplement comparison for the supplemented tanks.',[
         'It isolates how temperature affects growth.',
         'It ensures every tank receives the same nutrient dose.',
         'It proves any difference must be caused by temperature.'
        ],rng,skill='Experimental controls',level=1,
        explanation='Culture 1 is the control, receiving zero of the tested independent variable. Temperature and light are held constant across the cultures.',
        hint='Which tank establishes the baseline in the absence of the treatment?')


def _proportional_slope(rng: random.Random, level: int) -> dict:
    b=rng.randint(2,9);x=rng.randint(3,11);base=rng.randint(1,8)
    value=base+b*x
    wrong=[str(value),str(b),str(Fraction(value,x))]
    if len(set([str(base)]+wrong))<4:return _proportional_slope(rng,level)
    return _mc(f'Three measurements of signal strength versus added reagent concentration are (0 mM, {base} units), ({x} mM, {value} units), and ({2*x} mM, {base+2*b*x} units). A student fits a straight line. What is its VERTICAL INTERCEPT?',
      str(base),wrong,rng,skill='Science graph interpretation',level=1,
      explanation=f'The vertical intercept is signal when concentration is 0 mM, which is {base} units. The slope is {b} units/mM, a different quantity.',
      hint='Find the recorded signal at zero concentration, not the rise per concentration unit.',
      graph={'kind':'science_scatter','points':[[0,base],[x,value],[2*x,base+2*b*x]],'x_label':'Reagent (mM)','y_label':'Signal (units)'})

# Register under the same offline pack system without changing document ingestion.
SCIENCE_FAMILIES=[_rate_from_measurements,_controlled_comparison,_replication_precision,
                  _calibration_interpolation,_sample_bias,_identify_control,_proportional_slope]


def _rate_foundation(rng: random.Random, level: int) -> dict:
    x0=rng.randint(10,40); dt=rng.randint(3,9); rate=rng.randint(2,11); increase=dt*rate
    correct=str(rate); wrong=[str(increase),str(x0+increase),str(dt)]
    if len(set([correct]+wrong))<4:return _rate_foundation(rng,level)
    return _mc(f'An experiment records {x0} milligrams of product at 0 minutes and {x0+increase} milligrams after {dt} minutes. What is the average rate of product formation, in mg/min?',
        correct,wrong,rng,skill='ACT Science rates and trends',level=1,
        explanation=f'Rate is change in product divided by elapsed time: ({x0+increase}−{x0})/{dt}={rate} mg/min.',
        hint='Subtract the earlier reading from the later reading, then divide by elapsed time.',
        graph={'kind':'science_scatter','points':[[0,x0],[dt,x0+increase]],'x_label':'Time (minutes)','y_label':'Product (mg)'})


def _variation_foundation(rng: random.Random, level: int) -> dict:
    a=rng.randint(16,50); gap=rng.randint(4,16)
    return _mc(f'Two instruments measure a stable reference repeatedly. Instrument A reads {a}, {a+1}, {a+2}. Instrument B reads {a-gap}, {a+1}, {a+gap+2}. Which instrument has the smaller RANGE of results?',
        'Instrument A', ['Instrument B','Both ranges are identical','Not enough observations to calculate either range'],rng,
        skill='Measurement reliability',level=1,
        explanation=f'A ranges from {a} to {a+2}, spanning 2. B ranges from {a-gap} to {a+gap+2}, spanning {2*gap+2}. A varies less; without a known reference value, accuracy cannot be asserted.',
        hint='Range equals the maximum minus minimum, not the average.')


def _sample_scope_foundation(rng: random.Random, level: int) -> dict:
    n=rng.randint(30,120);city=rng.choice(['Harborville','Westbridge','Millfield','Lakeport','Cedar Town'])
    return _mc(f'A school researcher in {city} surveys {n} members of the school’s chess club about study preferences. Which group do these data directly describe, before assuming anything about representativeness?',
        f'The {n} surveyed chess-club members',[
          'All students in the school',
          f'Every resident of {city}',
          'All teenagers enrolled in chess clubs worldwide'
        ],rng,skill='Sampling and inference',level=1,
        explanation=f'The researcher has observations for exactly {n} selected members of one school’s chess club. Generalization beyond them needs a justified sampling design.',
        hint='Name the actual people whose responses were measured, not everyone the researcher hoped to represent.')

SCIENCE_FAMILIES.extend([_rate_foundation,_variation_foundation,_sample_scope_foundation])


def _precision_vs_accuracy(rng: random.Random, level: int) -> dict:
    reference=rng.randint(25,90); bias=rng.randint(4,11); spread=rng.randint(8,18)
    a=[reference+bias-1,reference+bias,reference+bias+1]
    b=[reference-spread,reference,reference+spread]
    return _mc(f'A certified reference sample has a true concentration of {reference} units. Instrument A reads {a[0]}, {a[1]}, {a[2]} on three trials. Instrument B reads {b[0]}, {b[1]}, {b[2]}. Which comparison correctly distinguishes ACCURACY of the mean and PRECISION (spread)?',
      'B has a more accurate mean, but A gives more tightly clustered readings.',[
      'A has a more accurate mean and tighter readings.',
      'B has both a less accurate mean and a smaller spread.',
      'The instruments must be equally accurate because each has three measurements.'
      ],rng,skill='Measurement reliability',level=3,
      explanation=f'A is tightly clustered around a mean of {reference+bias}, which is {bias} above the known reference {reference}. B has a mean of {reference} (accurate) but much wider range {2*spread}, versus A’s range 2.',
      hint='Find each instrument’s mean and distance from the KNOWN true value; then independently compare how spread out each triplet is.')

SCIENCE_FAMILIES.append(_precision_vs_accuracy)
