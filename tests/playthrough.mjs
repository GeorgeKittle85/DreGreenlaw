// End-to-end playthrough of COME HOME in headless Chromium.
//
//   npm run build && npm test          (needs Playwright + Chromium: npm i -D playwright && npx playwright install chromium)
//
// The real player controller walks every route (autopilot over the collision
// world), aims at every object and presses E, so a pass means the whole game
// is physically completable — including dying once in chapter IV, and failing
// the rules in the hallway before obeying them. Screenshots go to test-output/.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'test-output');
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
  console.error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const E = (fn, ...args) => page.evaluate(fn, ...args);
let shotN = 0;
async function shot(name) {
  await E(() => window.__game.render());
  await page.screenshot({ path: path.join(out, `${String(++shotN).padStart(2, '0')}_${name}.png`) });
}
async function fail(msg) {
  console.error(`\nFAIL: ${msg}`);
  console.error(JSON.stringify(await E(() => window.__game.state()), null, 1));
  await shot('failure');
  console.error(errors.join('\n'));
  await browser.close();
  process.exit(1);
}
async function walk(x, y, z, opts = {}) {
  const r = await E(([x, y, z, o]) => window.__game.walk(x, y, z, o), [x, y, z, opts]);
  if (r.status !== 'arrived') await fail(`walk to ${x},${y},${z}: ${r.status} ${r.error || ''} ${JSON.stringify(r.log)}`);
  return r;
}
async function use(id) {
  const r = await E((id) => window.__game.aimUse(id), id);
  if (!r.ok) await fail(`use ${id}: ${r.why}`);
  await advance(0.1);
}
async function until(pred, timeout = 60, what = pred) {
  const r = await E(([p, t]) => window.__game.until(p, t), [pred, timeout]);
  if (!r.ok) await fail(`timed out (${timeout}s) waiting for: ${what}`);
  return r;
}
async function advance(sec) {
  return E((s) => window.__game.advance(s), sec);
}
async function closeNote() {
  await until('g.ui.noteOpen', 5, 'a note to open');
  await E(() => window.__game.closeNote());
  await advance(0.2);
}
const chapter = (id) => until(`story.chapterId === '${id}'`, 120, `chapter ${id}`);

// ---------------------------------------------------------------- boot
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
log('loaded');
await page.mouse.click(480, 270);
await page.waitForTimeout(1200);
await shot('title');
await E(() => window.__game.manual(true));
await page.click('[data-act="begin"]');
await until(`story.chapterId === 'prologue'`, 5);
log('prologue');
await advance(8);
await shot('prologue');
await chapter('arrival');

// ---------------------------------------------------------------- I. Hollow Creek Road
log('I. Hollow Creek Road');
await advance(4);
await shot('arrival');
await walk(1.2, -0.6, 27.3);
await use('mailbox');
await closeNote();
await until(`story.has('frontKey')`, 5, 'the spare key');
await walk(0.3, -0.6, 17);
await E(() => window.__game.lookAt(-4.8, 4.4, 0));
await until(`story.flags.silhouette`, 12, 'the silhouette in the window');
await walk(0, 0, 1.3);
await use('door:front');
await until(`g.world.doors.front.angle > 1.4 && !g.world.doors.front.moving`, 6, 'front door to open');
await walk(0, 0, -1.6);
await until(`g.world.doors.front.angle < 0.05 && g.world.doors.front.locked`, 6, 'front door to slam');
log('  front door slammed');
await advance(8);
await walk(3.4, 0, -7.0);
await until(`story.flags.phoneRinging`, 8, 'the phone to ring');
await walk(2.35, 0, -6.35);
await use('phone');
await until(`g.player.canMove && story.flags.phoneAnswered`, 20, 'the call to end');
await advance(6);
await walk(6.4, 0, -8.5);
await use('rules');
await closeNote();
await walk(7.25, 0, -10.95);
await use('fusebox');
await until(`g.world.lights.power && story.flags.tvOn`, 10, 'the power');
await shot('power_on');
await walk(-3.2, 0, -4.2);
await E(() => window.__game.lookAt(-8, 1.5, -5.7));
await advance(2);
await walk(0.9, 3.0, -7.6);
await chapter('rules');

// ---------------------------------------------------------------- II. Her Room
log('II. Her Room');
await advance(3);
await walk(-0.9, 3, -3.65);
await use('door:ellie');
await advance(3);
await walk(6.6, 3, -10.6);
await use('diary');
await closeNote();
await advance(3);
await shot('mom_wardrobe');
await advance(12);
await walk(-3.3, 3, -11.0);
await use('mirror');
await advance(1.5);
await use('bathKey');
await until(`story.has('ellieKey')`, 3, 'Ellie key');
await E(() => window.__game.lookAt(-3.3, 4.62, -11.9));
await until(`g.entity.root.visible`, 8, 'her in the mirror');
await advance(0.2);
await shot('mirror_scare');
await E(() => window.__game.look(Math.PI, 0));
await until(`story.flags.powerOut`, 8, 'power to die');
await walk(-0.9, 3, -3.65);
await use('door:ellie');
await until(`story.flags.ellieUnlocked && g.world.doors.ellie.angle > 0.8`, 8, 'Ellie door to open');
await walk(-5.8, 3, -3.4);
await advance(2);
await use('drawing');
await closeNote();
await until(`g.entity.root.visible`, 12, 'her in the wardrobe');
await E(() => window.__game.lookAt(-3.3, 4.8, -5.6));
await advance(1.2);
await shot('wardrobe');
await until(`!g.entity.root.visible && g.world.doors.ellie.angle > 0.5`, 20, 'the door to open again');
await walk(-1.35, 3, -3.65);
await chapter('hallway');

