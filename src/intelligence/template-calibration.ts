import type {Attempt} from "../core/types.ts";

export type TemplateStatistics={templateId:string;attempts:number;correct:number;pValue:number;medianMs:number;lower95:number;upper95:number;difficultyLogit:number;readyForCalibration:boolean};
export function templateStatistics(templateId:string,attempts:Attempt[],minimum=30):TemplateStatistics{
  const rows=attempts.filter(a=>a.question.templateId===templateId),n=rows.length,k=rows.filter(a=>a.correct).length,p=n?k/n:0;
  const z=1.96,den=1+z*z/Math.max(n,1),center=(p+z*z/(2*Math.max(n,1)))/den,margin=z*Math.sqrt((p*(1-p)+z*z/(4*Math.max(n,1)))/Math.max(n,1))/den;
  const times=rows.map(a=>a.elapsedMs).sort((a,b)=>a-b),mid=Math.floor(n/2),medianMs=n?(n%2?times[mid]!:(times[mid-1]!+times[mid]!)/2):0;
  const bounded=Math.max(.01,Math.min(.99,p));
  return {templateId,attempts:n,correct:k,pValue:p,medianMs,lower95:Math.max(0,center-margin),upper95:Math.min(1,center+margin),difficultyLogit:Math.log((1-bounded)/bounded),readyForCalibration:n>=minimum};
}
export function calibrationWarnings(stats:TemplateStatistics[]){return stats.flatMap(s=>[
  ...(s.attempts===0?[`${s.templateId}: no response data`]:[]),
  ...(s.attempts>0&&!s.readyForCalibration?[`${s.templateId}: provisional (${s.attempts} attempts)`]:[]),
  ...(s.readyForCalibration&&(s.pValue<.15||s.pValue>.95)?[`${s.templateId}: extreme facility; inspect validity and targeting`]:[])
]);}
