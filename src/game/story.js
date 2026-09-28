import * as THREE from 'three';
import { Script, ignoreCancel } from '../core/scheduler.js';
import { Her } from './entity.js';
import { Scares } from './scares.js';
import { Director } from './director.js';
import { NOTES } from './text.js';
import { CHAPTERS, ORDER } from './chapters.js';
import { setupItems } from './items.js';
import { loadJSON, saveJSON } from './game.js';

const SAVE_KEY = 'comehome.save';

/**
 * Owns the story state and runs one chapter script at a time. A chapter is
 * { id, title, setup(story, fromSave), run(story, s) } (see chapters.js).
 */
export class Story {
  constructor(game) {
    this.game = game;
    this.flags = {};
    this.inventory = new Set();
    this.notesRead = [];
    this.deaths = 0;
    this.chapterId = null;
    this.script = null;
    this.dead = false;
    this.params = null;
    game.story = this;
    game.entity = new Her(game);
    game.scares = new Scares(game);
    this.director = new Director(game, this);
    game.hooks.push(this);
    this.items = setupItems(game, this);
    this._bindUI();
    this._bindDoors();
    game.onSlam = (p) => {
      game.fearTarget = Math.max(game.fearTarget, 0.5);
      game.player.shake(0.25);
    };
    this.prewarm();
  }

  /** Render her once behind the loading screen so the first scare never stalls on shader compiles. */
  prewarm() {
    const g = this.game;
    const her = g.entity;
    const cam = g.camera;
    const f = cam.getWorldDirection(new THREE.Vector3());
    her.show(cam.position.clone().addScaledVector(f, 2.5).setY(cam.position.y - 1.6), 0, 'stand');
    her.update(0);
    const gl = g.renderer.gl;
    for (const t of [g.mats.faceFrameTex, g.mats.faceFrameScreamTex, g.mats.faceScreamTex]) gl.initTexture(t);
    try {
      g.flashlight.update(0.016);
      g.renderer.render(g.scene, cam, 0);
      her.setFace('scream');
      her.jaw = 1;
      her.update(0);
      g.renderer.render(g.scene, cam, 0);
    } catch (e) {
      console.warn(e);
    }
    her.setFace('idle');
    her.jaw = 0;
    her.hide();
  }

  // ------------------------------------------------------------------ plumbing
  get s() {
    return this.script;
  }

  has(item) {
    return this.inventory.has(item);
  }

  give(item, label) {
    this.inventory.add(item);
    if (label) this.game.ui.toast(label);
    this.game.audio.sfx('pickup', { vol: 0.6 });
  }

  flag(name, v = true) {
    this.flags[name] = v;
  }

  save() {
    saveJSON(SAVE_KEY, { chapter: this.chapterId, inventory: [...this.inventory], notes: this.notesRead, flags: this.flags, completed: loadJSON(SAVE_KEY).completed || false });
  }

  /** Subtitle; returns the Script wait for its duration (scaled by `hold`). */
  say(text, cls = 'inner', o = {}) {
    const speaker = o.speaker;
    const dur = this.game.ui.say(text, { cls, speaker, dur: o.dur });
    return dur * (o.hold ?? 1);
  }

  async line(s, text, cls = 'inner', o = {}) {
    const d = this.say(text, cls, o);
    await s.wait(o.wait ?? d * 0.9);
  }

  objective(text) {
    this.game.ui.setObjective(text);
    this.flags.objective = text;
  }

  async readNote(id, { silent = false } = {}) {
    const g = this.game;
    const note = NOTES[id];
    if (!note) return;
    if (!this.notesRead.includes(id)) this.notesRead.push(id);
    if (!silent) g.audio.sfx('paper', { vol: 0.6 });
    const wasRunning = g.running;
    g.running = false;
    g.mode = 'note';
    const shown = { ...note };
    if (id === 'drawing') shown.image = g.mats.drawing.tall.map.image;
    if (id === 'photos') shown.image = g.mats.photo.christmas.map.image;
    this._noteOpenedAt = performance.now();
    await g.ui.showNote(shown);
    g.audio.sfx('paper', { vol: 0.4 });
    if (g.mode === 'note') g.mode = 'play';
    g.running = wasRunning || g.mode === 'play';
    this.save();
  }

  // ------------------------------------------------------------------ doors
  _bindDoors() {
    const g = this.game;
    for (const d of Object.values(g.world.doors)) {
      if (!d.interactable) continue;
      g.interact.add({
        id: `door:${d.id}`,
        meshes: [d.panel],
        tag: `door:${d.id}`,
        range: 2.3,
        enabled: () => d.interactable && !this.dead,
        locked: () => d.locked && !this._keyFor(d),
        prompt: () => (d.locked ? (this._keyFor(d) ? 'Unlock' : 'Locked') : d.isOpen ? 'Close' : 'Open'),
        onUse: () => this.useDoor(d),
      });
    }
  }

  _keyFor(d) {
    if (d.id === 'front') return this.has('frontKey');
    if (d.id === 'ellie') return this.has('ellieKey');
    if (d.id.startsWith('loopExit')) return this.has('loopKey');
    return false;
  }

