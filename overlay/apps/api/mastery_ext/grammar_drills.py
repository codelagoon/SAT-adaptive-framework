"""Original rule-driven SAT/ACT editing drills, produced without AI.

Grammar can be checked mechanically with explicit constructions; unlike
open-ended reading comprehension, these are safely parameterized.
"""
import hashlib
import random
from mastery_ext.practice_bank import _mc

NOUNS_PLURAL=['students','researchers','engineers','volunteers','musicians','teachers','designers','scientists','curators','directors','analysts','journalists']
NOUNS_SINGULAR=['student','researcher','engineer','volunteer','musician','teacher','designer','scientist','curator','director','analyst','journalist']
ACTIVITIES=[('finished the report','emailed the findings','presented the results'),
 ('completed the survey','checked the data','published the summary'),
 ('revised the design','tested the prototype','documented the changes'),
 ('collected the samples','analyzed the results','described the method'),
 ('edited the draft','checked the citations','submitted the article')]
CAUSES=[('The roads were icy','the transit agency reduced bus speeds'),
 ('The reservoir was unusually low','the city restricted lawn watering'),
 ('The sample contained only 12 participants','the team treated its results as preliminary'),
 ('The battery failed overnight','the experiment stopped before sunrise'),
 ('The building had no functioning elevator','the organizers moved the meeting downstairs'),
 ('The signal was too weak','the researchers repeated the measurement')]
CONTRASTS=[('The renovation cost more than expected','it shortened the maintenance schedule'),
 ('The sample was relatively small','the pattern appeared consistent across groups'),
 ('The museum reduced opening hours','its weekend attendance increased'),
 ('The train departed late','it arrived ahead of schedule'),
 ('The first prototype weighed more','it used less energy under load'),
 ('The pilot program had limited funding','it served more families than predicted')]
ACTIONS=[('review the results','prepare a summary','present the findings'),
 ('measure the distance','record the data','check the estimates'),
 ('assess the damage','contact the owners','arrange repairs'),
 ('collect samples','label them carefully','store them properly'),
 ('update the schedule','inform the team','notify participants'),
 ('revise the outline','verify the quotations','submit the essay')]
MOTIONS=[('Walking through the archive','the historian'),('Crossing the campus','the students'),
 ('Looking at the chart','the analyst'),('Examining the samples','the biologist'),
 ('Entering the theater','the audience'),('Reading the letter','the researcher')]


def _agreement(rng):
    singular=rng.choice(NOUNS_SINGULAR);plural=rng.choice(NOUNS_PLURAL);near_singular=rng.choice([True,False])
    first,second=(plural,singular) if near_singular else (singular,plural)
    answer='was' if near_singular else 'were'
    question=f'Choose the correct verb: "At yesterday’s meeting, neither the {first} nor the {second} ____ available for questions."'
    return _mc(question,answer,[('were' if near_singular else 'was'),'is','are'],rng,
       skill='Neither/nor agreement',explanation=f'With neither/nor, agreement follows the nearer noun “{second}.” The event occurred yesterday, so use the past-tense {answer}.',
       hint='Find the noun closest to the verb, then match number and the past-tense cue.',level=2)


def _subject_head(rng):
    one=rng.choice([True,False]);subject=rng.choice(NOUNS_SINGULAR if one else NOUNS_PLURAL)
    aux=rng.choice(NOUNS_PLURAL)
    answer='has' if one else 'have'
    return _mc(f'Choose the correct verb: "The {subject}, along with several {aux}, ____ completed the safety review."',answer,
       [('have' if one else 'has'),'having','had been'],rng,skill='Subject-verb agreement',level=2,
       explanation=f'The head subject is “{subject},” not the interrupting phrase “along with several {aux}.” Use {answer} as the present perfect auxiliary.',
       hint='Ignore the intervening phrase and match the verb to the first noun.')


def _transition(rng):
    causal=rng.choice([True,False]);first,second=rng.choice(CAUSES if causal else CONTRASTS)
    answer='therefore' if causal else 'however'
    context=rng.choice(['In the pilot project, ','In the initial study, ','During the first trial, ','At the time, ','That month, ','According to the report, ','In this example, ','Before the review, '])
    return _mc(f'Choose the most logical transition: "{context}{first[0].lower()+first[1:]}; ____, {second[0].lower()+second[1:]}."',answer,
        (['however','meanwhile','for example'] if causal else ['therefore','for example','similarly']),rng,
        skill='Transitions' if causal else 'Contrast transitions',level=2,
        explanation=f'The second statement {"is a consequence of" if causal else "contrasts with the expectation from"} the first. “{answer.capitalize()}” indicates that relationship.',
        hint='Decide whether the second statement follows from or surprises the first.')


