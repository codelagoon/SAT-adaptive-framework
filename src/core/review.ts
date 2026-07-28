import type {Attempt,Difficulty} from "./types.ts";
export type ReviewFilter={incorrect?:boolean;slowMs?:number;lowConfidence?:boolean;conceptId?:string;difficulty?:Difficulty;from?:string;to?:string};
export function filterAttempts(attempts:Attempt[],filter:ReviewFilter):Attempt[]{return attempts.filter(a=>{
  if(filter.incorrect&&a.correct)return false;
  if(filter.slowMs!==undefined&&a.elapsedMs<filter.slowMs)return false;
  if(filter.lowConfidence&&!(["Guess","Unsure"] as const).includes(a.confidence as "Guess"|"Unsure"))return false;
  if(filter.conceptId&&a.question.conceptId!==filter.conceptId)return false;
  if(filter.difficulty&&a.question.difficulty!==filter.difficulty)return false;
  const time=new Date(a.at).getTime();if(filter.from&&time<new Date(filter.from).getTime())return false;if(filter.to&&time>new Date(filter.to).getTime())return false;
  return true;
}).sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());}
export function reviewPriority(a:Attempt,now=Date.now()){const ageDays=Math.max(0,(now-new Date(a.at).getTime())/86_400_000);return (a.correct?0:4)+(a.confidence==="Guess"?2:a.confidence==="Unsure"?1:0)+Math.min(2,a.elapsedMs/120_000)+Math.min(2,ageDays/14);}
export function prioritizedReview(attempts:Attempt[],filter:ReviewFilter={},now=Date.now()){return filterAttempts(attempts,filter).sort((a,b)=>reviewPriority(b,now)-reviewPriority(a,now));}
