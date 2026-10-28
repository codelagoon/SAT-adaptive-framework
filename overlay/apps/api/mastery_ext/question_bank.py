"""Original built-in practice questions; no worksheet/PDF is needed.

These questions are intentionally small, independently authored starter content.
They are not official SAT/ACT items, and the bank is not an adaptive-test equivalent.
"""

from __future__ import annotations

from typing import TypedDict


class StarterQuestion(TypedDict):
    key: str
    question: str
    options: dict[str, str]
    answer: str
    explanation: str
    skill: str
    difficulty: int


BANK: dict[str, list[StarterQuestion]] = {
    "SAT Math": [
        dict(key="sat-math-1", question="For a positive number x, (x + 3)^2 = 4(x + 3). What is x?", options={"A": "1", "B": "2", "C": "3", "D": "4"}, answer="A", explanation="Let y = x + 3. Then y² = 4y, so y = 0 or 4. Since x > 0, y = 4 and x = 1.", skill="Advanced algebra", difficulty=3),
        dict(key="sat-math-2", question="A bag contains 4 red and 6 blue marbles. Two marbles are drawn without replacement. Given that the first is blue, what is the probability that the second is red?", options={"A": "2/5", "B": "4/9", "C": "1/2", "D": "3/5"}, answer="B", explanation="After one blue marble is removed, 9 remain: 4 red and 5 blue. Conditional probability = 4/9.", skill="Conditional probability", difficulty=3),
        dict(key="sat-math-3", question="A circle has radius 5 and a central angle of 72°. What is the length of the corresponding minor arc?", options={"A": "π", "B": "2π", "C": "5π", "D": "10π"}, answer="B", explanation="Arc length = (72/360)(2π × 5) = (1/5)(10π) = 2π.", skill="Geometry & trigonometry", difficulty=3),
        dict(key="sat-math-4", question="A survey finds that students who sleep more also report higher grades. Which conclusion is justified?", options={"A": "More sleep causes higher grades", "B": "Higher grades cause more sleep", "C": "Sleep and grades are associated, but causation is not established", "D": "The results are necessarily random"}, answer="C", explanation="An observed association does not by itself establish which variable causes the other, or whether a third variable affects both.", skill="Statistical claims", difficulty=3),
        dict(key="sat-math-5", question="The equation 3(2x − 5) = 4x + k has solution x = 7. What is k?", options={"A": "−1", "B": "−7", "C": "−13", "D": "13"}, answer="A", explanation="At x = 7, the left side is 3(14 − 5) = 27. The right side is 28 + k, so k = −1.", skill="Linear equations", difficulty=2),
    ],
    "SAT Reading & Writing": [
        dict(key="sat-rw-1", question="Study A finds that planting street trees lowers summer pavement temperatures. Study B finds the effect varies with local humidity and tree species. Which statement best relates the studies?", options={"A": "Study B disproves all of Study A", "B": "Study B qualifies the conditions under which Study A's finding applies", "C": "Both studies examine only tree growth", "D": "Study A proves humidity has no influence"}, answer="B", explanation="The second study does not reject the cooling effect; it identifies conditions that affect its size.", skill="Cross-text connections", difficulty=3),
        dict(key="sat-rw-2", question="In context, which word best completes the sentence? 'The committee was initially skeptical, but the evidence was sufficiently ____ to change its position.'", options={"A": "equivocal", "B": "persuasive", "C": "tangential", "D": "redundant"}, answer="B", explanation="Persuasive evidence is compelling enough to change someone's position. Equivocal means ambiguous; tangential means peripheral.", skill="Words in context", difficulty=3),
        dict(key="sat-rw-3", question="A study reports that some migratory birds changed their route after a new building was constructed. Which inference is best supported?", options={"A": "The building definitely caused every route change", "B": "All migratory birds avoid buildings", "C": "At least some birds followed a different route after construction", "D": "The birds could not adapt to urban areas"}, answer="C", explanation="Only the observed timing and some route changes are supported. Causality and claims about all birds overreach.", skill="Inference overreach", difficulty=3),
    ],
    "ACT English": [
        dict(key="act-english-1", question="Choose the grammatically correct completion: 'The results of the experiment, along with the researcher's notes, ____ available for review.'", options={"A": "is", "B": "are", "C": "was", "D": "has been"}, answer="B", explanation="The subject is the plural noun 'results'; the intervening phrase doesn't change subject-verb agreement.", skill="Clause boundaries", difficulty=3),
        dict(key="act-english-2", question="Which of the following sentences uses the correct neither/nor construction?", options={"A": "Neither the coach nor the players was ready.", "B": "Neither the coach nor the players were ready.", "C": "Neither the coach or the players were ready.", "D": "Neither the coach and the players were ready."}, answer="B", explanation="Neither pairs with nor. With subjects joined by neither/nor, the verb agrees with the nearer subject ('players' → 'were').", skill="Neither/nor agreement", difficulty=3),
        dict(key="act-english-3", question="'The new policy reduced waste; ____, the factory's electricity use increased.' Which transition best fits?", options={"A": "therefore", "B": "for example", "C": "however", "D": "likewise"}, answer="C", explanation="The two outcomes contrast: less waste but greater electricity use. 'However' marks that contrast.", skill="Contrast transitions", difficulty=2),
    ],
    "Algebra 2": [
        dict(key="algebra-1", question="An arithmetic sequence begins at 7 and increases by 4 each term. What is the sum of its first 20 terms?", options={"A": "780", "B": "840", "C": "900", "D": "940"}, answer="C", explanation="a20 = 7 + 19(4) = 83. Sum = 20(7 + 83)/2 = 900.", skill="Arithmetic series", difficulty=3),
        dict(key="algebra-2", question="What is the value of the geometric series 3 + 6 + 12 + ··· + 384?", options={"A": "381", "B": "765", "C": "768", "D": "1533"}, answer="B", explanation="384 = 3 × 2^7, so there are 8 terms. Sum = 3(2^8 − 1)/(2 − 1) = 765.", skill="Geometric series", difficulty=3),
        dict(key="algebra-3", question="What is the value of Σ(k=1 to 6) (3k − 2)?", options={"A": "45", "B": "51", "C": "57", "D": "63"}, answer="B", explanation="3(1+2+3+4+5+6) − 2(6) = 3(21) − 12 = 51.", skill="Sigma notation", difficulty=2),
    ],
    "Physics": [
        dict(key="physics-1", question="A ball is thrown straight upward at 20 m/s. Ignoring air resistance, which statement is true at the highest point?", options={"A": "Velocity and acceleration are both zero", "B": "Velocity is zero and acceleration is downward", "C": "Velocity is upward and acceleration is zero", "D": "Velocity and acceleration are upward"}, answer="B", explanation="The instantaneous vertical velocity at the top is zero, while gravitational acceleration remains downward (about 9.8 m/s²).", skill="Free fall", difficulty=3),
        dict(key="physics-2", question="A runner travels 100 m east in 20 s, then 100 m west in 30 s. What is their average speed?", options={"A": "0 m/s", "B": "2 m/s", "C": "4 m/s", "D": "5 m/s"}, answer="C", explanation="Average speed = total distance / total time = 200/50 = 4 m/s. Average velocity would be zero.", skill="Average speed", difficulty=3),
        dict(key="physics-3", question="Two projectiles are launched horizontally from the same height at different horizontal speeds. Ignoring air resistance, which hits level ground first?", options={"A": "The slower projectile", "B": "The faster projectile", "C": "They land simultaneously", "D": "It depends on their masses"}, answer="C", explanation="Their vertical motion is identical: both start with zero vertical velocity and accelerate downward equally.", skill="Projectile motion", difficulty=3),
    ],
}


def category_for(course_name: str) -> str:
    """Match a course to a supported offline practice track."""
    c=course_name.casefold()
    if 'act' in c:
        if 'science' in c: return 'ACT Science'
        if 'reading' in c: return 'ACT Reading'
        if 'english' in c or 'grammar' in c: return 'ACT English'
        if 'math' in c: return 'ACT Math'
    if 'sat' in c:
        if any(k in c for k in ('reading','writing','english','rw')):return 'SAT Reading & Writing'
        return 'SAT Math'
    if 'physic' in c:return 'Physics'
    if 'algebra' in c or 'math' in c:return 'Algebra 2'
    # Unknown OpenTutor courses must NOT silently receive an SAT Math bank.
    return ''


def starter_questions(course_name: str) -> list[StarterQuestion]:
    return BANK[category_for(course_name)] if category_for(course_name) in BANK else BANK['SAT Math']
