import type {AbilityEstimate} from "./ability.ts";

export type ScoreCalibration={version:string;sampleSize:number;validatedAt:string;minAbility:number;maxAbility:number;scoreFloor:number;scoreCeiling:number;slope:number;intercept:number;rmse:number;holdoutRmse:number};
export type CalibrationGate={ready:boolean;reasons:string[]};
export type ScorePrediction={available:boolean;score?:number;lower?:number;upper?:number;confidence:"unavailable"|"low"|"moderate";calibrationVersion?:string;reasons:string[]};

export function calibrationGate(model:ScoreCalibration|undefined,minimumSample=200):CalibrationGate{
  const reasons:string[]=[];
  if(!model)return {ready:false,reasons:["No external score calibration has been supplied"]};
  if(model.sampleSize<minimumSample)reasons.push(`Calibration sample is below ${minimumSample}`);
  if(!Number.isFinite(model.holdoutRmse)||model.holdoutRmse>90)reasons.push("Holdout error exceeds the release threshold");
  if(model.maxAbility-model.minAbility<.5)reasons.push("Calibration does not cover enough of the ability range");
  if(model.scoreCeiling<=model.scoreFloor||model.slope<=0)reasons.push("Calibration mapping is invalid");
  return {ready:reasons.length===0,reasons};
}
export function predictScore(ability:AbilityEstimate,model?:ScoreCalibration):ScorePrediction{
  const gate=calibrationGate(model); if(!gate.ready||!model)return {available:false,confidence:"unavailable",reasons:gate.reasons};
  if(ability.coverage<.35)return {available:false,confidence:"unavailable",reasons:["Practice coverage is too low for a defensible estimate"]};
  const clamp=(x:number)=>Math.max(model.scoreFloor,Math.min(model.scoreCeiling,x));
  const raw=model.intercept+model.slope*ability.mean, uncertainty=Math.sqrt((model.slope*ability.standardError)**2+model.holdoutRmse**2);
  const score=Math.round(clamp(raw)/10)*10, lower=Math.round(clamp(raw-1.64*uncertainty)/10)*10, upper=Math.round(clamp(raw+1.64*uncertainty)/10)*10;
  return {available:true,score,lower,upper,confidence:ability.coverage>=.7&&model.sampleSize>=500?"moderate":"low",calibrationVersion:model.version,reasons:[]};
}
