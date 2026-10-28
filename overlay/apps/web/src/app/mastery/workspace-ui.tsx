"use client";

/**
 * Mastery Engine primary learning workspace.
 * Real authenticated OpenTutor endpoints; every screen has a single job.
 * Official exam claims, predicted scores, and uncalibrated difficulties are intentionally excluded.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listCourseOverview, type CourseOverviewCard } from "@/lib/api/courses";
import { request } from "@/lib/api/client";
import ProblemGraph, { type GraphData } from "./graph";
import styles from "./workspace-ui.module.css";

type Section = "home" | "learn" | "bank" | "solve" | "tests" | "analytics";
type Skill = { name: string; prerequisites: string[]; lesson: { principle: string; worked_example: string; check: string } | null; available_questions: number };
type Curriculum = { track: string; domains: { name: string; skills: Skill[] }[]; scope: string; missing_lessons: string[]; unmapped_question_skills: string[] };
type BankQuestion = { id: string; question: string; skills: string[]; difficulty_layer: number|null; bookmarked: boolean; attempted: boolean; family: string };
type BankResponse = { questions: BankQuestion[]; total: number; limit: number; offset: number; notice: string };
type SolveQuestion = { id: string; question: string; question_type: string; options: Record<string,string>|null; skills: string[]; difficulty_layer: number|null; graph?: GraphData|null };
type Grade = { result_id: string; is_correct: boolean; correct_answer: string|null; explanation: string|null };
type SkillMetric = { skill: string; correct: number; total: number; accuracy: number|null; independent_median_ms: number|null; all_attempts: number; sample_warning: boolean };
type Analytics = { sample_count: number; independent_first_attempts: {correct:number;total:number;accuracy:number|null}; assisted_attempts: {total:number}; repeat_attempts: {total:number}; legacy_unverified_attempts: {total:number}; timing: {independent_median_ms:number|null;correct_median_ms:number|null;wrong_median_ms:number|null}; skills:SkillMetric[]; daily:{date:string;correct:number;total:number;accuracy:number|null}[]; next_action:string; limitations:string[] };
type StudyPlan = { stage:string; reason:string; target_skill:string; steps:{mode:string;minutes:number}[]; lesson?:unknown };
type OfflineHelp = { hint:string; principle:string; worked_example:string; transfer_check:string };
type Probe = { probe_id:string; question:string; options:Record<string,string> };
type Diagnosis = { correct:boolean; hypothesis?:string; certainty?:string; verification?:string; evidence?:string; probe?:Probe|null };
type ProbeFeedback = { correct:boolean; explanation:string; interpretation:string; confidence?:string };

const NAV: { id:Section; label:string; icon:string; desc:string }[] = [
  { id:"home",label:"Home",icon:"⌂",desc:"Your study plan" },
  { id:"learn",label:"Learn",icon:"▤",desc:"Lessons and worked examples" },
  { id:"bank",label:"Question Bank",icon:"▦",desc:"Find questions" },
  { id:"solve",label:"Solve",icon:"✎",desc:"Focused practice" },
  { id:"tests",label:"Practice Tests",icon:"◷",desc:"Exam practice" },
  { id:"analytics",label:"Analytics",icon:"▥",desc:"Measured progress" },
];
const TRACKS = ["SAT Math","SAT Reading & Writing","ACT English","ACT Math","ACT Reading","ACT Science","Algebra 2","Physics"];
function errorText(e:unknown){ return e instanceof Error?e.message:String(e); }
function percentage(n:number|null|undefined){return n==null?"—":`${Math.round(100*n)}%`;}
function duration(ms:number|null|undefined){return ms==null?"—":`${(ms/1000).toFixed(1)}s`;}
function safePath(section:Section,courseId:string,extra=""){
 return `/mastery${section==="home"?"":`/${section}`}${courseId?`?courseId=${encodeURIComponent(courseId)}${extra}`:extra?`?${extra.replace(/^&/,"")}`:""}`;
}

export default function MasteryWorkspace({section}:{section:Section}) {
 const router=useRouter();
 const [courses,setCourses]=useState<CourseOverviewCard[]>([]);
 const [courseId,setCourseId]=useState("");
 const [booting,setBooting]=useState(true);
 const [creating,setCreating]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mobileNav,setMobileNav]=useState(false);
 const activeCourse=courses.find(c=>c.id===courseId);
 const isDebate=activeCourse?.name==="Debate Prep";
 const link=useCallback((name:Section,extra="")=>safePath(name,courseId,extra),[courseId]);
 const [plan,setPlan]=useState<StudyPlan|null>(null);
 const [curriculum,setCurriculum]=useState<Curriculum|null>(null);
 const [lessonSkill,setLessonSkill]=useState("");
 const [bank,setBank]=useState<BankResponse|null>(null);
 const [search,setSearch]=useState("");
 const [skillFilter,setSkillFilter]=useState("");
 const [difficulty,setDifficulty]=useState("0");
 const [status,setStatus]=useState("all");
 const [offset,setOffset]=useState(0);
 const [question,setQuestion]=useState<SolveQuestion|null>(null);
 const [answer,setAnswer]=useState("");
 const [reason,setReason]=useState("");
 const [confidence,setConfidence]=useState(3);
 const [grade,setGrade]=useState<Grade|null>(null);
 const [help,setHelp]=useState<OfflineHelp|null>(null);
 const [diagnosis,setDiagnosis]=useState<Diagnosis|null>(null);
 const [probeFeedback,setProbeFeedback]=useState<ProbeFeedback|null>(null);
 const [probeAnswer,setProbeAnswer]=useState("");
 const [nextPack,setNextPack]=useState(1);
 const [assisted,setAssisted]=useState(false);
 const [bookmarked,setBookmarked]=useState(false);
 const [calculator,setCalculator]=useState(false);
 const [busy,setBusy]=useState(false);
 const [stats,setStats]=useState<Analytics|null>(null);
 const [loading,setLoading]=useState(false);
 const [nextQuestions,setNextQuestions]=useState<BankQuestion[]>([]);

 const started=useRef(Date.now());
 const submissionLock=useRef(false);
 const draftLoaded=useRef(false);

 useEffect(()=>{
  let active=true;
  listCourseOverview().then(items=>{
   if(!active)return;
   const params=new URLSearchParams(window.location.search);
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
 },[]);
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
   const id=new URLSearchParams(window.location.search).get("id");
   setLoading(true);setError("");setGrade(null);setQuestion(null);setHelp(null);setDiagnosis(null);setProbeFeedback(null);setProbeAnswer("");setAssisted(false);setAnswer("");setReason("");setBookmarked(false);draftLoaded.current=false;
   async function load(){
    const url=`/mastery/courses/${courseId}`;
    let item:SolveQuestion|null=null;
    if(id)item=await request<SolveQuestion>(`${url}/questions/${encodeURIComponent(id)}`);
    else{
     const next=await request<{question:SolveQuestion|null}>(`${url}/next`);
     item=next.question;
    }
    if(!item){setNotice("No questions available. Open Question Bank and populate the bank.");return}
    if(!active)return;
    setQuestion(item);started.current=Date.now();
    const [draft,listing]=await Promise.all([
      request<{draft:{response:string;reasoning:string}|null}>(`${url}/questions/${item.id}/draft`),
      request<BankResponse>(`${url}/questions?limit=120`)
    ]);
    if(!active)return;
    setAnswer(draft.draft?.response??"");setReason(draft.draft?.reasoning??"");
    setNextQuestions(listing.questions);
    setBookmarked(listing.questions.some(q=>q.id===item?.id&&q.bookmarked));
    draftLoaded.current=true;
   }
   void load().catch(e=>{if(active)setError(errorText(e))}).finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[courseId,section]);
 // Save ungraded work only after the initial remote draft has loaded. Do not grade or infer mastery on autosave.
 useEffect(()=>{
   if(section!=="solve"||!courseId||!question||!draftLoaded.current||grade)return;
   const id=question.id;
   const timer=setTimeout(()=>{
     void request(`/mastery/courses/${courseId}/questions/${id}/draft`,{method:"PUT",body:JSON.stringify({response:answer,reasoning:reason})})
       .catch(e=>setError(`Draft could not be saved: ${errorText(e)}`));
   },600);
   return ()=>clearTimeout(timer);
 },[section,courseId,question,answer,reason,grade]);
 async function submit(){
  if(!courseId||!question||!answer.trim()||grade||submissionLock.current)return;
  submissionLock.current=true;setBusy(true);setError("");
  try{
   await request("/mastery/prepare",{method:"POST",body:JSON.stringify({course_id:courseId,problem_id:question.id,confidence,reasoning:reason,mode:"challenge",assisted})});
   const result=await request<Grade>("/quiz/submit",{method:"POST",body:JSON.stringify({problem_id:question.id,user_answer:answer,answer_time_ms:Math.max(1,Date.now()-started.current)})});
   setGrade(result);
   if(!result.is_correct){
     setNotice("Review this explanation. Then verify understanding with a fresh question.");
     try{
       const d=await request<Diagnosis>(`/mastery/courses/${courseId}/offline-diagnosis/${question.id}?attempt_id=${result.result_id}`);
       setDiagnosis(d);
     }catch(e){setNotice(`Answer recorded. Optional diagnostic unavailable: ${errorText(e)}`)}
   }
  }catch(e){setError(errorText(e))}finally{submissionLock.current=false;setBusy(false)}
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
 const nextId=question?nextQuestions.find(q=>q.id!==question.id&&!q.attempted)?.id:undefined;
 const selectedNav=NAV.find(n=>n.id===section)!;
 if(booting)return <main className={styles.boot}>Loading your study workspace…</main>;
 return <div className={styles.shell}>
  <aside className={`${styles.side} ${mobileNav?styles.mobileOpen:""}`} aria-label="Primary navigation">
    <Link href={safePath("home",courseId)} className={styles.brand}><span className={styles.mark}>M</span><span>Mastery Engine</span></Link>
    <nav className={styles.nav} aria-label="Study sections">{NAV.map(n=><Link key={n.id} href={link(n.id)} aria-current={section===n.id?"page":undefined} className={`${styles.navItem} ${section===n.id?styles.active:""}`}><span aria-hidden="true" className={styles.navIcon}>{n.icon}</span>{n.label}</Link>)}</nav>
    <div className={styles.sideBottom}><Link href="/mastery/legacy">Legacy study tools</Link><span>Original practice · No official score prediction</span></div>
  </aside>
  <div className={styles.main}>
   <header className={styles.header}>
    <div className={styles.crumb}><button className={styles.mobileMenu} onClick={()=>setMobileNav(x=>!x)} aria-label="Toggle navigation">☰</button> Mastery Engine <span>/</span> <strong>{selectedNav.label}</strong></div>
    <label className={styles.courseSelect}><span>Course</span><select aria-label="Active course" value={courseId} onChange={e=>{setCourseId(e.target.value);router.push(safePath(section,e.target.value))}}><option value="">Select a course</option>{courses.filter(c=>TRACKS.includes(c.name)).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   </header>
   <main className={styles.content}>
    {error&&<div className={styles.error} role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
    {notice&&<div className={styles.note} role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notification">×</button></div>}
    {!courseId&&!isDebate?<section className={styles.welcome}><div className={styles.eyebrow}>Get started</div><h1>Choose what you're studying</h1><p>Each track gets its own learning path, question bank, and progress history.</p><div className={styles.trackGrid}>{TRACKS.map(t=><button key={t} disabled={creating} onClick={()=>void createCourse(t)}>{t}<span>→</span></button>)}</div></section>:
    <>
     {section==="home"&&<><div className={styles.eyebrow}>YOUR STUDY WORKSPACE</div><h1>Make progress, one skill at a time.</h1><p className={styles.sub}>Learn concepts, practice independently, and return to the skills that need work.</p><div className={styles.twoCols}>
      <article className={styles.card}><span className={styles.eyebrow}>RECOMMENDED NEXT</span><h2>{plan?.target_skill||"Continue practicing"}</h2><p>{plan?.reason||"Start with a few independent questions so we can find what needs attention."}</p><div className={styles.buttons}><Link className={styles.primary} href={plan?.stage==="repair"?link("learn"):link("solve")}>{plan?.stage==="repair"?"Open lesson":"Start practicing"} →</Link><Link className={styles.secondary} href={link("bank")}>Browse questions</Link></div></article>
      <article className={styles.card}><h2>Today's structure</h2>{plan?.steps?.length?plan.steps.map((s,i)=><div key={`${s.mode}-${i}`} className={styles.step}><span>{s.mode}</span><strong>{s.minutes} min</strong></div>):<p>We'll recommend a plan once this course is ready.</p>}<p className={styles.caption}>Recommendations are based on recorded practice—not guessed scores.</p></article>
     </div><div className={styles.quickLinks}><Link href={link("learn")}>Go to lessons →</Link><Link href={link("bank")}>Open Question Bank →</Link><Link href={link("analytics")}>Review performance →</Link></div></>}
     {section==="learn"&&<><div className={styles.eyebrow}>MASTERCLASS / LEARN</div><h1>Understand the concept.</h1><p className={styles.sub}>Structured lessons and worked examples. Questions live in their own workspace.</p>{loading?<p>Loading lessons…</p>:<div className={styles.lessonLayout}><div className={styles.lessonList} aria-label="Course curriculum">{curriculum?.domains.map(d=><div key={d.name}><h3>{d.name}</h3>{d.skills.map(s=><button key={s.name} className={`${styles.lessonItem} ${chosenLesson?.name===s.name?styles.lessonActive:""}`} onClick={()=>setLessonSkill(s.name)}>{s.name}</button>)}</div>)}</div><article className={styles.lessonMain}>{chosenLesson?<><div className={styles.eyebrow}>{chosenLesson.domain} · {currentTrack}</div><h2>{chosenLesson.name}</h2>{chosenLesson.prerequisites.length>0&&<p className={styles.caption}>Prerequisites: {chosenLesson.prerequisites.join(", ")}</p>}<h3>The concept</h3><p>{chosenLesson.lesson?.principle??"Lesson undergoing content review."}</p><h3>Worked example</h3><div className={styles.worked}>{chosenLesson.lesson?.worked_example??"A worked example is not available."}</div><h3>Check your understanding</h3><p>{chosenLesson.lesson?.check??"Review the main idea, then try a fresh question."}</p><div className={styles.buttons}><Link href={link("bank",`&skill=${encodeURIComponent(chosenLesson.name)}`)} className={styles.primary}>Find practice questions →</Link><span className={styles.caption}>Practice availability depends on the loaded question bank.</span></div></>:<p>No available lessons in this course.</p>}</article></div>}<p className={styles.footerNote}>{curriculum?.scope}</p></>}
     {section==="bank"&&<><div className={styles.eyebrow}>QUESTION BANK</div><h1>Choose your practice.</h1><p className={styles.sub}>Select questions here; solve them separately. All original content is unofficial and not exam-calibrated.</p><div className={styles.filters}><input aria-label="Search questions" placeholder="Search questions or skills" value={search} onChange={e=>{setSearch(e.target.value);setOffset(0)}}/><input aria-label="Filter skill" placeholder="Exact skill filter" value={skillFilter} onChange={e=>{setSkillFilter(e.target.value);setOffset(0)}}/><select aria-label="Difficulty" value={difficulty} onChange={e=>{setDifficulty(e.target.value);setOffset(0)}}><option value="0">All difficulty layers</option><option value="1">Foundation</option><option value="2">Intermediate</option><option value="3">Advanced</option></select><select aria-label="Question status" value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><option value="all">All questions</option><option value="unseen">Unseen</option><option value="attempted">Attempted</option><option value="bookmarked">Bookmarked</option></select></div>
     <div className={styles.bankTop}><strong>{bank?.total??"—"} questions</strong><span className={styles.caption}>Uncalibrated practice · No official questions</span></div>
     <div className={styles.bankList}>{loading?<p className={styles.empty}>Loading questions…</p>:bank?.questions.length?bank.questions.map(q=><Link key={q.id} className={styles.bankRow} href={link("solve",`&id=${q.id}`)}><div><div className={styles.bankStem}>{q.question}</div><div className={styles.tags}>{q.skills.map(s=><span key={s}>{s}</span>)}<span>Layer {q.difficulty_layer??"?"}</span>{q.attempted&&<span>Attempted</span>}{q.bookmarked&&<span>Saved</span>}</div></div><strong>Open →</strong></Link>):<div className={styles.empty}>No matching questions. Try different filters, or load the starter bank.<div className={styles.buttons}><button disabled={busy} onClick={()=>void seedBank()} className={styles.primary}>Load original question bank</button></div></div>}</div>
     <div className={styles.buttons}><button className={styles.secondary} disabled={busy||loading} onClick={()=>void expandBank()}>{busy?"Loading…":"Add another question pack"}</button></div>
     <div className={styles.pagination}><button disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-30))}>← Previous</button><span>{(bank?.total??0)===0?"0":offset+1}–{Math.min(offset+30,bank?.total??0)} of {bank?.total??0}</span><button disabled={loading||offset+30>=(bank?.total??0)} onClick={()=>setOffset(offset+30)}>Next →</button></div></>}
     {section==="solve"&&<><div className={styles.solveHeader}><Link href={link("bank")} className={styles.back}>← Question Bank</Link><div className={styles.solveTools}><button aria-pressed={bookmarked} onClick={()=>void saveBookmark()} disabled={!question}>{bookmarked?"★ Saved":"☆ Bookmark"}</button>{currentTrack.includes("Math")||currentTrack==="Algebra 2"?<button aria-pressed={calculator} onClick={()=>setCalculator(x=>!x)}>▦ Desmos</button>:null}</div></div>{loading?<p className={styles.empty}>Loading your question…</p>:question?<div className={`${styles.solveLayout} ${calculator?styles.withCalculator:""}`}><article className={styles.solveCard}><div className={styles.questionMeta}>{question.skills.join(" · ")} <span>Practice layer {question.difficulty_layer??"unverified"}</span></div><h1 className={styles.questionStem}>{question.question}</h1>{question.graph&&<div className={styles.graph}><ProblemGraph data={question.graph}/></div>}{question.options?<fieldset className={styles.choices} disabled={!!grade||busy}><legend className={styles.srOnly}>Choose your answer</legend>{Object.entries(question.options).map(([key,label])=><label key={key} className={`${styles.choice} ${answer===key?styles.choiceActive:""}`}><input type="radio" checked={answer===key} onChange={()=>setAnswer(key)} name="mastery-answer" value={key}/><span className={styles.letter}>{key}</span><span>{label}</span></label>)}</fieldset>:<textarea aria-label="Your answer" className={styles.response} value={answer} disabled={!!grade} onChange={e=>setAnswer(e.target.value)} placeholder="Enter your answer"/>}<label className={styles.reasonLabel}>Optional reasoning <textarea rows={2} value={reason} disabled={!!grade} onChange={e=>setReason(e.target.value)} placeholder="What led you to this answer?"/></label><div className={styles.buttons}><button className={styles.secondary} onClick={()=>void revealHint()} disabled={!!grade||busy}>{help?"Hint shown":"Need a hint?"}</button><button className={styles.primary} onClick={()=>void submit()} disabled={!answer.trim()||!!grade||busy}>{busy?"Working…":"Check answer"}</button></div>{help&&!grade&&<div className={styles.hint}><strong>Hint</strong><p>{help.hint||help.principle}</p><span>Hinted work is recorded separately from independent mastery.</span></div>}{grade&&<div role="status" className={`${styles.feedback} ${grade.is_correct?styles.correct:styles.incorrect}`}><h3>{grade.is_correct?"Correct":"Not yet"}</h3><p>{grade.explanation||"Review this skill and try a fresh question."}</p><p className={styles.caption}>Answer: {grade.correct_answer??"Available after review"}</p>{diagnosis&&!grade.is_correct&&<div className={styles.diagnostic}><h3>Why this may have gone wrong</h3><p>{diagnosis.hypothesis||"A prerequisite check can narrow down the cause."}</p><p className={styles.caption}>{diagnosis.certainty||"Hypothesis, not a diagnosis of your reasoning."}</p>{diagnosis.probe&&<div><strong>Check a prerequisite</strong><p>{diagnosis.probe.question}</p><div className={styles.probeChoices}>{Object.entries(diagnosis.probe.options).map(([key,value])=><button key={key} disabled={!!probeFeedback||busy} aria-pressed={probeAnswer===key} onClick={()=>void submitProbe(key)}>{key}. {value}</button>)}</div>{probeFeedback&&<p role="status">{probeFeedback.correct?"Correct. ":"Not quite. "}{probeFeedback.explanation}</p>}</div>}</div>}
      <div className={styles.buttons}><Link className={styles.secondary} href={link("learn")}>Review lesson</Link>{nextId?<a href={link("solve",`&id=${nextId}`)} className={styles.primary}>Next unseen question →</a>:<Link href={link("bank")} className={styles.primary}>Return to bank →</Link>}</div></div>}</article>{calculator&&<aside className={styles.calc}><header><strong>Desmos web calculator (online)</strong><button onClick={()=>setCalculator(false)} aria-label="Close calculator">×</button></header><iframe title="Desmos online graphing calculator" src="https://www.desmos.com/calculator" allow="clipboard-read; clipboard-write"/><p>Requires an internet connection. Embedding and offline use have not been verified; if blocked, open Desmos separately. Offline practice still works without this calculator.</p></aside>}</div>:<div className={styles.empty}>No question loaded. <Link href={link("bank")}>Choose a question</Link>.</div>}</>}
     {section==="tests"&&<><div className={styles.eyebrow}>PRACTICE TESTS</div><h1>Test your knowledge.</h1><p className={styles.sub}>True exam simulations require validated section blueprints and timing rules. We will not manufacture exam scores.</p><article className={styles.card}><h2>Independent timed practice</h2><p>Practice with unfamiliar questions and review your performance in Analytics. Full-length, exam-calibrated SAT and ACT simulations remain a release gate.</p><div className={styles.buttons}><Link className={styles.primary} href={link("bank", "&status=unseen")}>Choose an unseen set →</Link><Link className={styles.secondary} href={link("analytics")}>Review past attempts</Link></div></article><div className={styles.footerNote}>This is not an official Bluebook or ACT test. Do not treat practice accuracy as a scaled score.</div></>}
     {section==="analytics"&&<><div className={styles.eyebrow}>PERFORMANCE ANALYTICS</div><h1>Know what to improve.</h1><p className={styles.sub}>Based on recorded attempts, with assisted answers and repeats kept separate.</p>{loading?<p>Loading analytics…</p>:stats?<><div className={styles.statGrid}><article className={styles.card}><span className={styles.caption}>Independent first-attempt accuracy</span><div className={styles.stat}>{percentage(stats.independent_first_attempts.accuracy)}</div><p>{stats.independent_first_attempts.correct} of {stats.independent_first_attempts.total} fresh unassisted questions</p></article><article className={styles.card}><span className={styles.caption}>Median independent solving time</span><div className={styles.stat}>{duration(stats.timing.independent_median_ms)}</div><p>Correct: {duration(stats.timing.correct_median_ms)} · Incorrect: {duration(stats.timing.wrong_median_ms)}</p></article><article className={styles.card}><span className={styles.caption}>Other attempts</span><div className={styles.stat}>{stats.assisted_attempts.total+stats.repeat_attempts.total}</div><p>{stats.assisted_attempts.total} assisted · {stats.repeat_attempts.total} repeats</p></article></div><article className={styles.card}><h2>Skill performance</h2>{stats.skills.length?stats.skills.map(s=><div key={s.skill} className={styles.skillRow}><div className={styles.skillText}><strong>{s.skill}</strong><span>{s.correct}/{s.total} independent · {s.sample_warning?"Small sample":"Descriptive"}</span></div><div className={styles.barTrack}><div className={styles.barFill} style={{width:percentage(s.accuracy)==="—"?"0%":percentage(s.accuracy)}}/></div><strong>{percentage(s.accuracy)}</strong></div>):<p>No independent data yet. Solve some new questions to unlock performance details.</p>}</article><article className={styles.card}><h2>Recommended next action</h2><p>{stats.next_action}</p><div className={styles.buttons}><Link href={link("bank")} className={styles.primary}>Practice this skill →</Link></div></article><details className={styles.limitations}><summary>What these numbers cannot tell you</summary><ul>{stats.limitations.map((v,i)=><li key={i}>{v}</li>)}</ul></details></>:<p>Analytics unavailable.</p>}</>}
    </>}
   </main>
  </div>
 </div>
}
