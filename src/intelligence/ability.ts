import type {ProbabilisticMastery} from "../core/types.ts";
import {retentionAt} from "./memory.ts";

export type AbilityGroup={id:string;weight?:number};
export type AbilityEstimate={mean:number;standardError:number;lower95:number;upper95:number;coverage:number;effectiveConcepts:number;observedConcepts:number;calibrated:false};
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));

/** Exam-agnostic aggregation. This is a learning-state summary, never a scaled-score claim. */
export function aggregateAbility(groups:AbilityGroup[],beliefs:Record<string,ProbabilisticMastery>,at=new Date()):AbilityEstimate{
  let weighted=0,totalWeight=0,precision=0,observed=0,effective=0;
  for(const group of groups){
    const weight=Math.max(0,group.weight??1); if(!weight)continue;
    const state=beliefs[group.id]; totalWeight+=weight;
    if(!state)continue;
    observed++; const retained=state.mean*retentionAt(state,at); const evidence=Math.min(1,state.exposures/5);
    const usableWeight=weight*(.25+.75*evidence); weighted+=retained*usableWeight; effective+=usableWeight;
    precision+=usableWeight/Math.max(.012,state.variance);
  }
  const mean=effective?weighted/effective:.35;
  // Missing coverage is uncertainty, not evidence of low ability.
  const coverage=totalWeight?clamp(effective/totalWeight):0;
  const standardError=clamp(Math.sqrt(1/Math.max(precision,1))+.12*(1-coverage),.025,.3);
  return {mean:clamp(mean),standardError,lower95:clamp(mean-1.96*standardError),upper95:clamp(mean+1.96*standardError),coverage,effectiveConcepts:effective,observedConcepts:observed,calibrated:false};
}