// ---------------------------------------------------------------- III. The Hallway
log('III. The Hallway');
await advance(2);
await shot('loop1');
await walk(208.3, 0, -11, { timeout: 60 });
await until(`story.flags.loop === 2`, 10, 'loop 2');
await advance(1.5);
await walk(208.3, 0, -11, { timeout: 60 });
await until(`story.flags.loop === 3`, 10, 'loop 3');
await advance(1.5);
await shot('loop3');
await walk(266.3, 0, -23, { timeout: 90 });
await E(() => window.__game.lookAt(267, 1.2, -23));
await E(() => window.__game.aimUse('door:loopExit_long'));
await advance(3);
await walk(262.9, 0, -5.0);
await use('sink_long');
await until(`story.has('loopKey') && g.player.canMove`, 12, 'loop key');
await walk(266.3, 0, -23, { timeout: 90 });
await use('door:loopExit_long');
await advance(1.5);
await walk(268.3, 0, -23, { timeout: 30 });
await until(`story.flags.loop === 4`, 10, 'loop 4');
await advance(1.5);
// Rule 3 — first break it: stare at her face
log('  loop 4: looking at her (should fail)');
await walk(200, 0, -6.5);
await E(() => window.__game.lookAt(200, 2.1, -10.8));
await until(`g.entity.pose.part > 0.5`, 12, 'her face to show');
await shot('loop4_smile');

await until(`g.scares.busy`, 8, 'the lunge for looking');
await until(`!g.scares.busy`, 8);
await advance(2.5);
await until(`story.flags.loop === 4 && g.player.pos.z > 0`, 10, 'loop 4 restart');
// then obey it: eyes on the floor
log('  loop 4: eyes down');
await walk(208.3, 0, -11, { pitch: -1.25, timeout: 60 });
await until(`story.flags.loop === 5`, 10, 'loop 5');
await advance(1.5);
// Rule 4 — look back once
log('  loop 5: looking back (should fail)');
await walk(260, 0, -8);
await E(() => window.__game.look(Math.PI, 0));
await until(`g.scares.busy`, 5, 'the lunge for looking back');
await until(`!g.scares.busy`, 8);
await advance(2.5);
await until(`story.flags.loop === 5 && g.player.pos.z > 0`, 10, 'loop 5 restart');
log('  loop 5: never look back');
await walk(268.4, 0, -23, { timeout: 90 });
await chapter('hunt');

// ---------------------------------------------------------------- IV. Ready or Not
log('IV. Ready or Not');
await advance(4);
await walk(0.1, 0, -8.2);
await use('lastNote');
await closeNote();
await until(`g.entity.mode === 'stalk'`, 40, 'the hunt to start');
await shot('hunt_start');
// let her catch us once in the dark
log('  dying once');
await E(() => { window.__game.game.flashlight.on = false; });
await until(`story.deaths >= 1`, 90, 'death');
await until(`!story.dead && g.player.canMove`, 15, 'respawn');
await E(() => { const g = window.__game.game; g.flashlight.on = true; g.debug.herFrozen = true; });
log('  collecting');
await walk(-5.5, 0, -2.05);
await use('doll');
await walk(5.0, 0, -0.85);
await use('ribbon');
await walk(-6.2, 0, -10.75);
await use('picture');
await until(`!g.world.props.chains.visible && g.world.doors.basement.angle > 0.5`, 20, 'the chains to fall');
await walk(0, -3.4, -14.3);
await chapter('well');

// ---------------------------------------------------------------- V. The Well
log('V. The Well');
await advance(2);
await walk(0, -3.4, -16.4);
await use('well');
await until(`story.flags.gaveBack`, 30, 'giving her things back');
await use('well');
await until(`g.entity.root.visible`, 30, 'her');
await shot('well_finale');
await chapter('after');

// ---------------------------------------------------------------- After
log('After');
await advance(5);
await shot('dawn');
await walk(0.8, -0.6, 29.6, { timeout: 60 });
await use('car');
await until(`g.fx.face > 0.5`, 90, 'the last face');
await advance(0.4);
await shot('last_face');
await until(`g.mode === 'credits'`, 20, 'credits');
await page.waitForTimeout(9000);
await page.screenshot({ path: path.join(out, `${String(++shotN).padStart(2, '0')}_credits.png`) });
await page.click('#credits button');
await until(`g.mode === 'title'`, 5, 'back to title');

const bad = errors.filter((e) => !/GPU stall|WebGL|swiftshader/i.test(e));
if (bad.length) await fail(`console errors:\n${bad.join('\n')}`);
const [deaths, gameMin] = await E(() => [window.__game.game.story.deaths, window.__game.game.time / 60]);
log(`PASS — full playthrough completed (${deaths} death(s) along the way, ${gameMin.toFixed(1)} min of game time)`);
await browser.close();
