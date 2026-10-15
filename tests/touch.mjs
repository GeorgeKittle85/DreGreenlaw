// Touch-controls test for COME HOME in headless Chromium.
//
//   npm run build && npm run test:touch   (needs Playwright + Chromium: npm install && npx playwright install chromium)
//
// First as an iPad (touch emulation, real multi-touch events over the DevTools protocol): both sticks,
// run ring, dead zone, USE / LIGHT / JOURNAL / PAUSE, the Settings switch, notes, and the layout
// in portrait. Then as a desktop, to prove the keyboard controls still behave. Screenshots go to test-output/touch/.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'test-output', 'touch');
await mkdir(out, { recursive: true });

let chromium;
for (const base of [root + '/', '/opt/node22/lib/node_modules/']) {
  try {
    ({ chromium } = createRequire(base)('playwright'));
    break;
  } catch (e) {
    /* try the next location */
  }
}
if (!chromium) {
  console.error('Playwright not found. Run: npm install && npx playwright install chromium');
  process.exit(2);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'],
});

let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '   ' + extra : ''}`);
};

async function boot(ctxOpts, url) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  return { ctx, page, errors };
}
const E = (page, fn, arg) => page.evaluate(fn, arg);
const rect = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);

// ===================================================================== iPad
{
  console.log('\n=== iPad (touch) ===');
  const url = pathToFileURL(path.join(root, 'index.html')).href + '?chapter=arrival';
  const { ctx, page, errors } = await boot({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, url);
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

  check('auto-detects touch on an iPad-like device', await E(page, () => window.__game.game.settings.controls === 'touch'));
  check('gate says "tap to go home"', (await page.textContent('.gate-go')).includes('tap'));
  check('gate shows the touch-controls note', (await page.textContent('.gate-warn')).includes('Touch controls are on'));
  await page.tap('#gate');
  await page.waitForTimeout(800);
  await E(page, () => window.__game.manual(true));
  const adv = (s) => E(page, (s) => window.__game.advance(s), s);
  await adv(8);

  const st0 = await E(page, () => window.__game.state());
  check('chapter jump puts us in play mode', st0.mode === 'play', JSON.stringify({ mode: st0.mode, chapter: st0.chapter }));
  check('#app has the touch class', await E(page, () => document.getElementById('app').classList.contains('touch')));
  check('touch layer is visible while playing', await E(page, () => !document.getElementById('touch').classList.contains('hidden')));
  check('prompt chip reads USE', (await page.textContent('#prompt .key')) === 'USE');
  check('hint text is the touch version', (await E(page, () => document.getElementById('hint').textContent)).includes('Left stick'));
  await page.screenshot({ path: `${out}/01_ipad_play.png` });

  // ---- walk: push the left stick straight up (forward)
  const mv = await rect(page, '#stick-move .base');
  const R = mv.w / 2;
  const before = await E(page, () => window.__game.state());
  await touch('touchStart', [{ x: mv.x, y: mv.y, id: 1 }]);
  await touch('touchMove', [{ x: mv.x, y: mv.y - R * 0.95, id: 1 }]);
  const axis = await E(page, () => ({ ...window.__game.game.input.touch }));
  check('stick up => moveY ~ +1, sprint off', axis.moveY > 0.9 && Math.abs(axis.moveX) < 0.01 && !axis.sprint, JSON.stringify(axis));
  const knob = await E(page, () => document.querySelector('#stick-move .knob').style.transform);
  check('knob follows the thumb', knob.includes('translate3d'), knob);
  await adv(1.5);
  const after = await E(page, () => window.__game.state());
  const walked = Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]);
  check('walks forward ~3m in 1.5s', walked > 2 && walked < 4.5, `walked ${walked.toFixed(2)}m`);
  await page.screenshot({ path: `${out}/02_ipad_walking.png` });

  // ---- run: drag past the outer ring
  await touch('touchMove', [{ x: mv.x, y: mv.y - R * 1.7, id: 1 }]);
  const axisRun = await E(page, () => ({ ...window.__game.game.input.touch, runClass: document.getElementById('stick-move').classList.contains('run') }));
  check('past the ring => sprint on + ring lights up', axisRun.sprint && axisRun.runClass, JSON.stringify(axisRun));
  const p1 = await E(page, () => window.__game.state().pos);
  await adv(1);
  const p2 = await E(page, () => window.__game.state().pos);
  const ran = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
  check('running is faster than walking', ran > walked / 1.5 * 1.3, `ran ${ran.toFixed(2)}m in 1s`);
  await page.screenshot({ path: `${out}/03_ipad_running.png` });
  // back inside the base but outside the hysteresis band
  await touch('touchMove', [{ x: mv.x, y: mv.y - R * 1.0, id: 1 }]);
  check('coming back inside the ring stops the run', await E(page, () => !window.__game.game.input.touch.sprint));

  // ---- half push is a slower walk
  await touch('touchMove', [{ x: mv.x, y: mv.y - R * 0.5, id: 1 }]);
  const half = await E(page, () => window.__game.game.input.touch.moveY);
  check('half push is analogue (0 < y < 0.6)', half > 0.2 && half < 0.6, `moveY=${half.toFixed(2)}`);

  // ---- both thumbs: keep walking, push the right stick right
  const lk = await rect(page, '#stick-look .base');
  const yaw0 = await E(page, () => window.__game.state().yaw);
  await touch('touchStart', [{ x: mv.x, y: mv.y - R * 0.5, id: 1 }, { x: lk.x, y: lk.y, id: 2 }]);
  await touch('touchMove', [{ x: mv.x, y: mv.y - R * 0.5, id: 1 }, { x: lk.x + R * 0.9, y: lk.y, id: 2 }]);
  const both = await E(page, () => ({ ...window.__game.game.input.touch }));
  check('two thumbs at once: both sticks live', both.moveY > 0.2 && both.lookX > 0.5, JSON.stringify(both));
  await adv(0.5);
  const yaw1 = await E(page, () => window.__game.state().yaw);
  check('right stick right => turns right (yaw decreases)', yaw1 < yaw0 - 0.3, `yaw ${yaw0} -> ${yaw1}`);
  await touch('touchMove', [{ x: mv.x, y: mv.y - R * 0.5, id: 1 }, { x: lk.x, y: lk.y - R * 0.9, id: 2 }]);
  const pitch0 = await E(page, () => window.__game.game.player.pitch);
  await adv(0.4);
  const pitch1 = await E(page, () => window.__game.game.player.pitch);
  check('right stick up => looks up', pitch1 > pitch0 + 0.15, `pitch ${pitch0.toFixed(2)} -> ${pitch1.toFixed(2)}`);
  await page.screenshot({ path: `${out}/04_ipad_both_sticks.png` });

  // ---- release everything
  await touch('touchEnd', []);
  const rel = await E(page, () => ({ ...window.__game.game.input.touch, knob: document.querySelector('#stick-move .knob').style.transform }));
  check('lifting both fingers zeroes the sticks', rel.moveX === 0 && rel.moveY === 0 && rel.lookX === 0 && rel.lookY === 0 && !rel.sprint && rel.knob === '', JSON.stringify(rel));
  const p3 = await E(page, () => window.__game.state().pos);
  await adv(1.5);
  const p4 = await E(page, () => window.__game.state().pos);
  check('player stops when the stick is released', Math.hypot(p4[0] - p3[0], p4[2] - p3[2]) < 0.35);

  // ---- dead zone
  await touch('touchStart', [{ x: mv.x, y: mv.y, id: 1 }]);
  await touch('touchMove', [{ x: mv.x + R * 0.08, y: mv.y, id: 1 }]);
  check('tiny nudge inside the dead zone does nothing', await E(page, () => window.__game.game.input.touch.moveX === 0));
  await touch('touchEnd', []);

  // ---- buttons
  await E(page, () => {
    const g = window.__game.game;
    window.__uses = 0;
    const orig = g.interact.use.bind(g.interact);
    g.interact.use = () => { window.__uses++; return orig(); };
    window.__lightBefore = g.flashlight.on ?? g.flashlight.lit;
  });
  const use = await rect(page, '#tb-use');
  await touch('touchStart', [{ x: use.x, y: use.y, id: 3 }]);
  await touch('touchEnd', []);
  await adv(0.2);
  check('USE button => interact fires', (await E(page, () => window.__uses)) === 1);
  const lightBtn = await rect(page, '#tb-light');
  const l0 = await E(page, () => { const f = window.__game.game.flashlight; return f.on ?? f.lit; });
  await touch('touchStart', [{ x: lightBtn.x, y: lightBtn.y, id: 4 }]);
  await touch('touchEnd', []);
  await adv(0.2);
  const l1 = await E(page, () => { const f = window.__game.game.flashlight; return f.on ?? f.lit; });
  check('LIGHT button toggles the flashlight', l0 !== l1, `${l0} -> ${l1}`);

  // ---- pause / resume
  await page.tap('.tb-top [data-act="pause"]');
  await adv(0.2);
  check('PAUSE button pauses', (await E(page, () => window.__game.state().mode)) === 'paused');
  check('pause menu visible, touch layer hidden', await E(page, () => !document.getElementById('pause').classList.contains('hidden') && document.getElementById('touch').classList.contains('hidden')));
  await page.screenshot({ path: `${out}/05_ipad_pause.png` });

  // ---- settings: find the Controls select, flip to keyboard and back
  await page.tap('#pause [data-act="settings"]');
  check('settings has a Controls select showing "touch"', (await page.inputValue('#set-controls')) === 'touch');
  check('labels say Look sensitivity / Invert look Y', (await page.textContent('#settings')).includes('Look sensitivity') && (await page.textContent('#settings')).includes('Invert look Y'));
  await page.screenshot({ path: `${out}/06_ipad_settings.png` });
  await page.selectOption('#set-controls', 'keyboard');
  const kb = await E(page, () => ({ app: document.getElementById('app').classList.contains('touch'), mode: window.__game.game.input.touchMode, saved: JSON.parse(localStorage.getItem('comehome.settings')).controls, key: document.querySelector('#prompt .key').textContent }));
  check('switching to keyboard turns touch mode off and saves it', !kb.app && !kb.mode && kb.saved === 'keyboard' && kb.key === 'E', JSON.stringify(kb));
  await page.tap('#settings [data-act="back"]');
  await page.tap('#pause [data-act="controls"]');
  check('controls help now shows the keyboard table', await E(page, () => { const t = document.querySelector('#controls table.kb-only'); return t.offsetParent !== null; }));
  await page.tap('#controls [data-act="back"]');
  await page.tap('#pause [data-act="settings"]');
  await page.selectOption('#set-controls', 'touch');
  await page.tap('#settings [data-act="back"]');
  await page.tap('#pause [data-act="controls"]');
  check('controls help shows the touch table', await E(page, () => document.querySelector('#controls table.touch-only').offsetParent !== null));
  await page.screenshot({ path: `${out}/07_ipad_controls_help.png` });
  await page.tap('#controls [data-act="back"]');
  await page.tap('#pause [data-act="resume"]');
  await adv(0.3);
  check('resume returns to play with the touch layer back', await E(page, () => window.__game.state().mode === 'play' && !document.getElementById('touch').classList.contains('hidden')));
  // resume must not have tried to grab the pointer
  check('no pointer-lock fallback hint after resuming', !(await E(page, () => document.getElementById('hint').textContent)).includes("can't capture your mouse"));

  // ---- journal
  await page.tap('.tb-top [data-act="journal"]');
  await adv(0.2);
  check('JOURNAL button opens the journal', (await E(page, () => window.__game.state().mode)) === 'journal');
  check('journal shows a Close button, no key hint', await E(page, () => document.querySelector('#journal .touch-only button').offsetParent !== null && document.querySelector('#journal .overlay-hint').offsetParent === null));
  await page.screenshot({ path: `${out}/08_ipad_journal.png` });
  await page.tap('#journal [data-act="closejournal"]');
  await adv(0.2);
  check('Close returns to play', (await E(page, () => window.__game.state().mode)) === 'play');

  // ---- a note: opened by a tap, must survive the emulated mouse events, close on tap
  await E(page, () => { window.__game.game.story.readNote('letter'); });
  await adv(0.1);
  check('note opens', await E(page, () => window.__game.state().noteOpen));
  await page.waitForTimeout(100);
  await page.mouse.click(600, 400); // emulated mouse press right after opening
  check('an immediate emulated press does NOT close the note', await E(page, () => window.__game.state().noteOpen));
  await page.waitForTimeout(450);
  check('note hint says Tap', (await E(page, () => document.querySelector('#note .touch-only').offsetParent !== null)));
  await page.screenshot({ path: `${out}/09_ipad_note.png` });
  await page.touchscreen.tap(600, 400);
  await page.waitForTimeout(100);
  check('tapping the note later closes it', !(await E(page, () => window.__game.state().noteOpen)));
  await adv(0.3);

  // ---- mouse also drives the sticks in touch mode (desktop testing)
  await page.mouse.move(mv.x, mv.y);
  await page.mouse.down();
  await page.mouse.move(mv.x, mv.y - R * 0.9);
  check('a mouse can drive the stick too', await E(page, () => window.__game.game.input.touch.moveY > 0.8));
  await page.mouse.up();

  // ---- pausing while a finger is down lets go of it
  await touch('touchStart', [{ x: mv.x, y: mv.y, id: 1 }]);
  await touch('touchMove', [{ x: mv.x, y: mv.y - R, id: 1 }]);
  await E(page, () => window.__game.game.story.pause());
  await adv(0.2);
  check('pausing mid-drag releases the stick', await E(page, () => window.__game.game.input.touch.moveY === 0));
  await touch('touchEnd', []);

  // ---- portrait banner
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(200);
  check('portrait shows the "turn sideways" banner', await E(page, () => getComputedStyle(document.getElementById('rotate')).display === 'block'));
  await page.setViewportSize({ width: 1180, height: 820 });

  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ===================================================================== desktop
{
  console.log('\n=== Desktop (keyboard) ===');
  const url = pathToFileURL(path.join(root, 'index.html')).href + '?chapter=arrival';
  const { ctx, page, errors } = await boot({ viewport: { width: 1280, height: 720 } }, url);
  check('desktop defaults to keyboard', await E(page, () => window.__game.game.settings.controls === 'keyboard'));
  check('no touch note on the gate', !(await page.textContent('.gate-warn')).includes('Touch controls'));
  check('gate says "click to go home"', (await page.textContent('.gate-go')).includes('click'));
  await page.mouse.click(640, 360);
  await page.waitForTimeout(800);
  await E(page, () => window.__game.manual(true));
  const adv = (s) => E(page, (s) => window.__game.advance(s), s);
  await adv(8);
  check('touch layer stays hidden', await E(page, () => document.getElementById('touch').classList.contains('hidden')));
  check('#app has no touch class', await E(page, () => !document.getElementById('app').classList.contains('touch')));
  check('prompt chip still reads E', (await page.textContent('#prompt .key')) === 'E');
  check('hint is the WASD version', (await E(page, () => document.getElementById('hint').textContent)).includes('WASD'));
  const a = await E(page, () => window.__game.state().pos);
  await page.keyboard.down('KeyW');
  await adv(1.5);
  await page.keyboard.up('KeyW');
  const b = await E(page, () => window.__game.state().pos);
  check('W still walks', Math.hypot(b[0] - a[0], b[2] - a[2]) > 2, `moved ${Math.hypot(b[0] - a[0], b[2] - a[2]).toFixed(2)}m`);
  const y0 = await E(page, () => window.__game.state().yaw);
  await page.keyboard.down('ArrowLeft');
  await adv(0.5);
  await page.keyboard.up('ArrowLeft');
  check('arrow keys still turn', (await E(page, () => window.__game.state().yaw)) > y0 + 0.5);
  await E(page, () => { window.__uses = 0; const g = window.__game.game; const o = g.interact.use.bind(g.interact); g.interact.use = () => { window.__uses++; return o(); }; });
  await page.keyboard.press('KeyE');
  await adv(0.2);
  check('E still interacts', (await E(page, () => window.__uses)) === 1);
  await page.screenshot({ path: `${out}/10_desktop_play.png` });
  // desktop can opt in to touch from settings
  // a real Esc releases the pointer lock before pausing; a scripted pause() must do the same or clicks go to the canvas
  await E(page, () => { window.__game.game.input.exitLock(); window.__game.game.story.pause(); });
  await page.waitForTimeout(300);
  await page.click('#pause [data-act="settings"]');
  await page.selectOption('#set-controls', 'touch');
  await page.click('#settings [data-act="back"]');
  await page.click('#pause [data-act="resume"]');
  await adv(0.3);
  check('desktop can switch to touch from settings', await E(page, () => !document.getElementById('touch').classList.contains('hidden') && window.__game.game.input.touchMode));
  await page.screenshot({ path: `${out}/11_desktop_with_touch_on.png` });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
