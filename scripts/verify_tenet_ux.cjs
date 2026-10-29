/* Real rendered UX checks. Called only by the disposable-owner browser harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function setTheme(page, theme) {
  const target = page.getByRole('button', {name: `Switch to ${theme} theme`, exact:true});
  if (await target.count()) await target.click();
  await page.waitForFunction(t => document.documentElement.classList.contains('dark') === (t === 'dark'), theme);
  await page.getByRole('button',{name:`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`,exact:true}).waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function captureState(page, state, shots) {
  for (const theme of ['dark','light']) {
    await setTheme(page, theme);
    await page.screenshot({path:path.join(shots, `${theme}-${state}.png`)});
  }
}
async function inspectReadability(page) {
  return page.evaluate(() => {
    const rgb = s => (s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
    const lum = c => c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const bg = el => {for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p).backgroundColor; if(!s.endsWith(', 0)') && s!=='transparent')return rgb(s)}return [255,255,255]};
    const visible = el => {
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height||r.bottom<=0||r.top>=innerHeight||getComputedStyle(el).visibility==='hidden')return false;
      for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none')return false;if(/auto|scroll|hidden/.test(s.overflowY)){const b=p.getBoundingClientRect();if(r.top>=b.bottom||r.bottom<=b.top)return false}}
      return true;
    };
    const failures=[];let checked=0;
    for(const el of document.querySelectorAll('main p,main h1,main h2,main h3,main label,main figcaption,main button,main a,main summary,header button,[role="option"],main [class*="caption"],main [class*="eyebrow"]')){
      if(!visible(el)||!el.textContent.trim()||el.closest('button:disabled,fieldset:disabled,[aria-disabled="true"]'))continue;
      const s=getComputedStyle(el),a=lum(rgb(s.color)),b=lum(bg(el));
      const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05); checked++;
      if(ratio<4.5)failures.push({text:el.textContent.trim().slice(0,70),ratio:Number(ratio.toFixed(2)),color:s.color,bg:bg(el)});
    }
    const main=document.querySelector('[data-tenet-content]');
    // A transparent content pane inherits its visible canvas from the shell.
    return {checked,failures,background:`rgb(${bg(main).join(', ')})`,dimensions:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},viewport:{w:innerWidth,h:innerHeight}};
  });
}
async function verifyReading(page,{base,reading,api,shots}) {
  let question;
  for(let offset=0;offset<480&&!question;offset+=120){
    const bank=await api(`/mastery/courses/${reading}/questions?limit=120&offset=${offset}`);
    question=bank.questions.find(q=>q.question.includes('\n\n'));
    if(offset+120>=bank.total)break;
  }
  assert(question,'Reading fixture must include an authored multiline passage');
  await page.goto(`${base}/mastery/solve?courseId=${reading}&id=${question.id}`,{waitUntil:'networkidle'});
  await page.locator('input[type=radio]').first().waitFor();
  assert.equal(await page.locator('h1').textContent(),question.question,'Preserve the exact reading passage and prompt');
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    await page.screenshot({path:path.join(shots,`${theme}-reading-passage.png`)});
    assert(['pre-wrap','pre-line'].includes(await page.locator('h1').evaluate(el=>getComputedStyle(el).whiteSpace)),'Reading paragraph breaks must remain visible');
  }
}
async function verifyUX(page,{base,course,physics,reading,api,shots}) {
  const checks=[];
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${base}/mastery?courseId=${course}`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Study queue',exact:true}).waitFor();
  await setTheme(page,'light');
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Switch to dark theme',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('theme')),'light','Theme choice must persist');
  await page.emulateMedia({colorScheme:'dark'});
  assert(!await page.evaluate(()=>document.documentElement.classList.contains('dark')),'Saved light override must survive OS preference change');
  await page.emulateMedia({colorScheme:'light'});
  const practice=page.getByRole('link',{name:'Start recommended practice',exact:true});
  assert(new URL(await practice.getAttribute('href'),base).pathname.endsWith('/solve'),'Home practice opens Solve directly');
  await practice.click();
  await page.locator('input[type=radio]').first().waitFor();
  await page.goto(`${base}/mastery/bank?courseId=${course}`,{waitUntil:'networkidle'});
  const difficulty=page.getByRole('button',{name:'Difficulty',exact:true});
  await difficulty.click();await page.keyboard.press('a');
  assert.match(await page.locator(':focus').innerText(),/Advanced/,'Listbox typeahead');
  await page.keyboard.press('Escape');
  assert(await difficulty.evaluate(el=>el===document.activeElement),'Escape returns focus to trigger');
  await difficulty.click();await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('listbox').count(),0,'Tab dismisses listbox');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Question status','Tab moves to next control');
  for(const theme of ['dark','light']){
    await setTheme(page,theme);
    await page.getByRole('button',{name:'Active course',exact:true}).click();
    await page.screenshot({path:path.join(shots,`${theme}-course-picker.png`)});
    assert.deepEqual((await inspectReadability(page)).failures,[],'Expanded selector contrast');
    await page.keyboard.press('Escape');
  }
  await verifyReading(page,{base,reading,api,shots});
  const routes=[['','Study queue'],['/learn','Learn the skills.'],['/bank','Find the right questions.'],['/solve',null],['/tests','Practice under pressure.'],['/analytics','Your performance, explained.']];
  const viewports=[[1440,900],[1280,800],[390,844],[375,812],[844,390]];
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    for(const theme of ['light','dark']){
      for(const [route,heading] of routes){
        await page.goto(`${base}/mastery${route}?courseId=${course}`,{waitUntil:'networkidle'});
        if(heading)await page.getByRole('heading',{name:heading,exact:true}).waitFor();
        else await page.locator('input[type=radio]').first().waitFor();
        await setTheme(page,theme);
        const result=await inspectReadability(page);
        assert.deepEqual(result.failures,[],`Text contrast ${theme} ${route} ${width}: ${JSON.stringify(result.failures)}`);
        assert(result.dimensions.w<=width+1 && result.dimensions.h<=height+1,`Viewport overflow ${route} ${width}`);
        const rgba=result.background.match(/[\d.]+/g).slice(0,3).map(Number);
        if(theme==='light')assert(rgba.every(v=>v>=250),`Light main canvas must be white: ${result.background}`);
        else assert(rgba.every(v=>v<60),`Dark canvas did not switch: ${result.background}`);
        if(route!=='/solve'){
          const nav=page.getByRole('navigation',{name:'Study sections'});
          assert.equal(await nav.getByRole('link').count(),5);
          for(const link of await nav.getByRole('link').all()){
            const box=await link.boundingBox();assert(box.width>=44 && box.height>=44,'44px nav touch target');
          }
          if(width>760)assert((await page.getByRole('complementary',{name:'Primary navigation'}).boundingBox()).width<=80);
        }
        const tag=`${theme}-${route.slice(1)||'home'}-${width}`;
        await page.screenshot({path:path.join(shots,`${tag}.png`)});
        fs.writeFileSync(path.join(shots,`${tag}.aria.yml`),await page.locator('body').ariaSnapshot());
        checks.push({route,theme,width,height,textNodesChecked:result.checked});
      }
    }
  }
  // Real graph data from the untouched Physics course, not illustrative chart values.
  const bank=await api(`/mastery/courses/${physics}/questions?limit=120`);
  let graphQuestion;
  for(const q of bank.questions.filter(q=>q.skills.some(s=>s.includes('graph')))){
    const detail=await api(`/mastery/courses/${physics}/questions/${q.id}`);
    if(detail.graph){graphQuestion=detail;break}
  }
  assert(graphQuestion,'Physics fixture must provide an actual graph');
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${base}/mastery/solve?courseId=${physics}&id=${graphQuestion.id}`,{waitUntil:'networkidle'});
  await page.getByRole('figure').waitFor();
  await captureState(page,'physics-graph',shots);
  await setTheme(page,'light');
  const figure=await page.getByRole('figure').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(figure,'rgb(255, 255, 255)','Graph wrapper must switch to white');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${base}/mastery?courseId=${course}`,{waitUntil:'networkidle'});
  assert.equal(await page.getByRole('link',{name:'Home',exact:true}).evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%'});
  const zoom=await inspectReadability(page);
  assert(zoom.dimensions.w<=390 && zoom.dimensions.h<=844,'Large text must remain inside the viewport');
  await page.screenshot({path:path.join(shots,'light-large-text-reduced-motion.png')});
  await page.getByRole('link',{name:'Skip to study content',exact:true}).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'),'tenet-main','Skip link must move focus to main');
  await page.evaluate(()=>{document.documentElement.style.fontSize=''});
  await page.emulateMedia({reducedMotion:'no-preference'});
  fs.writeFileSync(path.join(shots,'theme-audit.json'),JSON.stringify({status:'pass',viewports:viewports.length,themes:['light','dark'],screens:checks,graph:'real Physics data',largeText:'200%',reducedMotion:true,keyboard:true},null,2));
  return {viewports:viewports.length,themes:2,routeScreenshots:checks.length};
}
module.exports={setTheme,captureState,verifyReading,verifyUX};