  useDoor(d) {
    const g = this.game;
    if (d.onUse && d.onUse(d)) return;
    if (d.locked) {
      if (this._keyFor(d)) {
        d.locked = false;
        g.audio.sfx('unlock', { pos: d.pivot.position, vol: 0.8 });
        this.onUnlock?.(d);
        this.script?.spawn(async (s) => {
          await s.wait(0.5);
          d.open(d.unlockMode || 'normal');
        });
        return;
      }
      g.audio.sfx('rattle', { pos: d.pivot.position, vol: 0.7 });
      this.say(d.lockedText, 'system', { dur: 2.6 });
      this.onLocked?.(d);
      return;
    }
    d.toggle();
  }

  // ------------------------------------------------------------------ UI / menus
  _bindUI() {
    const g = this.game;
    const ui = g.ui;
    ui.bindSettings(g.settings, () => g.applySettings());
    ui.onAction = (act, from) => {
      g.audio.sfx('click', { vol: 0.3 });
      if (act === 'begin') this.newGame();
      else if (act === 'continue') this.continueGame();
      else if (act === 'settings' || act === 'controls') ui.openSub(act, from === 'title' ? 'title' : 'pause');
      else if (act === 'back') ui.closeSub();
      else if (act === 'resume') this.resume();
      else if (act === 'restart') {
        ui.show(ui.pauseEl, false);
        this.startChapter(this.chapterId, { fromSave: true });
        this.resume();
      } else if (act === 'quit') {
        ui.show(ui.pauseEl, false);
        this.toTitle();
      }
    };
    g.input.onFallback = () => {
      g.ui.hint("This page can't capture your mouse. Hold the left button and drag to look (arrow keys turn too). E to interact.", 12);
    };
    g.input.on('lockchange', (locked) => {
      if (locked) return;
      if (g.ui.noteOpen) {
        g.ui.closeNote();
        return;
      }
      if (g.mode === 'play' || g.mode === 'cine') this.pause();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (g.ui.noteOpen) {
          g.ui.closeNote();
          return;
        }
        if (g.ui.journalOpen) {
          this.closeJournal();
          return;
        }
        if (g.mode === 'paused' && !g.input.locked && e.code === 'Escape') {
          if (ui.menuReturn) ui.closeSub();
          else this.resume();
          return;
        }
        if ((g.mode === 'play' || g.mode === 'cine') && (!g.input.locked || e.code === 'KeyP')) this.pause();
      }
      if (e.code === 'KeyJ' && !e.repeat) {
        if (g.ui.journalOpen) this.closeJournal();
        else if (g.mode === 'play') this.openJournal();
      }
      if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && g.ui.noteOpen && !e.repeat) {
        // the same key press opened it; ignore presses in the first moment
        if (performance.now() - (this._noteOpenedAt || 0) > 250) this.closeNoteFromInput();
      }
    });
    // while the pointer is locked, clicks land on the canvas, not the note
    g.canvas.addEventListener('mousedown', () => {
      if (g.ui.noteOpen && performance.now() - (this._noteOpenedAt || 0) > 250) this.closeNoteFromInput();
    });
  }

  /** Close the note and swallow the key/click that did it, so it can't re-open it next frame. */
  closeNoteFromInput() {
    const g = this.game;
    g.ui.closeNote();
    g.input.pressed.clear();
    g.input.clicked = false;
  }

  pause() {
    const g = this.game;
    if (g.mode === 'paused') return;
    this._pausedFrom = g.mode;
    g.mode = 'paused';
    g.running = false;
    g.ui.show(g.ui.pauseEl, true);
    g.audio.ctx?.suspend();
    document.getElementById('app').classList.remove('playing');
  }

  resume() {
    const g = this.game;
    g.ui.show(g.ui.pauseEl, false);
    g.ui.closeSub();
    g.ui.show(g.ui.settingsEl, false);
    g.ui.show(g.ui.controlsEl, false);
    g.mode = this._pausedFrom || 'play';
    g.running = true;
    g.audio.ctx?.resume();
    g.input.requestLock();
    document.getElementById('app').classList.add('playing');
  }

  openJournal() {
    const g = this.game;
    g.mode = 'journal';
    g.running = false;
    const notes = this.notesRead.map((id) => ({ id, ...NOTES[id] }));
    g.ui.openJournal(this.flags.objective || g.ui.objective, notes, (n) => {
      g.ui.closeJournal();
      this.readNote(n.id, { silent: false }).then(() => {
        if (g.mode === 'play') this.openJournal();
      });
      g.mode = 'note';
    });
  }

  closeJournal() {
    const g = this.game;
    g.ui.closeJournal();
    g.mode = 'play';
    g.running = true;
  }

  // ------------------------------------------------------------------ flow
  boot(params) {
    const g = this.game;
    this.params = params;
    const saved = loadJSON(SAVE_KEY);
    const cont = g.ui.titleEl.querySelector('[data-act="continue"]');
    const refresh = () => {
      const sv = loadJSON(SAVE_KEY);
      const ch = CHAPTERS[sv.chapter];
      cont.classList.toggle('hidden', !ch || sv.chapter === 'prologue');
      if (ch) cont.textContent = `Continue — ${ch.num} ${ch.title}`;
    };
    this._refreshTitle = refresh;
    refresh();
    g.mode = 'gate';
    g.ui.gateReady(() => {
      g.audio.start();
      g.audio.setArea('exterior', false);
      const jump = params.get('chapter');
      if (jump && CHAPTERS[jump]) {
        this.startChapter(jump, { fromSave: true });
        this.enterPlay();
      } else this.toTitle();
    });
    if (saved.completed) g.ui.titleEl.querySelector('.tagline').textContent = 'You came home. You can always come home.';
  }

  toTitle() {
    const g = this.game;
    this.killScript();
    g.entity.hide();
    g.audio.stopLoops();
    g.ui.hud(false);
    g.ui.clearSubs();
    g.ui.cineClear(false);
    g.ui.setObjective('');
    g.mode = 'title';
    g.running = false;
    g.envOverride = null;
    g.fx.blackout = 0;
    g.fadeTo(0, 0);
    this.director.reset('title');
    CHAPTERS.arrival.setup(this, true);
    g.world.headlight.intensity = 40;
    // someone is standing in Ellie's window, if you look closely enough
    g.world.fixtures.ellie.override = 0.55;
    g.entity.show(new THREE.Vector3(-4.8, 3.0, -0.8), 0, 'straight');
    g.ui.show(g.ui.titleEl, true);
    g.input.exitLock();
    g.input.wantLock = false;
    document.getElementById('app').classList.remove('playing');
    this._refreshTitle?.();
    g.audio.setArea('exterior', false);
    g.audio.setRain(true);
  }

  enterPlay() {
    const g = this.game;
    g.ui.show(g.ui.titleEl, false);
    g.ui.hud(true);
    g.mode = 'play';
    g.running = true;
    g.input.wantLock = true;
    g.input.requestLock();
    document.getElementById('app').classList.add('playing');
  }

  newGame() {
    this.flags = {};
    this.inventory = new Set();
    this.notesRead = [];
    this.deaths = 0;
    this.enterPlay();
    this.startChapter('prologue');
  }

  continueGame() {
    const sv = loadJSON(SAVE_KEY);
    this.flags = sv.flags || {};
    this.inventory = new Set(sv.inventory || []);
    this.notesRead = sv.notes || [];
    this.enterPlay();
    this.startChapter(sv.chapter && CHAPTERS[sv.chapter] ? sv.chapter : 'arrival', { fromSave: true });
  }

  killScript() {
    if (this.script) this.script.kill();
    this.script = null;
    this.game.sched.cancelAll();
  }

  /** Start a chapter. fromSave = rebuild the whole world state for it. */
  startChapter(id, { fromSave = false } = {}) {
    const g = this.game;
    const ch = CHAPTERS[id];
    this.killScript();
    this.dead = false;
    g.ui.hideDeath();
    this.chapterId = id;
    this.chapterStart = g.time;
    const s = new Script(g.sched);
    this.script = s;
    this.director.reset(id);
    g.player.canMove = true;
    g.player.canLook = true;
    g.player.lookAt = null;
    ch.setup(this, fromSave);
    this.save();
    Promise.resolve()
      .then(() => ch.run(this, s))
      .catch(ignoreCancel)
      .catch((e) => console.error(e));
  }

  /** Chapter scripts call this to move on. */
  next(s) {
    const i = ORDER.indexOf(this.chapterId);
    const nextId = ORDER[i + 1];
    if (!nextId) return;
    this.startChapter(nextId, { fromSave: false });
  }

  // ------------------------------------------------------------------ death
  async die({ msg = 'SHE FOUND YOU', sub = 'Keep the light on her.' } = {}) {
    const g = this.game;
    if (this.dead) return;
    this.dead = true;
    this.deaths++;
    const s = this.script;
    try {
      await g.scares.lunge(s, { fatal: true });
      g.fadeTo(1, 0);
      g.ui.death(msg, sub);
      g.audio.sfx('thud', { vol: 0.5 });
      await s.wait(3.6);
      g.ui.hideDeath();
      CHAPTERS[this.chapterId].respawn?.(this, s);
      this.dead = false;
      g.fadeTo(0, 1.6);
      g.player.canMove = true;
      g.player.canLook = true;
    } catch (e) {
      ignoreCancel(e);
    }
  }

  // ------------------------------------------------------------------ per-frame
  preUpdate() {
    const g = this.game;
    g.flashlight.flicker = this.director.flicker;
    g.tension = this.director.tension;
  }

  update(dt) {
    const g = this.game;
    this.director.update(dt);
    CHAPTERS[this.chapterId]?.tick?.(this, dt);
    g.entity.update(dt);
  }

  titleUpdate(dt) {
    this.director.update(dt);
    this.game.entity.update(dt);
  }
}

