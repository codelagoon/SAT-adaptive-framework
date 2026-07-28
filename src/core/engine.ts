import type {Attempt,Difficulty,Mastery} from "./types";
const normalize=(x:string)=>x.trim().replace(/,/g,"").replace(/[−–]/g,"-").replace(/^\+/,"");
function parseNumber(x:string){
  const value=normalize(x).replace(/%$/,""),fraction=value.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*(-?(?:\d+(?:\.\d*)?|\.\d+))$/);
  const n=fraction?Number(fraction[1])/Number(fraction[2]):Number(value);
  return x.trim().endsWith("%")?n/100:n;
}
/** SAT student-produced responses accept equivalent fractions, decimals, and percentages. */
export function answersEqual(response:string,answer:string){const aText=normalize(response),bText=normalize(answer);if(aText.toLowerCase()===bText.toLowerCase())return true;const a=parseNumber(response),b=parseNumber(answer);return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-9,Math.abs(b)*1e-9)}
export function validateStudentResponse(response:string,kind:"multiple-choice"|"numeric"|"grid-in"):{valid:boolean;message?:string}{
  const value=response.trim();if(!value)return {valid:false,message:"Enter an answer."};
  if(kind==="multiple-choice")return {valid:true};
  if(!Number.isFinite(parseNumber(value)))return {valid:false,message:"Enter an integer, decimal, fraction, or percent."};
  if(kind==="grid-in"&&value.replace(/^[+-]/,"").length>9)return {valid:false,message:"The response is too long for a student-produced answer."};
  return {valid:true};
}
export function difficultyFor(m?:Mastery):Difficulty{if(!m||m.attempts<2)return 1;if(m.score>.82&&m.difficultyReached<4)return (m.difficultyReached+1) as Difficulty;if(m.score<.48&&m.difficultyReached>1)return (m.difficultyReached-1) as Difficulty;return m.difficultyReached}
export function updateMastery(old:Mastery|undefined,a:Attempt):Mastery{const n=(old?.attempts??0)+1,c=(old?.correct??0)+(a.correct?1:0),prior=old?.score??.35;const challenge=.85+.1*a.question.difficulty, speed=Math.max(.75,Math.min(1.05,90000/Math.max(a.elapsedMs,30000))),evidence=(a.correct?1:0)*challenge*speed;const score=Math.max(0,Math.min(1,prior*.72+evidence*.28));const certainty={Guess:.25,Unsure:.5,"Pretty Sure":.75,Certain:1}[a.confidence];const calibration=1-Math.abs(certainty-(a.correct?1:0));return {conceptId:a.question.conceptId,score,attempts:n,correct:c,averageMs:((old?.averageMs??0)*(n-1)+a.elapsedMs)/n,confidenceCalibration:((old?.confidenceCalibration??0)*(n-1)+calibration)/n,lastReviewed:a.at,difficultyReached:Math.max(old?.difficultyReached??1,a.question.difficulty) as Difficulty,errors:{...(old?.errors??{}),...(a.errorKind?{[a.errorKind]:(old?.errors[a.errorKind]??0)+1}:{})}}}
export function estimatedScore(ms:Mastery[],domain:"Math"|"Reading & Writing"){const d=ms.filter(m=>m.conceptId);if(!d.length)return 200;const p=d.reduce((s,m)=>s+m.score,0)/d.length;return Math.round((200+600*p)/10)*10}
