import { UI } from './ui/ui.js';
import { Game } from './game/game.js';
import { installDebug } from './debug/debug.js';

async function boot() {
  const ui = new UI();
  const canvas = document.getElementById('view');
  const params = new URLSearchParams(location.search);
  if (window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches) {
    const li = document.createElement('li');
    li.textContent = 'This game needs a keyboard and mouse. It will not play well on a phone or tablet.';
    li.style.color = '#c9a86a';
    document.querySelector('.gate-warn')?.prepend(li);
  }
  let game;
  try {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) throw new Error('WebGL2 unavailable');
    game = new Game(canvas, ui);
    window.__boot = { game };
    await game.init((f, t) => ui.gateProgress(f, t));
  } catch (e) {
    console.error(e);
    ui.error(`<b>The house wouldn't load.</b><br><br>This game needs a browser with WebGL 2 (a recent Chrome, Edge, Firefox or Safari) and hardware acceleration switched on.<br><br><small>${String(e && e.message ? e.message : e)}</small>`);
    return;
  }
  installDebug(game, params);
  const loop = (t) => {
    try {
      game.frame(t);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  if (params.has('sandbox')) {
    // dev: skip straight into the house with no story
    ui.gateReady(() => {
      game.audio.start();
      game.mode = 'play';
      game.running = true;
      ui.hud(true);
      game.input.wantLock = true;
    });
    window.__ready = true;
    return;
  }
  const { Story } = await import('./game/story.js');
  game.story = new Story(game);
  game.story.boot(params);
  window.__ready = true;
}

boot();
