import type {Concept} from "@/core/concepts"; import type {Attempt,ProbabilisticMastery,Representation} from "@/core/types"; import {retentionAt} from "./memory.ts";
export type Candidate={templateId:string;conceptId:string;representation:Representation;difficulty:number}; export type ScoreBreakdown={learning:number;information:number;retention:number;novelty:number;diversity:number;interleaving:number;fatigue:number;total:number};
export type SelectionContext={sessionLength?:number;targetSuccess?:number;maxConsecutiveConcept?:number;fatigue?:number};
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function scoreCandidate(c:Candidate,b:ProbabilisticMastery|undefined,recent:Attempt[],concept?:Concept,context:SelectionContext={}):ScoreBreakdown{
  const mastery=b?.mean??.35,uncertainty=Math.sqrt(b?.variance??.08),retention=b?retentionAt(b):.4;
  const target=context.targetSuccess??.72,expectedSuccess=clamp(.72+mastery-.18*c.difficulty),challenge=1-Math.abs(expectedSuccess-target);
  const learning=challenge*(1-mastery*.35),information=clamp(uncertainty/.35),need=1-retention,novelty=1-clamp((b?.representations[c.representation]??0)/4);
  const sameConcept=recent.slice(-4).filter(a=>a.question.conceptId===c.conceptId).length,sameRep=recent.slice(-3).filter(a=>a.question.representation===c.representation).length;
  const diversity=clamp(1-.25*sameConcept-.2*sameRep),priorConcept=recent.at(-1)?.question.conceptId,priorDomain=recent.at(-1)?.question.domain;
  const interleaving=priorConcept===c.conceptId?0:(priorDomain&&concept?.domain!==priorDomain ? .8 : 1);
  const observedFatigue=recent.slice(-5).reduce((s,a)=>s+(a.elapsedMs>120000?1:0),0)/5,fatigue=clamp(context.fatigue??observedFatigue),fatigueMismatch=fatigue*clamp((c.difficulty-1)/3),satValue=concept?.frequency??.5;
  return {learning,information,retention:need,novelty,diversity,interleaving,fatigue,total:.28*learning+.18*information+.18*need+.1*novelty+.1*diversity+.08*interleaving+.08*satValue-.12*fatigueMismatch};
}
export function selectCandidate(candidates:Candidate[],beliefs:Record<string,ProbabilisticMastery>,recent:Attempt[],concepts:Concept[],context:SelectionContext={}){const maxRun=context.maxConsecutiveConcept??2,last=recent.at(-1)?.question.conceptId;let run=0;for(let i=recent.length-1;i>=0&&recent[i]!.question.conceptId===last;i--)run++;const eligible=run>=maxRun?candidates.filter(c=>c.conceptId!==last):candidates;const pool=eligible.length?eligible:candidates;return pool.map(candidate=>({candidate,score:scoreCandidate(candidate,beliefs[candidate.conceptId],recent,concepts.find(c=>c.id===candidate.conceptId),context)})).sort((a,b)=>b.score.total-a.score.total||a.candidate.templateId.localeCompare(b.candidate.templateId))[0]}
