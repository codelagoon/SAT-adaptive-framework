import {conceptById} from "./concepts.ts";
import type {Attempt,Confidence,Domain,ErrorKind,Mastery,Session} from "./types.ts";

export type ConceptResult={conceptId:string;name:string;attempts:number;accuracy:number;averageMs:number;mastery:number};
export type SessionResult={answered:number;correct:number;accuracy:number;averageMs:number;averageConfidence:number;mathScore:number;readingWritingScore:number;estimatedTotal:number;strongest:ConceptResult[];weakest:ConceptResult[];recurringErrors:{kind:ErrorKind;count:number}[]};
const confidenceValue:Record<Confidence,number>={Guess:.25,Unsure:.5,"Pretty Sure":.75,Certain:1};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));

function domainScore(attempts:Attempt[],domain:Domain){
  const relevant=attempts.filter(a=>a.question.domain===domain);if(!relevant.length)return 200;
  const weighted=relevant.reduce((sum,a)=>sum+(a.correct?1:0)*(.75+.125*a.question.difficulty),0)/relevant.reduce((sum,a)=>sum+.75+.125*a.question.difficulty,0);
  return Math.round(clamp(200+600*weighted,200,800)/10)*10;
}
export function summarizeConcepts(attempts:Attempt[],mastery:Record<string,Mastery>):ConceptResult[]{
  const grouped=new Map<string,Attempt[]>();for(const a of attempts)grouped.set(a.question.conceptId,[...(grouped.get(a.question.conceptId)??[]),a]);
  return [...grouped].map(([conceptId,list])=>({conceptId,name:conceptById.get(conceptId)?.name??conceptId,attempts:list.length,accuracy:list.filter(a=>a.correct).length/list.length,averageMs:list.reduce((s,a)=>s+a.elapsedMs,0)/list.length,mastery:mastery[conceptId]?.score??.35}));
}
export function sessionResults(session:Session,allAttempts:Attempt[],mastery:Record<string,Mastery>):SessionResult{
  const ids=new Set(session.attemptIds),attempts=allAttempts.filter(a=>a.sessionId===session.id||ids.has(a.id)),answered=attempts.length,correct=attempts.filter(a=>a.correct).length;
  const concepts=summarizeConcepts(attempts,mastery),ranked=[...concepts].sort((a,b)=>a.mastery-b.mastery||a.accuracy-b.accuracy),errors=new Map<ErrorKind,number>();
  for(const a of attempts)if(a.errorKind)errors.set(a.errorKind,(errors.get(a.errorKind)??0)+1);
  const mathScore=domainScore(attempts,"Math"),readingWritingScore=domainScore(attempts,"Reading & Writing");
  return {answered,correct,accuracy:answered?correct/answered:0,averageMs:answered?attempts.reduce((s,a)=>s+a.elapsedMs,0)/answered:0,averageConfidence:answered?attempts.reduce((s,a)=>s+confidenceValue[a.confidence],0)/answered:0,mathScore,readingWritingScore,estimatedTotal:mathScore+readingWritingScore,weakest:ranked.slice(0,3),strongest:ranked.slice(-3).reverse(),recurringErrors:[...errors].map(([kind,count])=>({kind,count})).sort((a,b)=>b.count-a.count)};
}
