"use client";

/** Mastery Engine 2.0: real OpenTutor quiz records, not standalone demo questions. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ProblemGraph,{type GraphData} from "../graph";
import { listCourseOverview, type CourseOverviewCard } from "@/lib/api/courses";
import { request } from "@/lib/api/client";
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, ChartNoAxesCombined, CircleHelp,
  Clock3, GraduationCap, Lightbulb, RotateCcw, Sparkles, Target,
} from "lucide-react";

type Skill = { skill:string; p:number; n:number; due:boolean; due_at:string };
type Attempt = {skill:string; correct:number; confidence:number|null; reasoning:string; error_category:string|null};
type Proposition={id:string;claim:string;premises:string[];created_at:string};
type Overview = {skills:Skill[]; recent_errors:Attempt[]; high_confidence_mistakes:number;
  edges:{prerequisite:string; dependent:string}[]; review_policy:string};
type Question={id:string; question:string; question_type:string; options:Record<string,string>|null;
  difficulty_layer:number|null; skills:string[];reason:string;hint?:string;graph?:GraphData;
  effective_mode?:"challenge"|"repair"|"review"|"transfer";reviewing?:boolean;progression_supported?:boolean};
type Grade = {result_id:string;is_correct:boolean; correct_answer:string|null; explanation:string|null;
  prerequisite_gaps:{concept:string}[]|null};
type OfflineHelp={skill:string;principle:string;worked_example:string;transfer_check:string;hint:string};
type Probe={probe_id:string;skill:string;question:string;options:Record<string,string>;principle:string};
type ProbeResult={correct:boolean;correct_answer:string;explanation:string;interpretation:string;confidence:string;selected:string};
type OfflineDiagnosis={correct:boolean;hypothesis?:string;certainty?:string;verification?:string;
  evidence?:string;probe?:Probe|null;probe_result?:ProbeResult};
type BankStatus={track:string;supported:boolean;total_offline:number;packs:Record<string,number>;finite_verbal:boolean;next_pack:number};
const SUBJECTS=['SAT Math','SAT Reading & Writing','ACT English','ACT Math','ACT Reading','ACT Science','Algebra 2','Physics'];
const fmt = (n:number) => `${Math.round(n*100)}%`;

export default function MasteryPage(){
  const [courses,setCourses]=useState<CourseOverviewCard[]>([]);
  const [courseId,setCourseId]=useState("");
  const [overview,setOverview]=useState<Overview|null>(null);
  const [startingTopics,setStartingTopics]=useState<string[]>([]);
  const [propositions,setPropositions]=useState<Proposition[]>([]);
  const [newClaim,setNewClaim]=useState("");
  const [newPremises,setNewPremises]=useState("");
  const [question,setQuestion]=useState<Question|null>(null);
  const [answer,setAnswer]=useState("");
  const [thinking,setThinking]=useState("");
  const [confidence,setConfidence]=useState(3);
  const [grade,setGrade]=useState<Grade|null>(null);
  const [diagnosis,setDiagnosis]=useState<OfflineDiagnosis|null>(null);
  const [probeAnswer,setProbeAnswer]=useState("");
  const [probeResult,setProbeResult]=useState<ProbeResult|null>(null);
  const [probeBusy,setProbeBusy]=useState(false);
  const [quickGrade,setQuickGrade]=useState(true);
  const submissionLock=useRef(false);
  const [help,setHelp]=useState<OfflineHelp|null>(null);
  const [helpMode,setHelpMode]=useState<"hint"|"lesson">("hint");
  const [helpBusy,setHelpBusy]=useState(false);
  const [usedAssistance,setUsedAssistance]=useState(false);
  const [bank,setBank]=useState<BankStatus|null>(null);
  const [focusSkill,setFocusSkill]=useState("");
  const [practiceMode,setPracticeMode]=useState<"challenge"|"repair"|"review">("challenge");
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [seeding,setSeeding]=useState(false);
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");
  const [tutorMode,setTutorMode]=useState<"hint"|"explain"|"challenge">("hint");
  const [tutorQuestion,setTutorQuestion]=useState("");
  const [tutorAnswer,setTutorAnswer]=useState("");
  const [tutorBusy,setTutorBusy]=useState(false);
  const started=useRef(Date.now());

  useEffect(()=>{listCourseOverview().then(rows=>{setCourses(rows);if(rows.length)setCourseId(rows[0].id)}).catch(e=>setError(String(e)))},[]);
  const refresh=useCallback(async (id:string)=>{
    if(!id)return;
    setLoading(true);setError("");setAnswer("");setThinking("");setGrade(null);setDiagnosis(null);setProbeAnswer("");setProbeResult(null);setTutorAnswer("");setHelp(null);setUsedAssistance(false);
    try{
      const [state,next,priorities,claims,bankResult]=await Promise.all([
        request<Overview>(`/mastery/courses/${id}/overview`),
        request<{question:Question|null;available:number}>(`/mastery/courses/${id}/next?focus_skill=${encodeURIComponent(focusSkill)}&mode=${practiceMode}`),
        request<{topics:string[]}>(`/mastery/courses/${id}/starting-priorities`),
        request<{propositions:Proposition[]}>(`/mastery/courses/${id}/propositions`),
        request<BankStatus>(`/mastery/courses/${id}/bank-status`),
      ]);
      setOverview(state);setBank(bankResult);setQuestion(next.question);setStartingTopics(priorities.topics);setPropositions(claims.propositions);setTutorQuestion(next.question?.question??"");started.current=Date.now();
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setLoading(false)}
  },[focusSkill,practiceMode]);
  useEffect(()=>{void refresh(courseId)},[courseId,refresh]);
  const currentCourse=useMemo(()=>courses.find(c=>c.id===courseId),[courseId,courses]);
  const due=overview?.skills.filter(s=>s.due).length??0;
  const avg=overview?.skills.length?overview.skills.reduce((a,s)=>a+s.p,0)/overview.skills.length:null;

  async function submit(selectedAnswer?:string){
    const response=(selectedAnswer??answer).trim();
    if(!question||!response||busy||grade||submissionLock.current)return;
    submissionLock.current=true;setBusy(true);setError("");
    try{
      await request('/mastery/prepare',{method:'POST',body:JSON.stringify({
        course_id:courseId,problem_id:question.id,confidence,reasoning:thinking.trim(),
        mode:question.effective_mode??practiceMode,assisted:usedAssistance
      })});
      const result=await request<Grade>('/quiz/submit',{method:'POST',body:JSON.stringify({
        problem_id:question.id,user_answer:response,answer_time_ms:Math.max(1,Date.now()-started.current)
      })});
      setGrade(result);
      setOverview(await request<Overview>(`/mastery/courses/${courseId}/overview`));
      if(!result.is_correct){
        try{
          const finding=await request<OfflineDiagnosis>(`/mastery/courses/${courseId}/offline-diagnosis/${question.id}?attempt_id=${result.result_id}`);
          setDiagnosis(finding);setProbeResult(finding.probe_result??null);
        }catch{setDiagnosis(null)}
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{submissionLock.current=false;setBusy(false)}
  }
  async function checkProbe(selected:string){
    if(!courseId||!question||!diagnosis?.probe||probeBusy||probeResult)return;
    setProbeAnswer(selected);setProbeBusy(true);setError("");
    try {
      const r=await request<ProbeResult>(`/mastery/courses/${courseId}/offline-probe/${question.id}`,{
        method:'POST',body:JSON.stringify({probe_id:diagnosis.probe.probe_id,attempt_id:grade?.result_id,selected})});
      setProbeResult(r);
      setOverview(await request<Overview>(`/mastery/courses/${courseId}/overview`));
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setProbeBusy(false);}
  }
  async function createSubject(name:string){
    setCreating(true);setError("");
    try{
      const created=await request<CourseOverviewCard>('/courses/',{
        method:'POST',body:JSON.stringify({name,description:'Adaptive practice without document uploads',metadata:{mastery_track:name}})});
      setCourses(prev=>[created,...prev]);setCourseId(created.id);
      await request(`/mastery/courses/${created.id}/starter-questions`,{method:'POST'});
      await refresh(created.id);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setCreating(false)}
  }
  async function startWithoutFiles(){
    if(!courseId)return;
    setSeeding(true);setError("");
    try{
      await request(`/mastery/courses/${courseId}/starter-questions`,{method:'POST'});
      await refresh(courseId);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSeeding(false)}
  }
  async function askTutor(){
    if(!tutorQuestion.trim()||!courseId)return;
    if(question&&!grade)setUsedAssistance(true); // Tutor exposure is assistance for this attempt.
    setTutorBusy(true);setTutorAnswer("");setError("");
    try{
      const r=await request<{answer:string}>('/mastery/tutor',{method:'POST',body:JSON.stringify({
        course_id:courseId,question:tutorQuestion,mode:tutorMode})});
      setTutorAnswer(r.answer);
    }catch(e){setTutorAnswer(e instanceof Error?e.message:String(e))}
    finally{setTutorBusy(false)}
  }
  async function getOfflineHelp(mode:"hint"|"lesson"){
    if(!question||!courseId||helpBusy)return;
    setHelpMode(mode);
    setUsedAssistance(true);
    if(help)return;
    setHelpBusy(true);
    try {setHelp(await request<OfflineHelp>(`/mastery/courses/${courseId}/offline-help/${question.id}`));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setHelpBusy(false);}
  }
  async function expandBank(){
    if(!courseId||busy||bank?.finite_verbal||!bank||bank.next_pack>20)return;
    setBusy(true);setError("");
    try{await request(`/mastery/courses/${courseId}/expand?pack=${bank.next_pack}`,{method:'POST'});await refresh(courseId);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function skipRepair(){
    if(!courseId||!question?.skills?.[0])return;
    setBusy(true);
    try{
      await request(`/mastery/courses/${courseId}/skip-repair`,{method:'POST',
        body:JSON.stringify({skill:question.skills[0]})});
      setFocusSkill("");setPracticeMode("challenge");
      await refresh(courseId);
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  async function saveProposition(){
    if(!courseId||newClaim.trim().length<4)return;
    setBusy(true);setError("");
    try{
      await request(`/mastery/courses/${courseId}/propositions`,{method:'POST',body:JSON.stringify({
        claim:newClaim.trim(),premises:newPremises.split('\n').map(s=>s.trim()).filter(Boolean)
      })});
      setPropositions((await request<{propositions:Proposition[]}>(`/mastery/courses/${courseId}/propositions`)).propositions);
      setNewClaim("");setNewPremises("");
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }
  const panel="rounded-2xl border border-white/10 bg-[#161b25]";
  return <div className="min-h-screen bg-[#0c1018] text-[#e9edf4]" style={{fontFamily:'ui-sans-serif,system-ui,sans-serif'}}>
    <div className="mx-auto flex max-w-[1580px] min-h-screen">
      <aside className="w-[236px] shrink-0 border-r border-white/10 px-5 py-7">
        <Link href="/" className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft size={15}/> OpenTutor workspace</Link>
        <div className="mt-10 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d2e1fd] text-[#1a2740]"><Brain size={21}/></span><div><div className="text-base font-semibold tracking-tight">Mastery Engine</div><div className="text-[11px] tracking-[.15em] text-slate-500">VERSION 2.0</div></div></div>
        <div className="mt-12 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">Study workspace</div>
        <div className="mt-3 rounded-xl bg-[#26344b] px-3 py-3 text-sm text-[#d9e7ff] flex items-center gap-2"><Target size={16}/> Adaptive practice</div>
        <a href="#progress" className="mt-2 flex gap-2 rounded-xl px-3 py-3 text-sm text-slate-400 hover:text-white"><ChartNoAxesCombined size={16}/> Progress & gaps</a>
        <a href="#tutor" className="mt-2 flex gap-2 rounded-xl px-3 py-3 text-sm text-slate-400 hover:text-white"><Sparkles size={16}/> Optional AI tutor</a>
        <div className="mt-12 border-t border-white/10 pt-5 text-xs text-slate-400 leading-5">Your answers are graded by OpenTutor. Mastery Engine records reasoning, confidence and personalized review signals.</div>
      </aside>
      <main className="min-w-0 flex-1 px-9 py-8">
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-xs uppercase tracking-[.2em] text-[#8fa8cf]">Your learning studio</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">Learn where it gets difficult.</h1><p className="mt-2 text-sm text-slate-400">Verified offline practice, hard-first challenges, optional AI. Documents remain available.</p></div>
          <div className="min-w-[215px]"><label htmlFor="course" className="block text-xs text-slate-500 mb-2">Active course</label><select id="course" value={courseId} onChange={e=>setCourseId(e.target.value)} className="w-full rounded-xl border border-white/15 bg-[#1b2331] px-3 py-3 text-sm text-slate-100"><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><details className="relative mt-2"><summary className="cursor-pointer text-xs text-[#b6cdef] hover:text-white">+ Create another study track</summary><div className="absolute right-0 z-20 mt-2 min-w-[230px] rounded-xl border border-white/15 bg-[#172234] p-2 shadow-xl">{SUBJECTS.map(subject=><button key={subject} disabled={creating} onClick={()=>void createSubject(subject)} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10 disabled:opacity-40">{subject}</button>)}</div></details></div>
        </div>
        {bank&&courseId&&<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">{bank.total_offline>0?<span className="rounded-full border border-emerald-600/30 bg-emerald-800/15 px-3 py-1 text-emerald-200">Offline ready · no AI required</span>:<span className="rounded-full border border-slate-500/40 bg-slate-900/20 px-3 py-1 text-slate-300">Question bank not initialized</span>}<span>{bank.total_offline} original offline questions loaded</span>{!bank.finite_verbal&&bank.total_offline>0&&bank.next_pack<=20&&<button disabled={busy} onClick={()=>void expandBank()} className="rounded-full border border-white/15 px-3 py-1 text-[#c4d8fc] disabled:opacity-40">+ Generate 160 more offline</button>}{bank.finite_verbal&&<span>Verbal bank is finite and authored, not infinitely paraphrased</span>}</div>}
        {error&&<div role="alert" className="my-5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        <div className="mt-8 grid grid-cols-3 gap-4" id="progress">
          <div className={`${panel} p-5`}><div className="flex gap-2 items-center text-xs text-slate-400"><Brain size={15}/> Estimated mastery</div><div className="mt-4 text-3xl font-semibold">{avg===null?'—':fmt(avg)}</div><div className="mt-2 text-xs text-slate-500">Model-based estimate, not test score</div></div>
          <div className={`${panel} p-5`}><div className="flex gap-2 items-center text-xs text-slate-400"><Clock3 size={15}/> Skills due for review</div><div className="mt-4 text-3xl font-semibold">{due}</div><div className="mt-2 text-xs text-slate-500">OpenTutor also handles FSRS flashcards</div></div>
          <div className={`${panel} p-5`}><div className="flex gap-2 items-center text-xs text-slate-400"><CircleHelp size={15}/> Confident mistakes</div><div className="mt-4 text-3xl font-semibold">{overview?.high_confidence_mistakes??'—'}</div><div className="mt-2 text-xs text-slate-500">Wrong answers rated 4–5 confidence</div></div>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1.65fr)_minmax(290px,1fr)] gap-5">
          <section className={`${panel} p-7`} aria-label="Adaptive practice">
            <div className="mb-6 flex flex-wrap items-center gap-2"><select aria-label="Practice mode" value={practiceMode} onChange={e=>setPracticeMode(e.target.value as "challenge"|"repair"|"review")} className="rounded-lg border border-white/15 bg-[#121a26] px-3 py-2 text-xs"><option value="challenge">Hard-first challenge</option><option value="repair">Prerequisite repair</option><option value="review">Review due skills</option></select><label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300"><input type="checkbox" checked={quickGrade} onChange={e=>setQuickGrade(e.target.checked)} />Tap to grade</label>{focusSkill&&<button onClick={()=>setFocusSkill("")} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300">Focus: {focusSkill} ×</button>}</div>
            <div className="flex items-center justify-between"><div className="flex gap-2 items-center text-xs font-semibold uppercase tracking-[.16em] text-[#a9bfe2]"><GraduationCap size={16}/> Adaptive question</div><div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{question?.difficulty_layer===3?'Advanced':question?.difficulty_layer===1?'Foundation':'Applied'}</div></div>
            {loading?<div className="mt-12 text-slate-400">Loading your next challenge…</div>:!courseId?<div className="mt-10"><p className="text-slate-300">Pick a subject. Pick a track and start immediately. Documents remain optional in OpenTutor.</p><div className="mt-5 flex flex-wrap gap-2">{SUBJECTS.map(subject=><button key={subject} disabled={creating} onClick={()=>void createSubject(subject)} className="rounded-xl border border-white/15 bg-[#263650] px-4 py-3 text-sm text-[#d9e7ff] hover:bg-[#344761] disabled:opacity-40">{subject}</button>)}</div></div>:!question?<div className="mt-10 text-slate-300"><p>No questions yet in {currentCourse?.name??'this course'}.</p>{bank?.supported===false?<p className="mt-3 text-sm text-slate-400">This OpenTutor course is not a recognized offline exam track. Create a dedicated track above instead of inserting unrelated SAT questions.</p>:<><p className="mt-2 text-sm text-slate-400">Start with a large offline question pack. No AI connection required.</p><button disabled={seeding} onClick={()=>void startWithoutFiles()} className="mt-5 rounded-xl bg-[#d2e1fd] px-5 py-3 text-sm font-semibold text-[#17233a] disabled:opacity-40">{seeding?'Preparing…':'Start practice'}</button></>}</div>:<>
              <div className="mt-5 rounded-lg bg-[#1b2b3e] px-3 py-2 text-xs text-[#cbdaf0]">{question.reason}</div>
              <div className="mt-7 flex flex-wrap gap-2">{(Array.isArray(question.skills)?question.skills:[String(question.skills)]).map(s=><span key={s} className="rounded-md bg-[#26354a] px-2 py-1 text-[11px] text-[#bed0ee]">{s}</span>)}</div>
              {question.graph&&<ProblemGraph data={question.graph}/>}
              <div className="mt-7 whitespace-pre-wrap text-[19px] leading-[1.7] font-medium">{question.question}</div>
              <div className="mt-7 space-y-2" role="group" aria-label="Answer">
                {question.options&&Object.entries(question.options).length?Object.entries(question.options).map(([key,value])=><label key={key} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${answer===key?'border-[#9ab8ee] bg-[#263650]':'border-white/10 hover:bg-white/5'}`}><input type="radio" name="answer" disabled={!!grade||busy} checked={answer===key} onChange={()=>{setAnswer(key);if(quickGrade)void submit(key);}} className="mt-1"/><span><strong className="mr-2">{key}</strong>{value}</span></label>):<input aria-label="Your answer" value={answer} disabled={!!grade} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey)void submit()}} placeholder="Enter your answer" className="w-full rounded-xl border border-white/15 bg-[#0c1018] px-4 py-3 text-sm outline-none focus:border-[#8fa8cf]"/>}
              </div>
              {!grade&&<div className="mt-5 rounded-xl border border-white/10 bg-[#101823] p-4"><div className="flex flex-wrap gap-2"><button disabled={helpBusy} onClick={()=>void getOfflineHelp("hint")} className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/15">Get offline hint</button><button disabled={helpBusy} onClick={()=>void getOfflineHelp("lesson")} className="rounded-lg bg-[#263650] px-3 py-2 text-xs hover:bg-[#344761]">Teach the prerequisite</button></div>{help&&<div className="mt-4 text-xs leading-6 text-[#c9d9f1]">{helpMode==="hint"?<p>{help.hint}</p>:<><p className="font-semibold text-white">{help.skill}</p><p className="mt-2">{help.principle}</p><p className="mt-2 text-slate-200">Worked example: {help.worked_example}</p><p className="mt-2 text-[#9db7de]">Check: {help.transfer_check}</p></>}</div>}</div>}
              <div className="mt-7"><div className="flex justify-between text-xs text-slate-400"><label htmlFor="reasoning">Your reasoning (optional, recommended)</label><span>{thinking.length}/2500</span></div><textarea id="reasoning" value={thinking} onChange={e=>setThinking(e.target.value)} disabled={!!grade} maxLength={2500} rows={3} placeholder="What made you choose that answer? Where were you uncertain?" className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#0c1018] p-3 text-sm outline-none focus:border-[#8fa8cf]"/></div>
              <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-400">Confidence</span><div className="flex gap-2">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setConfidence(n)} disabled={!!grade} className={`h-9 w-9 rounded-lg border text-xs ${n===confidence?'border-[#b5cffb] bg-[#283d5c] text-white':'border-white/10 text-slate-400 hover:border-white/30'}`} aria-label={`Confidence ${n} of 5`}>{n}</button>)}</div></div>
              {grade&&<div role="status" className={`mt-6 rounded-xl border p-4 ${grade.is_correct?'border-emerald-700/50 bg-emerald-900/20':'border-amber-700/50 bg-amber-900/20'}`}><div className="font-semibold">{grade.is_correct?'Correct — now transfer it':'Incorrect — diagnose the gap'}</div>{!grade.is_correct&&<div className="mt-2 text-sm">Correct answer: {grade.correct_answer??'Not provided'}</div>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{grade.explanation||'No explanation available for this question.'}</p>{diagnosis?.hypothesis&&<div className="mt-4 rounded-lg border border-white/10 bg-black/15 p-3 text-sm"><div className="font-semibold text-amber-100">Possible misconception — not a confirmed diagnosis</div><p className="mt-2 text-slate-200">{diagnosis.hypothesis}</p><p className="mt-2 text-xs text-[#bfd1ed]">{diagnosis.verification}</p></div>}{!grade.is_correct&&diagnosis?.probe&&<div className="mt-4 rounded-lg border border-[#5a7397]/50 bg-[#102139] p-4">
                <div className="text-sm font-semibold">Verify the underlying skill — offline</div>
                <p className="mt-1 text-xs text-slate-400">A separate diagnostic question tests a prerequisite. It does not assume why you missed the original.</p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-100">{diagnosis.probe.question}</p>
                <div className="mt-3 space-y-2">{Object.entries(diagnosis.probe.options).map(([letter,content])=><button
                  key={letter} type="button" disabled={probeBusy||!!probeResult}
                  onClick={()=>void checkProbe(letter)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${probeAnswer===letter?'border-[#9bbdf5] bg-[#264263]':'border-white/15 hover:bg-white/5'} disabled:opacity-70`}>{letter}. {content}</button>)}</div>
                {probeResult&&<div className="mt-3 border-t border-white/15 pt-3 text-sm" role="status">
                  <p className={probeResult.correct?'font-semibold text-emerald-200':'font-semibold text-amber-200'}>{probeResult.correct?'Prerequisite applied correctly':'Prerequisite check missed'} · Answer {probeResult.correct_answer}</p>
                  <p className="mt-2 text-slate-200">{probeResult.explanation}</p>
                  <p className="mt-2 text-xs text-[#bfd1ed]">{probeResult.interpretation}</p></div>}
                </div>}{(grade.prerequisite_gaps?.length??0)>0&&<p className="mt-3 text-sm text-amber-200">Check prerequisites: {grade.prerequisite_gaps?.map(g=>g.concept).join(', ')}</p>}</div>}
              <div className="mt-7 flex justify-end">{grade&&(question.effective_mode==='repair'||question.effective_mode==='transfer')&&<button disabled={busy} onClick={()=>void skipRepair()} className="mr-3 rounded-xl border border-white/15 px-4 py-3 text-xs text-slate-300 disabled:opacity-40">Skip repair for now</button>}{!grade?<button onClick={()=>void submit()} disabled={!answer.trim()||busy} className="flex items-center gap-2 rounded-xl bg-[#d2e1fd] px-5 py-3 text-sm font-semibold text-[#17233a] disabled:opacity-40">{busy?'Checking…':'Check answer'}<ArrowRight size={16}/></button>:<button onClick={()=>void refresh(courseId)} className="flex items-center gap-2 rounded-xl bg-[#d2e1fd] px-5 py-3 text-sm font-semibold text-[#17233a]">{grade?.is_correct?'Next challenge':'Continue to repair'} <ArrowRight size={16}/></button>}</div>
            </>}
          </section>
          <div className="space-y-5">
            <section className={`${panel} p-6`}><div className="flex gap-2 items-center text-sm font-semibold"><Target size={17}/> Skills needing attention</div>{!overview?.skills.length?<p className="mt-5 text-sm text-slate-500">Your skill estimates appear after you answer questions.</p>:<div className="mt-5 space-y-5">{overview.skills.slice(0,7).map(s=><div key={s.skill}><div className="flex justify-between gap-3 text-xs"><button title="Focus this skill" onClick={()=>setFocusSkill(s.skill)} className="text-left text-slate-200 truncate hover:text-[#bad0f5]">{s.skill}</button><span className="text-slate-400">{fmt(s.p)}</span></div><div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div style={{width:fmt(s.p)}} className="h-full rounded-full bg-[#9eb8e3]"/></div><div className="mt-1 text-[10px] text-slate-500">{s.n} observations{s.due?' · review due':''}</div></div>)}</div>}</section>
            {!!startingTopics.length && <section className={`${panel} p-6`}><div className="flex gap-2 items-center text-sm font-semibold"><Lightbulb size={17}/> Starting focus</div><p className="mt-2 text-xs text-slate-500">Based on prior study history; validate with fresh questions.</p><div className="mt-4 flex flex-wrap gap-2">{startingTopics.map(t=><span key={t} className="rounded-lg bg-[#253247] px-3 py-2 text-xs text-[#c8d9f5]">{t}</span>)}</div></section>}
            <section className={`${panel} p-6`}><div className="flex gap-2 items-center text-sm font-semibold"><RotateCcw size={17}/> Recent mistakes</div>{!overview?.recent_errors.length?<p className="mt-4 text-sm text-slate-500">No recorded mistakes yet.</p>:<div className="mt-4 space-y-3">{overview.recent_errors.slice(0,5).map((e,i)=><div key={i} className="rounded-lg bg-white/5 p-3"><div className="text-xs font-medium">{e.skill}</div><div className="mt-1 text-xs text-slate-400">{e.error_category||'Needs diagnosis'}{e.confidence?` · confidence ${e.confidence}/5`:''}</div>{e.reasoning&&<p className="mt-2 text-xs leading-5 text-slate-300">Your reasoning: {e.reasoning}</p>}</div>)}</div>}</section>
          </div>
        </div>
        <section className={`${panel} mt-5 p-7`}><div className="flex gap-2 items-center text-sm font-semibold"><Brain size={18}/> Reasoning map</div><p className="mt-2 text-xs text-slate-400">Record what you understand and which claims support it. These are propositions, not mastery scores.</p>
          <div className="mt-5 grid grid-cols-2 gap-5"><div className="space-y-3"><input aria-label="Concept or claim" value={newClaim} maxLength={500} onChange={e=>setNewClaim(e.target.value)} placeholder="Claim: Why does the formula work?" className="w-full rounded-xl border border-white/15 bg-[#0c1018] p-3 text-sm"/><textarea aria-label="Premises" value={newPremises} onChange={e=>setNewPremises(e.target.value)} rows={3} placeholder="One supporting premise per line" className="w-full rounded-xl border border-white/15 bg-[#0c1018] p-3 text-sm"/><button onClick={()=>void saveProposition()} disabled={newClaim.trim().length<4||busy} className="rounded-xl bg-[#d2e1fd] px-4 py-2 text-xs font-semibold text-[#17233a] disabled:opacity-40">Save reasoning</button></div><div className="max-h-72 space-y-3 overflow-auto">{propositions.length===0?<p className="text-sm text-slate-500">Your reasoning propositions will appear here.</p>:propositions.map(p=><div key={p.id} className="rounded-xl border border-white/10 p-4"><div className="text-sm font-medium">{p.claim}</div>{p.premises.length>0&&<div className="mt-2 border-l border-[#9cb7de] pl-3 space-y-1">{p.premises.map((premise,i)=><p key={i} className="text-xs text-slate-400">{premise}</p>)}</div>}</div>)}</div></div>
        </section>
        <section id="tutor" className={`${panel} mt-5 p-7`}><div className="flex items-center justify-between gap-4"><div><div className="flex gap-2 items-center text-sm font-semibold"><Sparkles size={18}/> DeepTutor integration</div><p className="mt-1 text-xs text-slate-400">Offline learning works without this. DeepTutor adds freeform tutoring only when installed and configured.</p></div><div className="flex gap-2">{(['hint','explain','challenge'] as const).map(m=><button key={m} className={`rounded-lg px-3 py-2 text-xs capitalize ${tutorMode===m?'bg-[#2f476b] text-white':'bg-white/5 text-slate-400'}`} onClick={()=>setTutorMode(m)}>{m}</button>)}</div></div>
          <textarea value={tutorQuestion} onChange={e=>setTutorQuestion(e.target.value)} rows={2} placeholder="Ask about a concept, or request a harder transfer question…" className="mt-5 w-full rounded-xl border border-white/15 bg-[#0c1018] px-4 py-3 text-sm"/><div className="mt-3 flex justify-end"><button disabled={!tutorQuestion.trim()||tutorBusy||!courseId} onClick={()=>void askTutor()} className="rounded-xl bg-[#d2e1fd] px-5 py-2.5 text-sm font-semibold text-[#17233a] disabled:opacity-40">{tutorBusy?'Thinking…':'Ask DeepTutor'}</button></div>
          {tutorAnswer&&<div className="mt-5 whitespace-pre-wrap rounded-xl bg-[#0c1018] p-5 text-sm leading-7 text-slate-200">{tutorAnswer}</div>}
        </section>
        <div className="mt-7 flex justify-between text-xs text-slate-500"><span>Mastery estimates are not official SAT or ACT predictions.</span><span>Works without internet after initial installation. Worksheet support remains in OpenTutor.</span></div>
      </main>
    </div>
  </div>;
}
