import type {Attempt} from "../core/types.ts";

export type SessionSignals={accuracy:number;medianMs:number;speedRatio:number;fatigue:number;confidenceMismatch:number;recommendation:"continue"|"pause"|"stop-and-review";reason:string};
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length?(a.length%2?a[m]!:(a[m-1]!+a[m]!)/2):0};

export function sessionSignals(attempts:Attempt[],expectedSeconds=90):SessionSignals{
  if(!attempts.length)return {accuracy:0,medianMs:0,speedRatio:1,fatigue:0,confidenceMismatch:0,recommendation:"continue",reason:"Not enough evidence"};
  const all=attempts, recent=all.slice(-6), accuracy=all.filter(a=>a.correct).length/all.length, recentAccuracy=recent.filter(a=>a.correct).length/recent.length;
  const medianMs=median(all.map(a=>a.elapsedMs)), recentMedian=median(recent.map(a=>a.elapsedMs));
  const baseline=median(all.slice(0,Math.max(3,all.length-6)).map(a=>a.elapsedMs))||expectedSeconds*1000;
  const speedRatio=recentMedian/Math.max(1,baseline), highConfidenceMisses=recent.filter(a=>!a.correct&&(a.confidence==="Certain"||a.confidence==="Pretty Sure")).length/recent.length;
  const fatigue=clamp(.45*clamp((speedRatio-1)/.6)+.4*clamp((accuracy-recentAccuracy)/.35)+.15*highConfidenceMisses);
  if(all.length>=8&&fatigue>=.65)return {accuracy,medianMs,speedRatio,fatigue,confidenceMismatch:highConfidenceMisses,recommendation:"pause",reason:"Recent speed and accuracy indicate fatigue"};
  if(all.length>=6&&recentAccuracy<.35)return {accuracy,medianMs,speedRatio,fatigue,confidenceMismatch:highConfidenceMisses,recommendation:"stop-and-review",reason:"Recent errors suggest reviewing before more retrieval"};
  return {accuracy,medianMs,speedRatio,fatigue,confidenceMismatch:highConfidenceMisses,recommendation:"continue",reason:"Performance remains stable"};
}
