import test from "node:test";
import assert from "node:assert/strict";
import {initialBelief} from "../src/intelligence/memory.ts";
import {aggregateAbility} from "../src/intelligence/ability.ts";
import {reviewQueue,scheduleReview} from "../src/intelligence/scheduling.ts";
import {calibrationGate,predictScore} from "../src/intelligence/prediction.ts";
import {sessionSignals} from "../src/intelligence/session.ts";
import {calibrationWarnings,templateStatistics} from "../src/intelligence/template-calibration.ts";
import {scoreCandidate,selectCandidate} from "../src/intelligence/selection.ts";

const at=new Date("2026-02-01T00:00:00.000Z");
const belief=(id,overrides={})=>({...initialBelief(id,new Date("2026-01-20T00:00:00.000Z")),mean:.7,variance:.03,stabilityDays:20,exposures:6,...overrides});
const question=(templateId="t",conceptId="algebra",difficulty=2)=>({id:`q-${templateId}`,templateId,conceptId,domain:"Math",difficulty,representation:"equation",prompt:"Solve",kind:"numeric",answer:"2",explanation:"Compute."});
const attempt=(id,correct=true,elapsedMs=60_000,overrides={})=>({id,sessionId:"s",question:question(),response:"2",correct,elapsedMs,confidence:"Pretty Sure",at:"2026-02-01T00:00:00.000Z",...overrides});

test("ability aggregation reports coverage and widens uncertainty for missing concepts",()=>{
  const full=aggregateAbility([{id:"a"},{id:"b"}],{a:belief("a"),b:belief("b")},at);
  const partial=aggregateAbility([{id:"a"},{id:"b"}],{a:belief("a")},at);
  assert.ok(full.coverage>partial.coverage); assert.ok(partial.standardError>full.standardError);
  assert.equal(full.calibrated,false);
});

test("review scheduling prioritizes overdue fragile memory",()=>{
  const fragile=belief("fragile",{updatedAt:"2025-11-01T00:00:00.000Z",stabilityDays:2});
  const stable=belief("stable",{updatedAt:"2026-01-30T00:00:00.000Z",stabilityDays:90});
  assert.ok(scheduleReview(fragile,at).urgency>scheduleReview(stable,at).urgency);
  assert.equal(reviewQueue({stable,fragile},at,1)[0].conceptId,"fragile");
});

test("score prediction is unavailable until empirical calibration passes",()=>{
  const ability=aggregateAbility([{id:"a"}],{a:belief("a")},at);
  assert.equal(predictScore(ability).available,false);
  const weak={version:"x",sampleSize:20,validatedAt:"2026-01-01",minAbility:.3,maxAbility:.6,scoreFloor:400,scoreCeiling:1600,slope:1200,intercept:400,rmse:100,holdoutRmse:120};
  assert.equal(calibrationGate(weak).ready,false);
  const model={...weak,version:"v1",sampleSize:600,minAbility:.1,maxAbility:.9,rmse:55,holdoutRmse:60};
  const result=predictScore(ability,model); assert.equal(result.available,true); assert.ok(result.lower<=result.score&&result.score<=result.upper);
});

test("session intelligence recommends a pause after measurable deterioration",()=>{
  const strong=Array.from({length:8},(_,i)=>attempt(`a${i}`,true,45_000));
  const tired=Array.from({length:6},(_,i)=>attempt(`b${i}`,i===0,150_000));
  const result=sessionSignals([...strong,...tired]); assert.equal(result.recommendation,"pause"); assert.ok(result.fatigue>=.65);
});

test("template statistics remain provisional until the sample gate",()=>{
  const rows=Array.from({length:20},(_,i)=>attempt(`a${i}`,i<14,50_000+i*100,{question:question("linear")}));
  const stats=templateStatistics("linear",rows); assert.equal(stats.pValue,.7); assert.equal(stats.readyForCalibration,false);
  assert.match(calibrationWarnings([stats])[0],/provisional/);
});

test("selection interleaves after a concept run and reduces hard-item score under fatigue",()=>{
  const recent=[attempt("a"),attempt("b")];
  const candidates=[{templateId:"same",conceptId:"algebra",representation:"equation",difficulty:3},{templateId:"other",conceptId:"geometry",representation:"diagram",difficulty:2}];
  const concepts=[{id:"algebra",domain:"Math",area:"A",name:"A",prerequisites:[],difficulty:2,frequency:.8},{id:"geometry",domain:"Math",area:"G",name:"G",prerequisites:[],difficulty:2,frequency:.8}];
  assert.equal(selectCandidate(candidates,{},recent,concepts,{maxConsecutiveConcept:2}).candidate.conceptId,"geometry");
  const hard=candidates[0],rest={...belief("algebra"),updatedAt:new Date().toISOString()};
  assert.ok(scoreCandidate(hard,rest,[],concepts[0],{fatigue:1}).total<scoreCandidate(hard,rest,[],concepts[0],{fatigue:0}).total);
});