def _parallelism(rng):
    first,second,third=rng.choice(ACTIONS)
    team=rng.choice(['students','editors','engineers','researchers','analysts','organizers','writers','journalists','curators','volunteers','designers','teachers'])
    deadline=rng.choice(['before Friday','before the conference','before the final review','before the next meeting'])
    answer=third
    # Correct infinitive: to V, to V, and to V.
    gerund=third.split(' ',1)[0]+'ing'+(' '+third.split(' ',1)[1] if ' ' in third else '')
    wrong=[gerund, 'the '+third, 'it was '+third]
    return _mc(f'Choose the parallel completion: "The {team} planned to {first}, to {second}, and to ____ {deadline}."',answer,wrong,rng,
        skill='Parallelism',level=2,
        explanation=f'The list has three parallel infinitive phrases (to {first}, to {second}, to {third}). The blank completes the third infinitive.',
        hint='Keep all three actions in the same verb form. “To” is already present before the blank.')


def _modifier(rng):
    intro,agent=rng.choice(MOTIONS)
    noun=rng.choice(['a report','a sign','a schedule','a display','an exhibit','a note'])
    action=rng.choice(['noticed','examined','studied','recognized'])
    right=f'{agent} {action} {noun}'
    wrong=[f'{noun} was {action} by {agent}',f'there was {noun} nearby',f'{noun} appeared suddenly']
    return _mc(f'Which completion identifies who {action} {noun} without a dangling modifier? "{intro}, ____."',right,wrong,rng,
       skill='Modifiers',level=2,
       explanation=f'The subject immediately after “{intro}” must be {agent}, the person or people performing that action. Only the correct completion names that agent first.',
       hint='Ask who is doing the action in the introductory phrase.')


def _relative(rng):
    person=rng.choice(NOUNS_SINGULAR);noun=rng.choice(['research','proposal','notes','work','article','interview','design','report'])
    return _mc(f'Choose the relative pronoun: "The {person}, ____ {noun} was featured in the newsletter, answered questions."','whose',
       ['who','whom','which'],rng,skill='Pronoun precision',level=2,
       explanation=f'“Whose” shows possession: the {noun} belongs to the {person}. “Who” would be a subject and “whom” an object, not a possessive.',
       hint='Does the blank express possession of the following noun?')


# Additional original editing constructs, registered below without replacing
# the six existing rule families. Each has a fixed grammar rule and a solution
# not generated by an LLM.
BOUNDARY_PAIRS=[
 ('The measurements were incomplete','the team repeated the experiment'),
 ('The museum closed at six','the visitors left quietly'),
 ('The editor checked the dates','the author revised the timeline'),
 ('The rain stopped','the workers resumed construction'),
 ('The orchestra finished rehearsing','the audience began arriving'),
 ('The volunteers collected samples','the biologist labeled every container'),
 ('The committee read the proposal','the chair called for a vote'),
 ('The archive opened its new wing','researchers requested the catalog'),
 ('The plane descended','the pilots checked their instruments'),
 ('The data arrived late','the analysts changed their schedule'),
 ('The engine overheated','the mechanic shut it down'),
 ('The storm moved offshore','the ferry resumed service'),
 ('The dancers finished warming up','the conductor raised her baton'),
 ('The payment was declined','the cashier requested another card'),
 ('The exhibit drew a crowd','the gallery extended its hours'),
 ('The report was delayed','the manager contacted the client'),
 ('The printer ran out of ink','the students shared a digital copy'),
 ('The final bell rang','the classrooms emptied'),
 ('The lights flickered','the technician inspected the circuit'),
 ('The team won its match','the coach thanked the volunteers'),
 ('The laboratory lost power','the samples were moved to another freezer'),
 ('The bus arrived early','the passengers boarded immediately'),
 ('The bridge reopened','drivers returned to the original route'),
 ('The rehearsal ended','the musicians packed their instruments'),
 ('The committee met again','the members reviewed the amended draft'),
 ('The website went offline','the administrator checked the server'),
 ('The alarm sounded','the staff began their evacuation'),
 ('The class finished its project','the teacher arranged a presentation'),
 ('The court dismissed the claim','the lawyer explained the decision'),
 ('The test results were unexpected','the researchers checked their calculations'),
 ('The photographer adjusted the lens','the image became sharper'),
 ('The first trial failed','the team revised the procedure'),
 ('The wind increased','the sailors lowered the smaller sails'),
 ('The library catalogue changed','the librarians updated their instructions'),
 ('The debate ended','the judges compared their notes'),
 ('The deadline approached','the editor requested a final draft'),
 ('The pilot study closed','the team began analyzing results'),
 ('The sun set','the spectators left the field'),
 ('The order was delayed','the restaurant notified its customers'),
 ('The results were published','the committee met to discuss them'),
 ('The announcement was made','the reporters submitted questions'),
 ('The ferry entered the harbor','the passengers gathered their bags'),
 ('The battery ran down','the device stopped recording'),
 ('The lecture finished','the audience asked questions'),
 ('The contract was signed','the project moved into development'),
]
TIMELINES=[
 ('the meeting','started','reviewed the materials'),
 ('the train','arrived','checked the platform'),
 ('the experiment','began','checked the instruments'),
 ('the polling station','opened','counted the ballots'),
 ('the hearing','ended','filed the report'),
 ('the ship','departed','loaded the supplies'),
 ('the session','finished','recorded the results'),
 ('the bell','rang','prepared the notes'),
]

