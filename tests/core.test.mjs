import test from "node:test";
import assert from "node:assert/strict";
import {answersEqual,difficultyFor,updateMastery,validateStudentResponse} from "../src/core/engine.ts";
import {sessionResults} from "../src/core/analytics.ts";
import {filterAttempts,prioritizedReview} from "../src/core/review.ts";
import {defaultCalculatorState,finalizeCalculatorUsage,parseCalculatorState,resizeCalculator,toggleCalculator} from "../src/core/calculator.ts";
import {initialBelief,retentionAt,updateBelief} from "../src/intelligence/memory.ts";
import {confidenceCalibration,recurringErrors} from "../src/intelligence/calibration.ts";
import {validateQuestion} from "../src/intelligence/validation.ts";
import {graphRelations,propagate} from "../src/intelligence/graph.ts";
import {templates} from "../src/core/templates.ts";

const question={id:"q1",templateId:"linear",conceptId:"linear-equations",domain:"Math",difficulty:2,representation:"equation",prompt:"Solve",kind:"numeric",answer:"1/2",explanation:"Divide."};
const attempt=(overrides={})=>({id:"a1",sessionId:"s1",question,response:"0.5",correct:true,elapsedMs:45_000,confidence:"Pretty Sure",at:"2026-01-02T00:00:00.000Z",...overrides});

test("numeric comparison accepts equivalent decimals and fractions",()=>{assert.equal(answersEqual("0.5","1/2"),true);assert.equal(answersEqual("0.51","1/2"),false);assert.equal(answersEqual("Certain","certain"),true)});
test("answer handling accepts SAT-style numeric forms and rejects malformed input",()=>{assert.equal(answersEqual("50%",".5"),true);assert.equal(answersEqual("−3/6","-0.5"),true);assert.equal(validateStudentResponse("2/0","grid-in").valid,false);assert.equal(validateStudentResponse("","numeric").valid,false)});
test("retention decreases with time",()=>{const belief=initialBelief("x",new Date("2026-01-01"));assert.ok(retentionAt(belief,new Date("2026-01-10"))<retentionAt(belief,new Date("2026-01-02")))});
test("correct evidence raises mastery and records representation",()=>{const next=updateBelief(undefined,attempt());assert.ok(next.mean>.35);assert.equal(next.exposures,1);assert.equal(next.representations.equation,1);assert.ok(next.lower95<=next.mean&&next.mean<=next.upper95)});
test("legacy mastery remains bounded",()=>{let state;for(let i=0;i<100;i++)state=updateMastery(state,attempt({id:`a${i}`}));assert.ok(state.score>=0&&state.score<=1);assert.equal(state.attempts,100);assert.equal(difficultyFor(state),3)});
test("confidence calibration detects risky and lucky outcomes",()=>{const result=confidenceCalibration([attempt({correct:false,confidence:"Certain"}),attempt({id:"a2",confidence:"Guess"})]);assert.equal(result.highConfidenceErrors,1);assert.equal(result.luckyCorrect,1);assert.ok(result.brier>0)});
test("recurring error patterns require the threshold",()=>{const misses=[1,2,3].map(i=>attempt({id:`m${i}`,correct:false,errorKind:"Misread"}));assert.equal(recurringErrors(misses,3)[0].count,3)});
test("question validation rejects duplicate choices",()=>{const q={...question,kind:"multiple-choice",answer:"A",choices:["A","A","B","C"].map((text,i)=>({id:String(i),text,reason:"reason"}))};assert.equal(validateQuestion(q).valid,false)});
test("graph relationships and propagation remain conservative",()=>{const nodes=[{id:"parent",prerequisites:[]},{id:"child",prerequisites:["parent"]}],base={...initialBelief("parent"),mean:.5},child={...initialBelief("child"),mean:.4};assert.deepEqual(graphRelations(nodes),{parent:["child"]});const next=propagate({parent:base,child},nodes,"parent",.2);assert.ok(next.child.mean>.4);assert.ok(next.child.mean<.42);assert.equal(next.parent.mean,.5)});
test("every procedural template passes quality checks across seeds and levels",()=>{const seeded=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(const template of templates)for(let level=1;level<=4;level++)for(let seed=1;seed<=100;seed++){const result=validateQuestion(template.generate(seeded(seed),level));assert.equal(result.valid,true,`${template.id} level ${level} seed ${seed}: ${result.errors.join(", ")}`)}});
test("review filters compose and prioritize errors",()=>{const items=[attempt({id:"old",correct:false,confidence:"Guess",at:"2026-01-01T00:00:00Z"}),attempt({id:"new",correct:true,confidence:"Certain",at:"2026-02-01T00:00:00Z"})];assert.deepEqual(filterAttempts(items,{incorrect:true}).map(x=>x.id),["old"]);assert.equal(prioritizedReview(items,{},Date.parse("2026-02-02"))[0].id,"old")});
test("session results expose learning-focused metrics",()=>{const items=[attempt(),attempt({id:"a2",correct:false,errorKind:"Arithmetic",question:{...question,domain:"Reading & Writing"}})],session={id:"s1",startedAt:"2026-01-01",attemptIds:items.map(x=>x.id)},result=sessionResults(session,items,{});assert.equal(result.answered,2);assert.equal(result.accuracy,.5);assert.equal(result.recurringErrors[0].kind,"Arithmetic");assert.ok(result.estimatedTotal>=400&&result.estimatedTotal<=1600)});
test("calculator state is bounded, persistent, and measures usage",()=>{const open=toggleCalculator(defaultCalculatorState,1000),closed=toggleCalculator(open,3500);assert.equal(finalizeCalculatorUsage(closed).elapsedMs,2500);assert.equal(resizeCalculator(closed,999).width,720);assert.equal(parseCalculatorState('{"width":250,"expressionState":"x=2"}').width,300)});
