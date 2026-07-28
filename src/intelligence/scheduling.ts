import type {ProbabilisticMastery} from "../core/types.ts";
import {retentionAt} from "./memory.ts";

const DAY=86_400_000,clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export type ReviewPriority={conceptId:string;dueAt:string;retention:number;urgency:number;reason:"overdue"|"fragile"|"uncertain"|"new"};

export function scheduleReview(state:ProbabilisticMastery,at=new Date(),targetRetention=.82):ReviewPriority{
  const target=clamp(targetRetention,.55,.95), retention=retentionAt(state,at);
  const intervalDays=Math.max(.25,-state.stabilityDays*Math.log(target));
  const dueAt=new Date(new Date(state.updatedAt).getTime()+intervalDays*DAY);
  const overdueDays=(at.getTime()-dueAt.getTime())/DAY;
  const uncertainty=clamp(Math.sqrt(state.variance)/.35);
  const urgency=clamp(.55*clamp((target-retention)/target)+.25*uncertainty+.2*clamp(overdueDays/7));
  const reason=state.exposures===0?"new":overdueDays>=0?"overdue":uncertainty>.55?"uncertain":"fragile";
  return {conceptId:state.conceptId,dueAt:dueAt.toISOString(),retention,urgency,reason};
}
export function reviewQueue(states:Record<string,ProbabilisticMastery>,at=new Date(),limit=10){
  return Object.values(states).map(s=>scheduleReview(s,at)).sort((a,b)=>b.urgency-a.urgency||a.dueAt.localeCompare(b.dueAt)).slice(0,Math.max(0,limit));
}
