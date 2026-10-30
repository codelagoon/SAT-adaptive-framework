/* Real production app journeys. Only run with disposable, isolated learner data. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const {captureState,verifyUX}=require('./verify_tenet_ux.cjs');
const base = process.env.TENET_E2E_URL || 'http://127.0.0.1:18766';
const data = process.env.MASTERY_DATA_DIR;
const shots = path.resolve(process.env.TENET_SCREENSHOTS || 'build/ui-evidence');
assert(new URL(base).hostname === '127.0.0.1');
assert(data && fs.existsSync(path.join(data, '.release-smoke')), 'Requires disposable smoke data');
fs.mkdirSync(shots, { recursive: true });
const courses = [];
async function api(url, method = 'GET', body) {
  const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw Error(`${method} ${url}: ${r.status} ${await r.text()}`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
function keyFor(id) {
  const p = spawnSync(process.env.TENET_PYTHON, ['-c',
    'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute("SELECT correct_answer FROM practice_problems WHERE id=? OR id=?",(sys.argv[2],sys.argv[2].replace("-",""))).fetchone()[0])',
    path.join(data, 'opentutor.sqlite3'), id], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
}
(async () => {
  let browser;
  let activePage;
  try {
    const health = await api('/mastery/health');
    assert.equal(fs.realpathSync(path.dirname(health.data_file)), fs.realpathSync(data));
    assert(health.user_id, 'Real local learner identity required');
    for (const track of ['SAT Math', 'Physics', 'SAT Reading & Writing']) {
      const c = await api('/courses/', 'POST', { name: track, description: 'Disposable Tenet browser verification', metadata: { mastery_track: track } });
      courses.push(c.id); await api(`/mastery/courses/${c.id}/starter-questions`, 'POST');
    }
    const course = courses[0], prefix = `/mastery/courses/${course}`;
    const questions = (await api(`${prefix}/questions?limit=30`)).questions;
    assert(questions.length >= 3);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--disable-gpu'], timeout: 45000 });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const page = await context.newPage(), errors = [];
    activePage = page;
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`); });
    async function visit(route, heading) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      if (heading) await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await page.locator('main').getByRole('alert').count(), 0, await page.locator('body').innerText());
      assert.deepEqual(errors, [], 'Browser console/page errors');
    }
    await visit(`/mastery?courseId=${course}`, 'Study queue');
    await page.waitForTimeout(6500);
    await visit(`/mastery?courseId=${course}`, 'Study queue');
    await page.getByRole('button', {name:/TN-002/}).click();
    const recommendation = page.getByRole('complementary', {name:'Selected recommendation details'}).getByRole('link');
    assert(new URL(await recommendation.getAttribute('href'), base).pathname.endsWith('/solve'), 'Selecting Solve block must open Solve, not the first Learn block');
    await page.getByRole('navigation', {name:'Study sections'}).getByRole('link', { name: 'Question Bank', exact: true }).click();
    await page.getByRole('heading', { name: 'Find the right questions.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Difficulty', exact: true }).click();
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Difficulty', exact: true }).click();
    await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    await page.getByRole('textbox', { name: 'Search questions', exact: true }).fill('no-such-tenet-question-9287');
    await page.getByText('No matching questions.', { exact: false }).waitFor();
    await page.getByRole('textbox', { name: 'Search questions', exact: true }).fill('');
    await page.locator('a[href*="/mastery/solve"][href*="id="]').first().waitFor();
    let raceExercised=false;
    async function solve(item, assisted, correct) {
      await visit(`/mastery/solve?courseId=${course}&id=${item.id}`, item.question);
      assert.equal(await page.getByRole('navigation', { name: 'Study sections' }).isVisible(), false);
      const key = keyFor(item.id), answer = correct ? key : ['A', 'B', 'C', 'D'].find(k => k !== key);
      await page.locator(`input[type=radio][value="${answer}"]`).check();
      assert.equal(await page.getByRole('textbox',{name:'Optional reasoning'}).isVisible(),false,'Optional reflection stays out of the answer flow');
      await page.locator('summary').filter({hasText:'Reasoning & confidence'}).click();
      await page.getByRole('textbox', { name: 'Optional reasoning' }).fill('Tenet browser persistence check');
      await page.waitForTimeout(900);
      assert.equal((await api(`${prefix}/questions/${item.id}/draft`)).draft.response, answer);
      await page.getByText('Draft saved',{exact:true}).waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: item.question, exact: true }).waitFor();
      assert(await page.locator(`input[type=radio][value="${answer}"]`).isChecked(), 'Draft must survive reload');
      if (assisted) {
        await page.getByRole('button', { name: 'Bookmark', exact: false }).click();
        assert((await api(`${prefix}/questions?status=bookmarked`)).questions.some(q => q.id === item.id));
        await page.getByRole('button', { name: 'Need a hint?', exact: true }).click();
        await page.getByText('Hinted work is recorded separately', { exact: false }).waitFor();
        await captureState(page,'hint-and-selected-answer',shots);
      }
      let releaseDraft;
      if (!raceExercised) {
        let announce;
        const observed=new Promise(resolve=>{announce=resolve});
        const hold=new Promise(resolve=>{releaseDraft=resolve});
        let held=false;
        await page.route(`**/questions/${item.id}/draft`,async route=>{
          if(route.request().method()==='PUT'&&!held){held=true;announce();await hold}
          await route.continue();
        });
        await page.locator('summary').filter({hasText:'Reasoning & confidence'}).click();
        await page.getByRole('textbox',{name:'Optional reasoning'}).fill('Draft held across submit boundary');
        await observed;
        let quizSent=false;
        const onRequest=r=>{if(r.url().endsWith('/api/quiz/submit'))quizSent=true};
        page.on('request',onRequest);
        const click=page.getByRole('button',{name:'Check answer',exact:true}).click();
        try {
          await page.waitForTimeout(250);
          assert.equal(quizSent,false,'Submit must settle outstanding draft writes before grading');
        } finally {releaseDraft()}
        await click;
        await page.getByRole('heading',{name:correct?'Correct':'Not yet',exact:true}).waitFor();
        await page.getByText('Answer recorded',{exact:true}).waitFor();
        await captureState(page,'correct-feedback',shots);
        page.off('request',onRequest);
        await page.unroute(`**/questions/${item.id}/draft`);
        raceExercised=true;
        await page.waitForTimeout(900);
        assert.equal((await api(`${prefix}/questions/${item.id}/draft`)).draft,null);
        assert.deepEqual(errors,[]);
        return;
      }
      const response = page.waitForResponse(r => r.url().endsWith('/api/quiz/submit') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Check answer', exact: true }).click();
      const grade = await (await response).json(); assert.equal(grade.is_correct, correct);
      await page.getByRole('heading', { name: correct ? 'Correct' : 'Not yet', exact: true }).waitFor();
      await captureState(page,correct?'independent-correct':'incorrect-feedback',shots);
      await page.waitForTimeout(900);
      assert.equal((await api(`${prefix}/questions/${item.id}/draft`)).draft, null, 'Autosave must never resurrect a graded draft');
      assert.deepEqual(errors, []);
    }
    await solve(questions[0], true, true);
    let report = await api(`${prefix}/analytics`);
    assert.equal(report.assisted_attempts.total, 1); assert.equal(report.independent_first_attempts.total, 0);
    await solve(questions[1], false, true);
    await solve(questions[2], false, false);
    await page.getByRole('heading', { name: 'Why this may have gone wrong', exact: true }).waitFor();
    const repair = (await api(`${prefix}/next`)).question;
    assert.equal(repair.effective_mode, 'repair'); assert.notEqual(repair.id, questions[2].id);
    report = await api(`${prefix}/analytics`);
    assert.equal(report.sample_count, 3); assert.equal(report.independent_first_attempts.total, 2);
    assert.equal(report.independent_first_attempts.correct, 1); assert.equal(report.assisted_attempts.total, 1);
    await visit(`/mastery?courseId=${course}`, 'Study queue');
    await page.getByRole('button',{name:'Active course',exact:true}).click();
    await page.getByRole('option',{name:'Physics',exact:true}).click();
    await page.waitForURL(`**courseId=${courses[1]}`);
    await page.goBack({waitUntil:'networkidle'});
    assert((await page.getByRole('button',{name:'Active course',exact:true}).innerText()).includes('SAT Math'),'Back must restore URL-owned course');
    await visit(`/mastery/learn?courseId=${course}`, 'Learn the skills.');
    await page.getByRole('button', { name: 'Reveal worked example', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Reveal worked example', exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Find practice questions', exact: false }).click();
    await page.getByRole('heading', { name: 'Find the right questions.', exact: true }).waitFor();
    assert(await page.getByRole('textbox', { name: 'Filter skill', exact: true }).inputValue());
    const design=await verifyUX(page,{base,course,physics:courses[1],reading:courses[2],api,shots});
    await visit(`/mastery/legacy?courseId=${course}`); assert.equal(new URL(page.url()).pathname, '/mastery');
    await visit(`/mastery/analytics?courseId=${courses[1]}`, 'Your performance, explained.');
    assert.equal((await api(`/mastery/courses/${courses[1]}/analytics`)).sample_count, 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(shots, 'result.json'), JSON.stringify({ status: 'pass', user_id: health.user_id, viewports: design.viewports, themes: design.themes, screenshots: fs.readdirSync(shots).filter(name=>name.endsWith('.png')).length, consoleErrors: errors, analytics: report }, null, 2));
    console.log('PASS: real Tenet routes, filters, drafts/reload, bookmarks, server hints, grading, diagnosis, independent analytics, course isolation; both themes, five viewports, contrast, keyboard, large text, motion, graph and persistence checks');
  } catch (error) {
    if (activePage) {
      await activePage.screenshot({ path: path.join(shots, 'failure.png') }).catch(() => {});
      fs.writeFileSync(path.join(shots, 'failure.html'), await activePage.content().catch(() => ''));
      fs.writeFileSync(path.join(shots, 'failure.aria.yml'), await activePage.locator('body').ariaSnapshot().catch(() => ''));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    for (const c of courses) await api(`/courses/${c}`, 'DELETE');
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