def _clause_boundaries(rng):
    first,second=rng.choice(BOUNDARY_PAIRS)
    start=rng.choice(['Which revision joins these independent clauses with a semicolon ALONE, without a conjunction?',
                      'Choose the revision that uses ONLY a semicolon to join the two complete clauses.'])
    correct=f'{first}; {second}.'
    wrong=[f'{first}, {second}.',f'{first} {second}.',f'{first}; and {second}.']
    return _mc(f'{start}\n“{first}. {second}.”',correct,wrong,rng,skill='Clause boundaries',level=2,
       explanation='Both clauses have a subject and a finite verb. The instruction requires a semicolon ALONE, not a comma splice or a conjunction. A semicolon plus “and” is not necessarily ungrammatical, but it violates that instruction.',
       hint='Identify the two independent clauses. A semicolon can replace a full stop between closely related complete sentences.')


def _past_perfect(rng):
    subject,later,earlier=rng.choice(TIMELINES)
    actor=rng.choice(['researchers','organizers','editors','students','investigators','volunteers','technicians'])
    # Earlier action is complete before the later event, and the explicit
    # correct construction maintains temporal consistency.
    action=earlier.split(' ',1)
    participle=action[0]
    bare={'reviewed':'review','locked':'lock','checked':'check',
          'counted':'count','filed':'file','loaded':'load',
          'recorded':'record','prepared':'prepare'}[participle]
    past_participle=participle
    rest=action[1]
    answer=f'had {past_participle} {rest}'
    wrong=[f'will {bare} {rest}', f'will have {past_participle} {rest}',f'have {past_participle} {rest}']
    if len(set([answer]+wrong))<4:raise ValueError('Duplicate tense options')
    return _mc(f'Complete this sentence using the tense that explicitly marks the EARLIER completed event: “By the time {subject} {later}, the {actor} ____.”',
       answer,wrong,rng,skill='Verb tense',level=2,
       explanation=f'“By the time ... {later}” places the other event before a past reference point. Past perfect “had {past_participle}” makes that earlier completion explicit.',
       hint='The second action happened earlier than another completed past event; use past perfect.')

# No LLM text generation: each construction has a mechanically checked answer.

def generate_grammar_drills(track: str, seed: str, count: int = 160) -> list[dict]:
    if track not in ('ACT English','SAT Reading & Writing'):raise ValueError('Grammar drills only for editing tracks')
    if not 1<=count<=350:raise ValueError('Count out of range')
    rng=random.Random(int.from_bytes(hashlib.sha256(f'grammar-v2:{track}:{seed}'.encode()).digest()[:8],'big'))
    families=[_agreement,_subject_head,_transition,_parallelism,_modifier,_relative,
              _clause_boundaries,_past_perfect]
    questions=[];seen=set()
    for i in range(count):
        family=families[i%len(families)]
        for j in range(250):
            try:q=family(rng)
            except ValueError:continue
            normalized=' '.join(q['question'].split()).casefold()
            if normalized not in seen:break
        else:raise ValueError(f'Exhausted distinct constructions in {family.__name__}')
        seen.add(normalized)
        q['problem_metadata'].update({
          'mastery_seed_key':f'{track}|{seed}|grammar-v2-{i}',
          'question_hash':hashlib.sha256(q['question'].encode()).hexdigest()[:20],
          'track':track,'family':family.__name__,'offline_grammar':True})
        questions.append(q)
    return questions
