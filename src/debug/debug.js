import * as THREE from 'three';
import { Autopilot } from './autopilot.js';

/**
 * window.__game: a small API for automated tests and for poking at the house.
 * Nothing here is reachable through normal play.
 */
export function installDebug(game, params) {
  const api = {
    game,
    get ready() {
      return !!game.world;
    },
    state() {
      const p = game.player.pos;
      return {
        mode: game.mode,
        chapter: game.story?.chapterId ?? null,
        objective: game.ui.objective,
        pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        yaw: +game.player.yaw.toFixed(2),
        zone: game.zone?.name ?? null,
        flags: { ...(game.story?.flags || {}) },
        inventory: [...(game.story?.inventory || [])],
        deaths: game.story?.deaths ?? 0,
        entity: game.entity ? { mode: game.entity.mode, visible: game.entity.root.visible, pos: game.entity.root.position.toArray().map((v) => +v.toFixed(2)) } : null,
        prompt: game.interact.current ? (typeof game.interact.current.prompt === 'function' ? game.interact.current.prompt() : game.interact.current.prompt) : null,
        noteOpen: game.ui.noteOpen,
        time: +game.time.toFixed(2),
      };
    },
    teleport(x, y, z, yaw = game.player.yaw, pitch = 0) {
      game.player.teleport(new THREE.Vector3(x, y, z), yaw, pitch);
    },
    look(yaw, pitch = 0) {
      game.player.yaw = yaw;
      game.player.pitch = pitch;
      game.player.syncCamera(0);
    },
    lookAt(x, y, z) {
      const e = game.camera.position;
      const d = new THREE.Vector3(x - e.x, y - e.y, z - e.z);
      game.player.yaw = Math.atan2(-d.x, -d.z);
      game.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      game.player.syncCamera(0);
    },
    camera(x, y, z, tx, ty, tz) {
      game.debug.freeCam = true;
      game.camera.position.set(x, y, z);
      game.camera.lookAt(tx, ty, tz);
    },
    /** Interact with whatever is under the crosshair. */
    use() {
      game.interact.update();
      return game.interact.use();
    },
    /** Interact with a registered interactable directly by id. */
    useId(id) {
      const it = game.interact.byId(id);
      if (!it) return `no interactable ${id}`;
      if (!it.enabled()) return `disabled ${id}`;
      it.onUse(it);
      return true;
    },
    enabledIds() {
      return game.interact.items.filter((i) => i.enabled()).map((i) => i.id);
    },
    closeNote() {
      game.ui.closeNote();
    },
    setTimeScale(s) {
      game.timeScale = s;
    },
    press(code) {
      game.input.pressed.add(code);
    },

    // ---- faster-than-real-time driving for tests
    manual(on = true) {
      game.debug.manual = on;
      game.debug.noRender = on;
    },
    async advance(sec, dt = 0.05) {
      const n = Math.ceil(sec / dt);
      for (let i = 0; i < n; i++) {
        game.step(dt);
        await new Promise((r) => setTimeout(r, 0));
      }
      return api.state();
    },
    /** Advance until pred(game) is true or `timeout` game-seconds pass. */
    async until(predSrc, timeout = 60, dt = 0.05) {
      const pred = new Function('g', 'story', `return (${predSrc});`);
      let t = 0;
      while (t < timeout) {
        if (pred(game, game.story)) return { ok: true, t: +t.toFixed(2), state: api.state() };
        game.step(dt);
        t += dt;
        await new Promise((r) => setTimeout(r, 0));
      }
      return { ok: false, t, state: api.state() };
    },
    async walk(x, y, z, opts = {}) {
      if (!game.autopilot) game.autopilot = new Autopilot(game);
      const ap = game.autopilot;
      try {
        ap.goTo(x, y, z, opts);
      } catch (e) {
        return { status: 'noroute', error: e.message, state: api.state() };
      }
      let t = 0;
      while (ap.status === 'walking' && t < (opts.timeout ?? 90) + 1) {
        game.step(0.05);
        t += 0.05;
        await new Promise((r) => setTimeout(r, 0));
      }
      const status = ap.status;
      ap.stop();
      return { status, t: +t.toFixed(2), log: ap.log.slice(-3), state: api.state() };
    },
    /** Aim the crosshair at an interactable like a player would, then press E. */
    aimUse(id) {
      const it = game.interact.byId(id);
      if (!it) return { ok: false, why: `no interactable ${id}` };
      if (!it.enabled()) return { ok: false, why: `${id} is disabled` };
      const box = new THREE.Box3();
      for (const m of it.meshes) box.expandByObject(m);
      const c = box.getCenter(new THREE.Vector3());
      api.lookAt(c.x, c.y, c.z);
      game.interact.update();
      const cur = game.interact.current;
      if (!cur || cur.id !== id) {
        const d = game.camera.position.distanceTo(c).toFixed(2);
        return { ok: false, why: `aimed at ${cur ? cur.id : 'nothing'} (dist ${d})` };
      }
      game.interact.use();
      return { ok: true };
    },
    render() {
      game.renderFrame();
    },
  };
  window.__game = api;
  if (params.has('debug')) console.log('debug api on window.__game');
  return api;
}
