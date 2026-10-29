"use client";

/**
 * Tenet primary learning workspace.
 * Real authenticated OpenTutor endpoints; every screen has a single job.
 * Official exam claims, predicted scores, and uncalibrated difficulties are intentionally excluded.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { listCourseOverview, type CourseOverviewCard } from "@/lib/api/courses";
import { request } from "@/lib/api/client";
import ProblemGraph, { type GraphData } from "./graph";
import styles from "./workspace-ui.module.css";

type Section = "home" | "learn" | "bank" | "solve" | "tests" | "analytics";
type Skill = { name: string; prerequisites: string[]; lesson: { principle: string; worked_example: string; check: string } | null; available_questions: number };
type Curriculum = { track: string; domains: { name: string; skills: Skill[] }[]; scope: string; missing_lessons: string[]; unmapped_question_skills: string[] };
type BankQuestion = { id: string; question: string; skills: string[]; difficulty_layer: number|null; bookmarked: boolean; attempted: boolean; family: string };
type BankResponse = { questions: BankQuestion[]; total: number; limit: number; offset: number; notice: string };
type LearningGuidance = {first_step:"attempt_before_hint";scaffold:"independent"|"worked_example_available";prompt:string;interleaved:boolean};
type SolveQuestion = { bookmarked?:boolean; effective_mode?:"challenge"|"repair"|"review"|"transfer";learning_guidance?:LearningGuidance; id: string; question: string; question_type: string; options: Record<string,string>|null; skills: string[]; difficulty_layer: number|null; graph?: GraphData|null };
type Grade = { result_id: string; is_correct: boolean; correct_answer: string|null; explanation: string|null };
type SkillMetric = { skill: string; correct: number; total: number; accuracy: number|null; independent_median_ms: number|null; all_attempts: number; sample_warning: boolean };
type Analytics = { delayed_retention?:{correct:number;total:number;accuracy:number|null};independent_transfer?:{correct:number;total:number;accuracy:number|null}; sample_count: number; other_attempts:{total:number}; independent_first_attempts: {correct:number;total:number;accuracy:number|null}; assisted_attempts: {total:number}; repeat_attempts: {total:number}; legacy_unverified_attempts: {total:number}; timing: {independent_median_ms:number|null;correct_median_ms:number|null;wrong_median_ms:number|null}; skills:SkillMetric[]; daily:{date:string;correct:number;total:number;accuracy:number|null}[]; next_action:string; limitations:string[] };
type StudyPlan = { stage:string; reason:string; target_skill:string; steps:{mode:string;minutes:number;skill?:string;task?:string}[]; lesson?:unknown };
type OfflineHelp = { hint:string; principle:string; worked_example:string; transfer_check:string };
type Probe = { probe_id:string; question:string; options:Record<string,string> };
type Diagnosis = { correct:boolean; hypothesis?:string; certainty?:string; verification?:string; evidence?:string; probe?:Probe|null };
type ProbeFeedback = { correct:boolean; explanation:string; interpretation:string; confidence?:string };

const NAV: { id:Section; label:string; icon:string; desc:string }[] = [
  { id:"home",label:"Home",icon:"home",desc:"Your study plan" },
  { id:"learn",label:"Learn",icon:"book",desc:"Lessons and worked examples" },
  { id:"bank",label:"Question Bank",icon:"grid",desc:"Find questions" },
  { id:"tests",label:"Practice Tests",icon:"clock",desc:"Exam practice" },
  { id:"analytics",label:"Analytics",icon:"chart",desc:"Measured progress" },
];
const ICON_PATHS:Record<string,string[]> = {
  home:["M3 10.5 12 3l9 7.5","M5 9.5V20h5v-6h4v6h5V9.5"],
  book:["M12 6.8c-2.4-1.65-5.4-2.1-9-1.2v13c3.6-.9 6.6-.45 9 1.2","M12 6.8c2.4-1.65 5.4-2.1 9-1.2v13c-3.6-.9-6.6-.45-9 1.2","M12 6.8v13"],
  grid:["M4 4.5h6.5V11H4z","M13.5 4.5H20V11h-6.5z","M4 14h6.5v6.5H4z","M13.5 14H20v6.5h-6.5z"],
  clock:["M12 3.25a8.75 8.75 0 1 0 0 17.5 8.75 8.75 0 1 0 0-17.5","M12 7.5V12l3.25 2"],
  chart:["M4.5 20V13.5","M9.5 20V9","M14.5 20v-5.5","M19.5 20V4"],
  sun:["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8","M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"],
  moon:["M20 13A8.3 8.3 0 0 1 11 4a8.5 8.5 0 1 0 9 9Z"],
  bookmark:["M6 3h12v18l-6-4-6 4Z"],
  calculator:["M5 3h14v18H5Z","M8 7h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 3h1m6 0h1"],
  check:["m5 12 4 4L19 6"],
};
function NavIcon({name}:{name:string}){
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
   {(ICON_PATHS[name]??ICON_PATHS.home).map((d,index)=><path key={index} d={d}/>)}
 </svg>;
}
function ThemeSwitch(){
 const {theme,resolvedTheme,setTheme}=useTheme();
 const dark=resolvedTheme==="dark";
 useEffect(()=>{
  if(!resolvedTheme)return;
  const native=window as Window & {webkit?:{messageHandlers?:{tenetAppearance?:{postMessage:(value:unknown)=>void}}}};
  native.webkit?.messageHandlers?.tenetAppearance?.postMessage({appearance:theme??"system",resolved:resolvedTheme});
 },[theme,resolvedTheme]);
 return <button type="button" className={styles.iconButton} onClick={()=>setTheme(dark?"light":"dark")} aria-label={dark?"Switch to light theme":"Switch to dark theme"} title={dark?"Switch to light theme":"Switch to dark theme"}><NavIcon name={dark?"sun":"moon"}/></button>;
}
type SelectOption={value:string;label:string};
/** Custom listbox: controlled, focusable, keyboard navigable, no OS-native picker. */
function PremiumSelect({value,options,onChange,label,className="",disabled=false}:{value:string;options:SelectOption[];onChange:(value:string)=>void;label:string;className?:string;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const button=useRef<HTMLButtonElement>(null);
 const listId=useId();
 const typeahead=useRef({value:"",at:0});
 const selectedIndex=Math.max(0,options.findIndex(o=>o.value===value));
 useEffect(()=>{
  if(!open)return;
  const outside=(ev:PointerEvent)=>{if(!root.current?.contains(ev.target as Node))setOpen(false)};
  document.addEventListener("pointerdown",outside);
  return ()=>document.removeEventListener("pointerdown",outside);
 },[open]);
 const focusOption=(index:number)=>{
  const items=root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
  items?.[Math.max(0,Math.min(items.length-1,index))]?.focus();
 };
 useLayoutEffect(()=>{if(open)focusOption(selectedIndex)},[open,selectedIndex]);
 function close(){setOpen(false);requestAnimationFrame(()=>button.current?.focus())}
 function keyDown(ev:KeyboardEvent){
  if(ev.key==="Escape"&&open){ev.preventDefault();close();return}
  if(ev.key==="Tab"&&open){setOpen(false);button.current?.focus();return}
  if(!open){if(["ArrowDown","ArrowUp","Enter"," "].includes(ev.key)){ev.preventDefault();setOpen(true)}return}
  if(["ArrowDown","ArrowUp","Home","End"].includes(ev.key)){
   ev.preventDefault();const list=root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
   const focused=Array.from(list??[]).findIndex(x=>x===document.activeElement);
   const next=ev.key==="Home"?0:ev.key==="End"?options.length-1:ev.key==="ArrowDown"?(focused+1)%options.length:(focused-1+options.length)%options.length;
   focusOption(next);
  }
  if(ev.key==="Enter"||ev.key===" "){
   ev.preventDefault();const chosen=root.current?.querySelector<HTMLButtonElement>('[role="option"]:focus');
   if(chosen){onChange(chosen.dataset.value??"");close()}
  }
  if(ev.key.length===1&&!ev.ctrlKey&&!ev.metaKey&&!ev.altKey&&ev.key!==" "){
   ev.preventDefault();const now=ev.timeStamp;
   typeahead.current={value:now-typeahead.current.at<650?typeahead.current.value+ev.key.toLowerCase():ev.key.toLowerCase(),at:now};
   const typed=typeahead.current.value;
   const query=[...typed].every(char=>char===typed[0])?typed[0]:typed;
   const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]);
   const active=items.findIndex(item=>item===document.activeElement);
   const start=(active<0?selectedIndex:active)+(query.length===1?1:0);
   const match=Array.from({length:options.length},(_,i)=>(start+i)%options.length).find(i=>options[i].label.toLowerCase().startsWith(query))??-1;
   if(match>=0)focusOption(match);
  }
 }
 return <div ref={root} className={`${styles.premiumSelect} ${className}`} onKeyDown={keyDown}>
  <button ref={button} type="button" disabled={disabled} className={styles.selectTrigger} aria-label={label} aria-haspopup="listbox" aria-controls={open?listId:undefined} aria-expanded={open} onClick={()=>setOpen(x=>!x)}>
   <span>{options.find(o=>o.value===value)?.label??"Select…"}</span><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
  </button>
  {open&&<div id={listId} className={styles.dropdownMenu} role="listbox" aria-label={label}>
   {options.map((o,i)=><button type="button" tabIndex={-1} id={`${listId}-${i}`} key={o.value} data-value={o.value} className={styles.dropdownOption} role="option" aria-selected={o.value===value} onClick={()=>{onChange(o.value);close()}}><span>{o.label}</span>{o.value===value&&<span aria-hidden="true" className={styles.checkmark}>✓</span>}</button>)}
  </div>}
 </div>
}
function TrendChart({daily}:{daily:{date:string;correct:number;total:number;accuracy:number|null}[]}){
 const points=daily.filter(d=>d.total>0&&d.accuracy!==null).slice(-12);
 if(points.length<2)return <p>At least two days of fresh independent attempts are needed to show a trend.</p>;
 const coords=points.map((d,i)=>({x:24+i*(652/Math.max(1,points.length-1)),y:178-140*(d.accuracy??0)}));
 const path=coords.map((pt,i)=>`${i?"L":"M"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
 return <svg viewBox="0 0 700 220" role="img" aria-label={`Independent accuracy trend over ${points.length} recorded study days`} className={styles.trendSvg}>
   {[0,.5,1].map(v=><g key={v}><line x1="24" x2="680" y1={178-140*v} y2={178-140*v} stroke="var(--chart-grid)" strokeDasharray="3 6"/><text x="0" y={182-140*v} fontSize="12" fill="var(--muted)">{Math.round(v*100)}</text></g>)}
   <path d={path} fill="none" stroke="var(--chart-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
   {coords.map((pt,i)=><circle key={`${points[i].date}-${i}`} cx={pt.x} cy={pt.y} r="4.5" fill="var(--panel)" stroke="var(--chart-line)" strokeWidth="2.5"><title>{`${points[i].date}: ${Math.round((points[i].accuracy??0)*100)}% from ${points[i].total} attempts`}</title></circle>)}
   <text x="24" y="204" fontSize="12" fill="var(--muted)">{points[0].date}</text>
   <text x="680" y="204" textAnchor="end" fontSize="12" fill="var(--muted)">{points[points.length-1].date}</text>
 </svg>;
}
const TRACKS = ["SAT Math","SAT Reading & Writing","ACT English","ACT Math","ACT Reading","ACT Science","Algebra 2","Physics"];
function errorText(e:unknown){ return e instanceof Error?e.message:String(e); }
function percentage(n:number|null|undefined){return n==null?"—":`${Math.round(100*n)}%`;}
function duration(ms:number|null|undefined){return ms==null?"—":`${(ms/1000).toFixed(1)}s`;}
function safePath(section:Section,courseId:string,extra=""){
 return `/mastery${section==="home"?"":`/${section}`}${courseId?`?courseId=${encodeURIComponent(courseId)}${extra}`:extra?`?${extra.replace(/^&/,"")}`:""}`;
}

export default function MasteryWorkspace({section}:{section:Section}) {
 const params=useSearchParams();
 const query=params.toString();
 return <WorkspaceState key={`${section}:${query}`} section={section} query={query}/>;
}
function WorkspaceState({section,query}:{section:Section;query:string}) {
 const router=useRouter();
 const [courses,setCourses]=useState<CourseOverviewCard[]>([]);
 const [courseId,setCourseId]=useState("");
 const [booting,setBooting]=useState(true);
 const [creating,setCreating]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [selectedPlanStep,setSelectedPlanStep]=useState(0);
 const activeCourse=courses.find(c=>c.id===courseId);
 const isDebate=activeCourse?.name==="Debate Prep";
 const link=useCallback((name:Section,extra="")=>safePath(name,courseId,extra),[courseId]);
 const [plan,setPlan]=useState<StudyPlan|null>(null);
 const [homeQuestions,setHomeQuestions]=useState<BankQuestion[]>([]);
 const [curriculum,setCurriculum]=useState<Curriculum|null>(null);
 const [lessonSkill,setLessonSkill]=useState("");
 const [revealedSkill,setRevealedSkill]=useState("");
 const [bank,setBank]=useState<BankResponse|null>(null);
 const [search,setSearch]=useState("");
 const [skillFilter,setSkillFilter]=useState("");
 const [difficulty,setDifficulty]=useState("0");
 const [status,setStatus]=useState("all");
 const [offset,setOffset]=useState(0);
 const [question,setQuestion]=useState<SolveQuestion|null>(null);
 const [answer,setAnswer]=useState("");
 const [reason,setReason]=useState("");
 const [confidence,setConfidence]=useState<number|null>(null);
 const [grade,setGrade]=useState<Grade|null>(null);
 const [help,setHelp]=useState<OfflineHelp|null>(null);
 const [diagnosis,setDiagnosis]=useState<Diagnosis|null>(null);
 const [probeFeedback,setProbeFeedback]=useState<ProbeFeedback|null>(null);
 const [probeAnswer,setProbeAnswer]=useState("");
 const [nextPack,setNextPack]=useState(1);
 const [assisted,setAssisted]=useState(false);
 const [practiceMode,setPracticeMode]=useState<"challenge"|"repair"|"review"|"transfer">("challenge");
 const [bookmarked,setBookmarked]=useState(false);
 const [calculator,setCalculator]=useState(false);
 const [busy,setBusy]=useState(false);
 const [stats,setStats]=useState<Analytics|null>(null);
 const [loading,setLoading]=useState(false);
 const [draftStatus,setDraftStatus]=useState<"loading"|"saving"|"saved"|"error"|"recorded">("loading");
 const draftGeneration=useRef(0);

 const started=useRef(Date.now());
 const submissionLock=useRef(false);
 const draftLoaded=useRef(false);
 const draftRevision=useRef<string|null>(null);
 const draftWrites=useRef<Promise<void>>(Promise.resolve());
 const draftSaveError=useRef<unknown>(null);
 const draftTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

 useEffect(()=>{
  let active=true;
  listCourseOverview().then(items=>{
   if(!active)return;
   const params=new URLSearchParams(query);
   const requested=params.get("courseId");
   const requestedSkill=params.get("skill");
   if(requestedSkill)setLessonSkill(requestedSkill);
   const saved=window.localStorage.getItem("mastery:course");
   const chosen=items.find(c=>c.id===requested)||items.find(c=>c.id===saved)||items.find(c=>TRACKS.includes(c.name));
   setCourses(items);setCourseId(chosen?.id??"");setBooting(false);
   if(section==="bank"){
    const requestedSkill=params.get("skill");const requestedStatus=params.get("status");
    if(requestedSkill)setSkillFilter(requestedSkill);
    if(requestedStatus&&["all","unseen","attempted","bookmarked"].includes(requestedStatus))setStatus(requestedStatus);
   }
  }).catch(e=>{if(active){setError(errorText(e));setBooting(false)}});
  return ()=>{active=false};
 },[section,query]);
 useEffect(()=>{if(courseId)window.localStorage.setItem("mastery:course",courseId)},[courseId]);
 async function createCourse(track:string){
  setCreating(true);setError("");
  try{
   const course=await request<CourseOverviewCard>("/courses/",{method:"POST",body:JSON.stringify({name:track,description:"Original offline practice and adaptive mastery",metadata:{mastery_track:track}})});
   await request(`/mastery/courses/${course.id}/starter-questions`,{method:"POST"});
   setCourses(prev=>[course,...prev]);setCourseId(course.id);
   router.push(safePath(section,course.id));
   setNotice(`${track} ready.`);
  }catch(e){setError(errorText(e))}finally{setCreating(false)}
 }
 const currentTrack=activeCourse?.name??"";
 useEffect(()=>{
  if(!courseId)return;
  let active=true;
  setError("");setLoading(true);
  const url=`/mastery/courses/${courseId}`;
  const data=section==="home"?request<StudyPlan>(`${url}/study-plan?minutes=20`):
      section==="learn"?request<Curriculum>(`${url}/curriculum`):
      section==="analytics"?request<Analytics>(`${url}/analytics`):Promise.resolve(null);
  data.then(value=>{
    if(!active)return;
    if(section==="home")setPlan(value as StudyPlan);
    if(section==="learn")setCurriculum(value as Curriculum);
    if(section==="analytics")setStats(value as Analytics);
  }).catch(e=>{if(active)setError(errorText(e))}).finally(()=>{if(active)setLoading(false)});
  return ()=>{active=false};
 },[courseId,section]);
 useEffect(()=>{
  if(!courseId||section!=="home")return;
  let active=true;
  request<BankResponse>(`/mastery/courses/${courseId}/questions?limit=15&offset=0&status=unseen`)
   .then(data=>{if(active)setHomeQuestions(data.questions)})
   .catch(()=>{if(active)setHomeQuestions([])});
  return ()=>{active=false};
 },[courseId,section]);
 useEffect(()=>{
   if(!courseId||section!=="bank")return;
   const controller={cancelled:false};
   setLoading(true);setError("");
   const params=new URLSearchParams({limit:"30",offset:String(offset),status,difficulty,skill:skillFilter,query:search});
   request<BankResponse>(`/mastery/courses/${courseId}/questions?${params}`)
     .then(data=>{if(!controller.cancelled)setBank(data)})
     .catch(e=>{if(!controller.cancelled)setError(errorText(e))})
     .finally(()=>{if(!controller.cancelled)setLoading(false)});
   return ()=>{controller.cancelled=true};
 },[courseId,section,search,skillFilter,status,difficulty,offset]);
 useEffect(()=>{
   if(!courseId||section!=="solve")return;
   let active=true;
   const params=new URLSearchParams(query);
   const id=params.get("id");
   const focusSkill=params.get("skill")||"";
   const requestedMode=params.get("mode");
   const mode=(requestedMode==="repair"||requestedMode==="review"||requestedMode==="transfer")?requestedMode:"challenge";
   setPracticeMode(mode);
   setLoading(true);setError("");setGrade(null);setQuestion(null);setHelp(null);setDiagnosis(null);setProbeFeedback(null);setProbeAnswer("");setAssisted(false);setAnswer("");setReason("");setBookmarked(false);draftLoaded.current=false;
   async function load(){
    const url=`/mastery/courses/${courseId}`;
    let item:SolveQuestion|null=null;
    if(id)item=await request<SolveQuestion>(`${url}/questions/${encodeURIComponent(id)}`);
    else{
     const next=await request<{question:SolveQuestion|null}>(`${url}/next?mode=${mode}&focus_skill=${encodeURIComponent(focusSkill)}`);
     item=next.question;
     if(item?.effective_mode)setPracticeMode(item.effective_mode);
    }
    if(!item){setNotice("No questions available. Open Question Bank and populate the bank.");return}
    if(!active)return;
    setQuestion(item);started.current=Date.now();
    const draft=await request<{draft:{response:string;reasoning:string}|null;base_result_id:string|null}>(`${url}/questions/${item.id}/draft`);
    if(!active)return;
    setAnswer(draft.draft?.response??"");setReason(draft.draft?.reasoning??"");
    setBookmarked(Boolean(item.bookmarked));
    draftRevision.current=draft.base_result_id;
    draftLoaded.current=true;
    setDraftStatus("saved");
   }
   void load().catch(e=>{if(active)setError(errorText(e))}).finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[courseId,section,query]);
 // Save ungraded work only after the initial remote draft has loaded. Do not grade or infer mastery on autosave.
 useEffect(()=>{
   if(section!=="solve"||!courseId||!question||!draftLoaded.current||grade||submissionLock.current)return;
   const id=question.id;
   const base_result_id=draftRevision.current;
   const generation=++draftGeneration.current;
   setDraftStatus("saving");
   const timer=setTimeout(()=>{
     if(submissionLock.current)return;
     draftWrites.current=draftWrites.current.then(async()=>{
       try {
         await request(`/mastery/courses/${courseId}/questions/${id}/draft`,{method:"PUT",body:JSON.stringify({response:answer,reasoning:reason,base_result_id})});
         draftSaveError.current=null;
         if(generation===draftGeneration.current&&!submissionLock.current)setDraftStatus("saved");
       } catch(e) {draftSaveError.current=e;setDraftStatus("error");setError(`Draft could not be saved: ${errorText(e)}`)}
     });
   },600);
   draftTimer.current=timer;
   return ()=>clearTimeout(timer);
 },[section,courseId,question,answer,reason,grade]);
 async function submit(){
  if(!courseId||!question||!answer.trim()||grade||submissionLock.current)return;
  submissionLock.current=true;setBusy(true);setError("");setDraftStatus("saving");
  if(draftTimer.current)clearTimeout(draftTimer.current);
  let draftSaved=false;
  try{
   await draftWrites.current;
   // An explicit retry writes the current response even if a background save failed.
   await request(`/mastery/courses/${courseId}/questions/${question.id}/draft`,{method:"PUT",body:JSON.stringify({response:answer,reasoning:reason,base_result_id:draftRevision.current})});
   draftSaveError.current=null;draftSaved=true;setDraftStatus("saved");
   await request("/mastery/prepare",{method:"POST",body:JSON.stringify({course_id:courseId,problem_id:question.id,confidence,reasoning:reason,mode:practiceMode,assisted})});
   const result=await request<Grade>("/quiz/submit",{method:"POST",body:JSON.stringify({problem_id:question.id,user_answer:answer,answer_time_ms:Math.max(1,Date.now()-started.current)})});
   setGrade(result);
   setDraftStatus("recorded");
   if(!result.is_correct){
     setNotice("Review this explanation. Then verify understanding with a fresh question.");
     try{
       const d=await request<Diagnosis>(`/mastery/courses/${courseId}/offline-diagnosis/${question.id}?attempt_id=${result.result_id}`);
       setDiagnosis(d);
     }catch(e){setNotice(`Answer recorded. Optional diagnostic unavailable: ${errorText(e)}`)}
   }
  }catch(e){setError(errorText(e));setDraftStatus(draftSaved?"saved":"error")}finally{submissionLock.current=false;setBusy(false)}
 }
 async function revealHint(){
  if(!question||!courseId||grade)return;
  setBusy(true);setError("");
  try{const h=await request<OfflineHelp>(`/mastery/courses/${courseId}/offline-help/${question.id}`);setHelp(h);setAssisted(true)}
  catch(e){setError(errorText(e))}finally{setBusy(false)}
 }
 async function submitProbe(selected:string){
   if(!question||!courseId||!grade||!diagnosis?.probe||probeFeedback||busy)return;
   setProbeAnswer(selected);setBusy(true);setError("");
   try{
     const result=await request<ProbeFeedback>(`/mastery/courses/${courseId}/offline-probe/${question.id}`,{method:"POST",body:JSON.stringify({probe_id:diagnosis.probe.probe_id,attempt_id:grade.result_id,selected})});
     setProbeFeedback(result);
   }catch(e){setError(errorText(e))}finally{setBusy(false)}
 }
 async function saveBookmark(){
  if(!question||!courseId)return;
  try{
    const saved=!bookmarked;
    await request(`/mastery/courses/${courseId}/questions/${question.id}/bookmark`,{method:"PUT",body:JSON.stringify({saved})});
    setBookmarked(saved);
  }catch(e){setError(errorText(e))}
 }
 async function seedBank(){
   if(!courseId)return;
   setBusy(true);setError("");
   try{
    const s=await request<{added:number}>(`/mastery/courses/${courseId}/starter-questions`,{method:"POST"});
    setNotice(`${s.added} original questions added.`);
    setOffset(0);setBank(null);
    const params=new URLSearchParams({limit:"30",offset:"0",status,difficulty,skill:skillFilter,query:search});
    const data=await request<BankResponse>(`/mastery/courses/${courseId}/questions?${params}`);
    setBank(data);
   }catch(e){setError(errorText(e))}finally{setBusy(false)}
 }
 async function expandBank(){
   if(!courseId)return;
   setBusy(true);setError("");
   try{
     const state=await request<{next_pack:number}>(`/mastery/courses/${courseId}/bank-status`);
     const pack=Math.max(nextPack,state.next_pack);
     const result=await request<{added:number}>(`/mastery/courses/${courseId}/expand?pack=${pack}`,{method:"POST"});
     setNextPack(pack+1);
     setNotice(`Added ${result.added} original questions from pack ${pack}; duplicates excluded.`);
     const params=new URLSearchParams({limit:"30",offset:String(offset),status,difficulty,skill:skillFilter,query:search});
     setBank(await request<BankResponse>(`/mastery/courses/${courseId}/questions?${params}`));
   }catch(e){setError(errorText(e))}finally{setBusy(false)}
 }
 const allSkills=useMemo(()=>curriculum?.domains.flatMap(d=>d.skills.map(s=>({...s,domain:d.name})))??[],[curriculum]);
 const chosenLesson=allSkills.find(s=>s.name===lessonSkill)||allSkills[0];
 const sectionLabel=section==="solve"?"Solve":NAV.find(n=>n.id===section)?.label??"Home";
 const selectedStep=plan?.steps?.[selectedPlanStep];
 const selectedSkill=selectedStep?.skill||plan?.target_skill||"";
 const recommendationHref=link("solve",`&mode=${selectedStep?.mode==="review"||plan?.stage==="review"?"review":"challenge"}&skill=${encodeURIComponent(selectedSkill)}`);
 const recommendationLabel=selectedStep?.mode==="learn"?"Try concept recall":selectedStep?.mode==="review"?"Start review":"Start studying";
 if(booting)return <section className={styles.boot} role="status" aria-busy="true"><span className={styles.loadingMark} aria-hidden="true"/>Loading your study workspace…</section>;
 return <div className={`${styles.shell} ${section==="solve"?styles.focusMode:""}`}>
  <a href="#tenet-main" className={styles.skipLink}>Skip to study content</a>
  <aside className={styles.side} aria-label="Primary navigation">
   <div className={styles.dock}>
    <Link href={safePath("home",courseId)} aria-label="Tenet Home" data-tooltip="Tenet Home" className={styles.brand}><span className={styles.mark}>T</span><span className={styles.brandLabel}>Tenet</span></Link>
    <nav className={styles.nav} aria-label="Study sections">{NAV.map(n=><Link key={n.id} href={link(n.id)} aria-label={n.label} data-tooltip={n.label} aria-current={section===n.id?"page":undefined} className={`${styles.navItem} ${section===n.id?styles.active:""}`}><span className={styles.navIcon}><NavIcon name={n.icon}/></span></Link>)}</nav>
   </div>
  </aside>
  <div className={styles.main}>
   <header className={styles.header}>
    <div className={styles.crumb}>Tenet <span>/</span> <strong>{sectionLabel}</strong></div>
    <div className={styles.headerControls}><div className={styles.courseSelect}><span>Course</span><PremiumSelect label="Active course" value={courseId} options={[{value:"",label:"Select a course"},...courses.filter(c=>TRACKS.includes(c.name)).map(c=>({value:c.id,label:c.name}))]} onChange={id=>{setCourseId(id);router.push(safePath(section,id))}} /></div><ThemeSwitch/></div>
   </header>
   <section id="tenet-main" data-tenet-content tabIndex={-1} aria-label="Study workspace" className={styles.content}>
    {error&&<div className={styles.error} role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
    {notice&&<div className={styles.note} role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notification">×</button></div>}
    {!courseId&&!isDebate?<section className={styles.welcome}><div className={styles.eyebrow}>Get started</div><h1>Choose what you&apos;re studying</h1><p>Each track gets its own learning path, question bank, and progress history.</p><div className={styles.trackGrid}>{TRACKS.map(t=><button key={t} disabled={creating} onClick={()=>void createCourse(t)}>{t}<span>→</span></button>)}</div></section>:
    <>
     {section==="home"&&<section className={styles.homeWorkspace} aria-label="Study plan">
       <div className={styles.workspaceTitle}><div><div className={styles.eyebrow}>YOUR WORKSPACE <span aria-hidden="true"> / </span> {currentTrack}</div><h1>Study queue</h1><p className={styles.sub}>Your next actions, prioritized from recorded learning evidence.</p></div><Link className={styles.primary} aria-label="Start recommended practice" href={recommendationHref}>{recommendationLabel} →</Link></div>
       <div className={styles.homeColumns}>
        <div className={styles.studyQueue} aria-label="Recommended study actions">
         <div className={styles.queueToolbar}><span>Recommended next</span><span>{plan?.steps?.length??0} study blocks</span></div>
         {loading?<div className={styles.empty}>Preparing your study plan…</div>:plan?.steps?.length?plan.steps.map((step,i)=><button type="button" key={`${step.mode}-${i}`} className={`${styles.studyRow} ${selectedPlanStep===i?styles.studyRowActive:""}`} onClick={()=>setSelectedPlanStep(i)} aria-pressed={selectedPlanStep===i}>
          <span className={styles.studyStatus} aria-hidden="true"/><span className={styles.studyCode}>{`TN-${String(i+1).padStart(3,"0")}`}</span><span className={styles.studyRowName}>{i===0&&plan.target_skill?plan.target_skill:step.mode.replace(/_/g," ")}</span><span className={styles.studyRowMode}>{step.mode.replace(/_/g," ")}</span><span className={styles.studyTime}>{step.minutes} min</span>
         </button>):<div className={styles.empty}>Your study queue is waiting for initial practice evidence. <Link href={recommendationHref}>Start your first question →</Link></div>}
         {homeQuestions.length>0&&<><div className={styles.queueToolbar}><span>Available independent practice</span><span>{homeQuestions.length} unseen questions</span></div>
          {homeQuestions.map((item,i)=><Link key={item.id} className={styles.studyRow} href={link("solve",`&id=${encodeURIComponent(item.id)}`)} title={item.question}>
           <span className={styles.studyStatusMuted} aria-hidden="true"/><span className={styles.studyCode}>{`Q-${String(i+1).padStart(3,"0")}`}</span><span className={styles.studyRowName}>{item.question}</span><span className={styles.studyRowMode}>{item.skills[0]||"Practice"}</span><span className={styles.studyTime}>↗</span>
          </Link>)}</>}
         <div className={styles.queueToolbar}><span>Other workspaces</span><span>Jump to</span></div>
         {[{title:"Learning library",href:link("learn"),type:"Lessons"},{title:"Question Bank",href:link("bank"),type:"Practice"},{title:"Performance analytics",href:link("analytics"),type:"Insights"}].map((item,i)=><Link key={item.title} href={item.href} className={styles.studyRow}><span className={styles.studyStatusMuted} aria-hidden="true"/><span className={styles.studyCode}>{`GO-${String(i+1).padStart(3,"0")}`}</span><span className={styles.studyRowName}>{item.title}</span><span className={styles.studyRowMode}>{item.type}</span><span className={styles.studyTime}>↗</span></Link>)}
        </div>
        <aside className={styles.inspector} aria-label="Selected recommendation details">
         <div className={styles.inspectorHeader}>Study details <span aria-hidden="true">···</span></div>
         <div className={styles.inspectorBody}>
          <div className={styles.eyebrow}>RECOMMENDED / {currentTrack}</div>
          <h2>{selectedPlanStep===0?(plan?.target_skill||"Begin your first practice"):(plan?.steps?.[selectedPlanStep]?.mode?.replace(/_/g," ")||"Study block")}</h2>
          <p>{selectedPlanStep===0?(plan?.reason||"Complete independent questions to generate a personalized study sequence."):(selectedStep?.task||"The next step in your personalized study sequence.")}</p>
          <Link className={styles.secondary} href={recommendationHref}>Open this practice →</Link>
          <div className={styles.inspectorRule}/>
          <div className={styles.inspectorProperty}><span>Track</span><strong>{currentTrack}</strong></div>
          <div className={styles.inspectorProperty}><span>Activity</span><strong>{plan?.steps?.[selectedPlanStep]?.mode?.replace(/_/g," ")??"Practice"}</strong></div>
          <div className={styles.inspectorProperty}><span>Est. time</span><strong>{plan?.steps?.[selectedPlanStep]?.minutes??"—"} min</strong></div>
          <div className={styles.inspectorRule}/>
          <div className={styles.eyebrow}>WHAT HAPPENS NEXT</div><p className={styles.inspectorHint}>You&apos;ll work on a fresh problem, see the evidence behind your result, and get a targeted follow-up if needed.</p>
         </div>
        </aside>
       </div>
      </section>}
     {section==="learn"&&<><div className={styles.eyebrow}>MASTERCLASS / LEARN</div><h1>Learn the skills.</h1><p className={styles.sub}>Structured concepts, examples, and independent checks. Lessons stay separate from practice.</p>{loading?<p>Loading lessons…</p>:<div className={styles.lessonLayout}><div className={styles.lessonList} aria-label="Course curriculum">{curriculum?.domains.map(d=><div key={d.name}><h3>{d.name}</h3>{d.skills.map(s=><button key={s.name} className={`${styles.lessonItem} ${chosenLesson?.name===s.name?styles.lessonActive:""}`} onClick={()=>setLessonSkill(s.name)}>{s.name}</button>)}</div>)}</div><article className={styles.lessonMain}>{chosenLesson?<><div className={styles.eyebrow}>{chosenLesson.domain} · {currentTrack}</div><h2>{chosenLesson.name}</h2>{chosenLesson.prerequisites.length>0&&<p className={styles.caption}>Prerequisites: {chosenLesson.prerequisites.join(", ")}</p>}<h3>The concept</h3><p>{chosenLesson.lesson?.principle??"Lesson undergoing content review."}</p><h3>Check your understanding</h3><p>{chosenLesson.lesson?.check??"Review the main idea, then try a fresh question."}</p><p className={styles.caption}>Try to recall the key idea before opening the example.</p><h3>Worked example</h3>{revealedSkill===chosenLesson.name?<div className={styles.worked}>{chosenLesson.lesson?.worked_example??"A worked example is not available."}</div>:<button type="button" className={styles.secondary} onClick={()=>setRevealedSkill(chosenLesson.name)}>Reveal worked example</button>}<div className={styles.buttons}><Link href={link("bank",`&skill=${encodeURIComponent(chosenLesson.name)}`)} className={styles.primary}>Find practice questions →</Link><span className={styles.caption}>Practice availability depends on the loaded question bank.</span></div></>:<p>No available lessons in this course.</p>}</article></div>}<p className={styles.footerNote}>{curriculum?.scope}</p></>}
     {section==="bank"&&<><div className={styles.eyebrow}>QUESTION BANK</div><h1>Find the right questions.</h1><p className={styles.sub}>Filter by what you need to work on, then open a focused solving session. Practice content is unofficial and not exam-calibrated.</p><div className={styles.filters}><label className={styles.field}><span>Search</span><input aria-label="Search questions" placeholder="Search questions or skills" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}}/></label><label className={styles.field}><span>Skill</span><input aria-label="Filter skill" placeholder="Exact skill filter" value={skillFilter} onChange={e=>{setSkillFilter(e.target.value);setOffset(0)}}/></label><div className={styles.field}><span>Difficulty</span><PremiumSelect label="Difficulty" value={difficulty} options={[{value:"0",label:"All difficulty layers"},{value:"1",label:"Foundation"},{value:"2",label:"Intermediate"},{value:"3",label:"Advanced"}]} onChange={value=>{setDifficulty(value);setOffset(0)}}/></div><div className={styles.field}><span>Status</span><PremiumSelect label="Question status" value={status} options={[{value:"all",label:"All questions"},{value:"unseen",label:"Unseen"},{value:"attempted",label:"Attempted"},{value:"bookmarked",label:"Bookmarked"}]} onChange={value=>{setStatus(value);setOffset(0)}}/></div></div>
     <div className={styles.bankTop}><strong>{bank?.total??"—"} questions</strong><span className={styles.caption}>Uncalibrated practice · No official questions</span></div>
     <div className={styles.bankList}>{loading?<p className={styles.empty}>Loading questions…</p>:bank?.questions.length?bank.questions.map((q,index)=><Link key={q.id} className={styles.bankRow} href={link("solve",`&id=${encodeURIComponent(q.id)}`)}><span className={styles.bankOrdinal}>{String(offset+index+1).padStart(2,"0")}</span><div><div className={styles.bankStem}>{q.question}</div><div className={styles.tags}>{q.skills.map(s=><span key={s}>{s}</span>)}<span>Layer {q.difficulty_layer??"?"}</span>{q.attempted&&<span>Attempted</span>}{q.bookmarked&&<span>Saved</span>}</div></div><strong>Open →</strong></Link>):<div className={styles.empty}>No matching questions. Try different filters, or load the starter bank.<div className={styles.buttons}><button disabled={busy} onClick={()=>void seedBank()} className={styles.primary}>Load original question bank</button></div></div>}</div>
     <div className={styles.buttons}><button className={styles.secondary} disabled={busy||loading} onClick={()=>void expandBank()}>{busy?"Loading…":"Add another question pack"}</button></div>
     <div className={styles.pagination}><button disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-30))}>← Previous</button><span>{(bank?.total??0)===0?"0":offset+1}–{Math.min(offset+30,bank?.total??0)} of {bank?.total??0}</span><button disabled={loading||offset+30>=(bank?.total??0)} onClick={()=>setOffset(offset+30)}>Next →</button></div></>}
     {section==="solve"&&<><div className={styles.solveHeader}><Link href={link("bank")} className={styles.back}>← Question Bank</Link><div className={styles.solveTools}><button aria-pressed={bookmarked} onClick={()=>void saveBookmark()} disabled={!question}><NavIcon name="bookmark"/>{bookmarked?"Saved":"Bookmark"}</button>{currentTrack.includes("Math")||currentTrack==="Algebra 2"?<button aria-pressed={calculator} onClick={()=>setCalculator(x=>!x)}><NavIcon name="calculator"/>Desmos</button>:null}</div></div>{loading?<p className={styles.empty}>Loading your question…</p>:question?<div className={`${styles.solveLayout} ${calculator?styles.withCalculator:""}`}><article className={styles.solveCard}><div className={styles.questionMeta}>{question.skills.join(" · ")} <span>Practice layer {question.difficulty_layer??"unverified"}</span></div><div className={styles.caption} role="status">Attempt from memory before requesting a hint. {question.learning_guidance?.scaffold==="worked_example_available"?"A worked example is available if you need a foundation reset.":"Explain the method before checking your answer."}{question.learning_guidance?.interleaved?" This question is mixed practice to strengthen method selection.":""}</div><h1 className={styles.questionStem}>{question.question}</h1>{question.graph&&<div className={styles.graph}><ProblemGraph data={question.graph}/></div>}{question.options?<fieldset className={styles.choices} disabled={!!grade||busy}><legend className={styles.srOnly}>Choose your answer</legend>{Object.entries(question.options).map(([key,label])=><label key={key} className={`${styles.choice} ${answer===key?styles.choiceActive:""}`}><input type="radio" checked={answer===key} onChange={()=>setAnswer(key)} name="mastery-answer" value={key}/><span className={styles.letter}>{key}</span><span>{label}</span></label>)}</fieldset>:<textarea aria-label="Your answer" className={styles.response} value={answer} disabled={!!grade||busy} onChange={e=>setAnswer(e.target.value)} placeholder="Enter your answer"/>}<label className={styles.reasonLabel}>Optional reasoning <textarea rows={2} value={reason} disabled={!!grade||busy} onChange={e=>setReason(e.target.value)} placeholder="What led you to this answer?"/></label><div className={styles.buttons}><span className={styles.caption}>Confidence (optional)</span><PremiumSelect label="Confidence" disabled={!!grade||busy} value={confidence==null?"":String(confidence)} options={[{value:"",label:"Not recorded"},...['Very unsure','Unsure','Somewhat confident','Confident','Very confident'].map((label,i)=>({value:String(i+1),label}))]} onChange={value=>setConfidence(value?Number(value):null)}/></div><div className={styles.buttons}><button className={styles.secondary} onClick={()=>void revealHint()} disabled={!!grade||busy}>{help?"Hint shown":"Need a hint?"}</button><button className={styles.primary} onClick={()=>void submit()} disabled={!answer.trim()||!!grade||busy}>{busy?"Working…":"Check answer"}</button><span className={styles.saveStatus} role="status" aria-live="polite" aria-atomic="true">{draftStatus==="saved"&&<NavIcon name="check"/>}{draftStatus==="saving"?"Saving…":draftStatus==="saved"?"Draft saved":draftStatus==="recorded"?"Answer recorded":draftStatus==="error"?"Save failed — retry your answer":"Loading draft…"}</span></div>{help&&!grade&&<div className={styles.hint}><strong>Hint</strong><p>{help.hint||help.principle}</p>{question.learning_guidance?.scaffold==="worked_example_available"&&help.worked_example&&<details><summary>Show a worked example for this skill</summary><p>{help.worked_example}</p><p>Now try a different question without help to verify understanding.</p></details>}<span>Hinted work is recorded separately from independent mastery.</span></div>}{grade&&<div role="status" className={`${styles.feedback} ${grade.is_correct?styles.correct:styles.incorrect}`}><h3>{grade.is_correct?"Correct":"Not yet"}</h3><p>{grade.explanation||"Review this skill and try a fresh question."}</p><p className={styles.caption}>Answer: {grade.correct_answer??"Available after review"}</p>{diagnosis&&!grade.is_correct&&<div className={styles.diagnostic}><h3>Why this may have gone wrong</h3><p>{diagnosis.hypothesis||"A prerequisite check can narrow down the cause."}</p><p className={styles.caption}>{diagnosis.certainty||"Hypothesis, not a diagnosis of your reasoning."}</p>{diagnosis.probe&&<div><strong>Check a prerequisite</strong><p>{diagnosis.probe.question}</p><div className={styles.probeChoices}>{Object.entries(diagnosis.probe.options).map(([key,value])=><button key={key} disabled={!!probeFeedback||busy} aria-pressed={probeAnswer===key} onClick={()=>void submitProbe(key)}>{key}. {value}</button>)}</div>{probeFeedback&&<p role="status">{probeFeedback.correct?"Correct. ":"Not quite. "}{probeFeedback.explanation}</p>}</div>}</div>}
      <div className={styles.buttons}><Link className={styles.secondary} href={link("learn",question.skills[0]?`&skill=${encodeURIComponent(question.skills[0])}`:"")}>Review lesson</Link><a href={link("solve","&mode=challenge")} className={styles.primary}>Next adaptive question →</a></div></div>}</article>{calculator&&<aside className={styles.calc}><header><strong>Desmos web calculator (online)</strong><button onClick={()=>setCalculator(false)} aria-label="Close calculator">×</button></header><iframe title="Desmos online graphing calculator" src="https://www.desmos.com/calculator" allow="clipboard-read; clipboard-write"/><p>Requires internet. Embedded operation and licensing remain release gates. <a href="https://www.desmos.com/calculator" target="_blank" rel="noopener noreferrer">Open Desmos in your browser</a> if the panel is blocked.</p></aside>}</div>:<div className={styles.empty}>No question loaded. <Link href={link("bank")}>Choose a question</Link>.</div>}</>}
     {section==="tests"&&<><div className={styles.eyebrow}>PRACTICE TESTS</div><h1>Practice under pressure.</h1><p className={styles.sub}>True exam simulations require validated section blueprints and timing rules. Until then, use independent practice without a fabricated score.</p><article className={styles.card}><h2>Independent practice</h2><p>Practice with unfamiliar questions and review your performance in Analytics. Full-length, exam-calibrated SAT and ACT simulations remain a release gate.</p><div className={styles.buttons}><Link className={styles.primary} href={link("bank", "&status=unseen")}>Choose an unseen set →</Link><Link className={styles.secondary} href={link("analytics")}>Review past attempts</Link></div></article><div className={styles.footerNote}>This is not an official Bluebook or ACT test. Do not treat practice accuracy as a scaled score.</div></>}
     {section==="analytics"&&<><div className={styles.eyebrow}>PERFORMANCE ANALYTICS</div><h1>Your performance, explained.</h1><p className={styles.sub}>A clear view of what is improving, what is not, and the evidence behind the recommendation.</p>{loading?<p>Loading analytics…</p>:stats?<><div className={styles.statGrid}><article className={styles.card}><span className={styles.caption}>Independent first-attempt accuracy</span><div className={styles.stat}>{percentage(stats.independent_first_attempts.accuracy)}</div><p>{stats.independent_first_attempts.correct} of {stats.independent_first_attempts.total} fresh unassisted questions</p></article><article className={styles.card}><span className={styles.caption}>Median independent solving time</span><div className={styles.stat}>{duration(stats.timing.independent_median_ms)}</div><p>Correct: {duration(stats.timing.correct_median_ms)} · Incorrect: {duration(stats.timing.wrong_median_ms)}</p></article><article className={styles.card}><span className={styles.caption}>Other attempts</span><div className={styles.stat}>{stats.other_attempts.total}</div><p>{stats.assisted_attempts.total} assisted · {stats.repeat_attempts.total} repeats</p></article></div><div className={styles.analyticsBody}>
       <article className={styles.card}><h2>Delayed retention</h2><div className={styles.stat}>{percentage(stats.delayed_retention?.accuracy)}</div><p>{stats.delayed_retention?.total??0} fresh independent reviews at least 20 hours after exposure · {stats.delayed_retention?.total&&stats.delayed_retention.total<5?"Small sample":"Descriptive only"}</p><h3>Independent transfer</h3><p>{stats.independent_transfer?.correct??0} / {stats.independent_transfer?.total??0} fresh, unaided questions tagged as transfer. Not a validated far-transfer measure.</p></article>
       <article className={styles.card}><h2>Accuracy by skill</h2>{stats.skills.length?stats.skills.map(skill=><div key={skill.skill} className={styles.skillRow}><div className={styles.skillText}><strong>{skill.skill}</strong><span>{skill.correct}/{skill.total} independent · {skill.sample_warning?"Small sample":"Descriptive"}</span></div><div className={styles.barTrack}><div className={styles.barFill} style={{width:percentage(skill.accuracy)==="—"?"0%":percentage(skill.accuracy)}}/></div><strong>{percentage(skill.accuracy)}</strong></div>):<p>No independent data yet. Solve fresh questions to unlock skill-level results.</p>}</article>
       <article className={styles.card}><div className={styles.eyebrow}>RECOMMENDED NEXT</div><h2>Where to focus</h2><p>{stats.next_action}</p><div className={styles.buttons}><Link href={link("bank")} className={styles.primary}>Find targeted questions ↗</Link></div><p className={styles.caption}>Recommendations may change as new independent attempts are recorded.</p></article>
      </div>
      <div className={styles.trendPanel}><h2>Independent accuracy over time</h2><p>Only fresh, unassisted attempts. Individual days can be noisy when sample sizes are small.</p><TrendChart daily={stats.daily}/></div>
      <details className={styles.limitations}><summary>What these numbers cannot tell you</summary><ul>{stats.limitations.map((v,i)=><li key={i}>{v}</li>)}</ul></details></>:<p>Analytics unavailable.</p>}</>}
    </>}
   </section>
  </div>
 </div>
}
