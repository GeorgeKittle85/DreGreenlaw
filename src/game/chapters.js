import * as THREE from 'three';
import { LINES, RADIO, CREDITS } from './text.js';
import { writing } from '../engine/textures.js';
import { Builder } from '../world/builder.js';
import { YB } from '../world/house.js';
import { pick, rand, wrapAngle } from '../core/util.js';
import { loadJSON, saveJSON } from './game.js';
import { POSES, clonePose } from './herModel.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ORDER = ['prologue', 'arrival', 'rules', 'hallway', 'hunt', 'well', 'after'];

const DOORS = { front: 'locked', kitchen: 'closed', pantry: 'closed', laundry: 'closed', basement: 'locked', ellie: 'locked', bath: 'closed', sam: 'closed', mom: 'closed', momWardrobe: 'closed', wardrobeL: 'closed', wardrobeR: 'closed' };

function setDoors(W, spec) {
  for (const [id, state] of Object.entries(spec)) {
    const d = W.doors[id];
    if (!d) continue;
    d.locked = state === 'locked';
    const a = state === 'open' ? d.openAngle : typeof state === 'number' ? state * d.openAngle : 0;
    d.angle = d.target = a;
    d.moving = false;
    d._apply();
    d.onUse = null;
  }
}

/** Is the camera looking at p (cos of the allowed angle)? */
function lookingAt(g, p, cos = 0.9) {
  const d = new THREE.Vector3().subVectors(p, g.camera.position).normalize();
  return g.camera.getWorldDirection(new THREE.Vector3()).dot(d) > cos;
}

/** Put the whole world into a known state. Every chapter starts from here. */
function resetWorld(st, { power = false, rain = true, env = null } = {}) {
  const g = st.game;
  const W = g.world;
  const her = g.entity;
  her.hide();
  her.headTrack = 0;
  her.flickerScale = 1;
  her.onCatch = null;
  her.setFace('idle');
  her.jaw = her.jawTarget = 0;
  if (her.collider) her.collider.enabled = false;
  g.audio.stopLoops();
  g.scares.busy = false;
  g.flashlight.enabled = true;
  g.flashlight.on = true;
  g.flashlight.forcedOff = 0;
  W.lights.power = power;
  W.lights.surge = 0;
  W.lights.tint.set(1, 1, 1);
  for (const fx of W.lights.fixtures) fx.override = null;
  W.fixtures.porch.on = false;
  for (const c of W.fixtures.candles) c.on = false;
  g.audio.setPower(power);
  g.audio.setRain(rain);
  g.rainOn = rain;
  g.envOverride = env;
  W.skyMat.uniforms.uDawn.value = env === 'dawn' ? 1 : 0;
  W.headlight.intensity = 0;
  for (const b of W.beams) b.visible = false;
  W.stairGate.enabled = false;
  const Pp = W.props;
  Pp.chains.visible = true;
  Pp.blockade.visible = false;
  W.blockadeCollider.enabled = false;
  for (const k of ['doll', 'ribbon', 'picture']) Pp[k].visible = false;
  Pp.candles.visible = false;
  Pp.wellHands.visible = false;
  Pp.drawingPaper.visible = true;
  Pp.ellieBolt.visible = true;
  Pp.handset.visible = true;
  Pp.fuseDoor.rotation.y = 0;
  Pp.mailFlag.rotation.z = 0;
  const m = Pp.mirror;
  m.angle = m.target = 0;
  m.pivot.rotation.y = 0;
  m.key.visible = true;
  m.message.visible = false;
  if (W.decals.ch4) W.decals.ch4.visible = false;
  for (const l of Object.values(W.loops)) {
    l.scrawl.visible = false;
    l.tilted.visible = false;
    l.exitGlow.visible = false;
  }
  st.director.setTV(false);
  st.handlers = {};
  st.onLocked = null;
  st.onUnlock = null;
  g.player.onStep = null;
  g.player.canMove = true;
  g.player.canLook = true;
  g.player.eye = 1.62;
  g.fx.face = 0;
  g.walkSpeed = 2.2;
  g.ui.hint('', 0.01);
}

/** Things you can do in the house in both of the early chapters. */
function commonHandlers(st) {
  const g = st.game;
  const W = g.world;
  return {
    rules: () => {
      st.flags.rules = true;
    },
    tv: () => {
      st.say("It won't turn off.", 'inner');
      st.director.tv.setFigure(1);
      g.audio.sfx('static', { pos: W.anchors.tv.pos, vol: 0.7 });
      st.script?.spawn(async (s2) => {
        await g.scares.subliminal(s2, { dur: 0.06 });
        await s2.wait(0.4);
        st.director.tv.setFigure(0);
      });
    },
  };
}

function ch4Decals(g) {
  const W = g.world;
  if (W.decals.ch4) return W.decals.ch4;
  const group = new THREE.Group();
  W.root.add(group);
  const b = new Builder(g, group);
  const M = g.mats;
  const w = (text, x, y, z, ww, hh, n, o = {}) => b.decal(M.decal(writing(text, { color: '#5e0707', seed: o.seed || 50, size: o.size || 84 })), x, y, z, ww, hh, n);
  w('READY OR NOT', -1.42, 1.6, -5.9, 2.2, 0.55, [1, 0, 0], { seed: 51 });
  w('1 2 3 4 5 6 7 8 9 10', -7.92, 1.55, -1.6, 2.6, 0.5, [1, 0, 0], { seed: 52, size: 70 });
  w('SAM IS IT', 7.92, 1.6, -7.5, 2.0, 0.55, [-1, 0, 0], { seed: 53 });
  w('COLD COLD COLD', -4.6, 1.6, -11.92, 2.4, 0.55, [0, 0, 1], { seed: 54 });
  b.decal(M.handprints, 0, 2.79, -4.5, 2.4, 2.4, [0, -1, 0]);
  b.decal(M.handprints, -4.7, 2.79, -3.5, 2.4, 2.4, [0, -1, 0]);
  W.decals.ch4 = group;
  return group;
}

// =====================================================================
export const CHAPTERS = {
  // -------------------------------------------------------------------
  prologue: {
    id: 'prologue',
    num: '',
    title: 'Voicemail',
    setup(st) {
      const g = st.game;
      resetWorld(st, { power: false, rain: true });
      setDoors(g.world, DOORS);
      g.player.teleport(g.world.anchors.start.pos, 0);
      g.player.canMove = false;
      g.player.canLook = false;
      g.fadeTo(1, 0);
      g.ui.hud(false);
      g.mode = 'cine';
    },
    async run(st, s) {
      const g = st.game;
      const ui = g.ui;
      await s.wait(1.2);
      g.audio.sfx('click', { vol: 0.5 });
      const hiss = g.audio.sfx('static', { vol: 0.06, loop: true, phone: true });
      const voices = ['momPhoneA', 'momPhoneB', 'momPhoneC', 'momBad'];
      let vi = 0;
      for (const [cls, text] of LINES.voicemail) {
        ui.cineLine(text, cls);
        if (cls.startsWith('voice')) {
          const name = cls.includes('bad') ? 'momBad' : voices[vi++ % 3];
          g.audio.sfx(name, { vol: 0.7, phone: true });
          if (cls.includes('bad')) g.kick('distort', 0.25);
          await s.wait(3.6);
        } else await s.wait(2.2);
        if (ui.cineEl.children.length > 3) ui.cineEl.firstChild?.remove();
      }
      hiss?.stop(0.3);
      g.audio.sfx('click', { vol: 0.5 });
      ui.cineClear();
      await s.wait(2.2);
      for (const t of LINES.after) {
        ui.cineLine(t);
        await s.wait(3.4);
      }
      await s.wait(1.2);
      ui.cineClear();
      await s.wait(2.0);
      g.mode = 'play';
      st.next(s);
    },
  },

  // -------------------------------------------------------------------
  arrival: {
    id: 'arrival',
    num: 'I',
    title: 'Hollow Creek Road',
    setup(st, fromSave) {
      const g = st.game;
      const W = g.world;
      resetWorld(st, { power: false, rain: true });
      setDoors(W, DOORS);
      W.doors.front.lockedText = 'Locked. Mom always kept a spare somewhere.';
      W.headlight.intensity = 40;
      for (const b of W.beams) b.visible = true;
      W.props.mailFlag.rotation.z = 0;
      g.player.teleport(W.anchors.start.pos, 0);
      for (const f of ['letter', 'frontOpened', 'inside', 'phoneRinging', 'phoneAnswered', 'rules', 'power', 'tvOn', 'silhouette']) st.flags[f] = false;
      st.inventory.delete('frontKey');
      st.director.inside = false;
      W.stairGate.enabled = true;
      st.handlers = {
        ...commonHandlers(st),
        mailbox: async () => {
          st.flags.letter = true;
          W.props.mailFlag.rotation.z = -Math.PI / 2;
          g.audio.sfx('creak2', { pos: W.anchors.mailbox.pos, vol: 0.4, rate: 1.6 });
          await st.readNote('letter');
          st.give('frontKey', 'Took the spare key from the envelope.');
        },
        phone: () => {
          st.flags.phoneRinging = false;
          st.flags.phoneAnswered = true;
        },
        fusebox: () => {
          st.flags.power = true;
          W.stairGate.enabled = false;
        },
      };
      st.onUnlock = (d) => {
        if (d.id === 'front') st.flags.frontOpened = true;
      };
    },
    async run(st, s) {
      const g = st.game;
      const W = g.world;
      const A = W.anchors;
      const her = g.entity;
      g.fadeTo(1, 0);
      g.fadeTo(0, 3.5);
      g.ui.hud(true);
      g.ui.chapterCard('I', 'Hollow Creek Road');
      await s.wait(3);
      await st.line(s, "Twenty years. It hasn't changed at all.");
      st.say('The flag on the mailbox is up.', 'inner');
      st.objective('Check the mailbox.');
      g.ui.hint('WASD to walk · Mouse to look · E to interact · F for the flashlight · J for your journal', 9);

      // the light in Ellie's window
      s.spawn(async (s2) => {
        await s2.until(() => st.flags.letter && W.in('yardSilhouette', g.player.pos) && lookingAt(g, W.ellieWindow.position, 0.92));
        const fx = W.fixtures.ellie;
        fx.override = 1.2;
        g.audio.sfx('click', { pos: W.ellieWindow.position, vol: 0.5, rate: 0.7 });
        her.show(V(-4.8, 3.0, -0.8), 0, 'straight');
        her.headTrack = 0.7;
        g.fearTarget = 0.4;
        await s2.wait(2.6);
        fx.override = 0;
        await s2.wait(0.1);
        her.hide();
        fx.override = null;
        st.flags.silhouette = true;
        await s2.wait(0.8);
        await st.line(s2, '...Mom?');
        await st.line(s2, "That was Ellie's window.");
      });
      // the headlights die behind you
      s.spawn(async (s2) => {
        await s2.until(() => W.in('yardNear', g.player.pos));
        g.audio.sfx('relay', { pos: A.car.pos, vol: 0.9 });
        for (let i = 0; i < 3; i++) {
          W.headlight.intensity = 0;
          for (const b of W.beams) b.visible = false;
          await s2.wait(0.07 + Math.random() * 0.08);
          W.headlight.intensity = 30;
          for (const b of W.beams) b.visible = true;
          await s2.wait(0.1);
        }
        W.headlight.intensity = 0;
        for (const b of W.beams) b.visible = false;
        g.fearTarget = Math.max(g.fearTarget, 0.3);
      });

      // not up those stairs in the dark
      s.spawn(async (s2) => {
        await s2.until(() => !st.flags.power && g.player.pos.x > 0.2 && g.player.pos.z < -1.5 && g.player.pos.z > -2.5 && g.player.pos.y < 1);
        if (st.flags.power) return;
        await st.line(s2, 'Not up there. Not in the dark. The power first.');
      });

      await s.until(() => st.flags.letter);
      await s.until(() => !g.ui.noteOpen);
      st.objective('Go inside.');
      await s.until(() => st.flags.frontOpened);
      await s.until(() => W.in('foyer', g.player.pos));
      st.flags.inside = true;
      st.director.inside = true;
      st.save();
      await s.wait(1.5);
      W.doors.front.close('slam');
      W.doors.front.locked = true;
      W.doors.front.lockedText = "It won't open. It isn't locked — something is holding it shut.";
      g.scareFx(0.5);
      await s.wait(1.4);
      await st.line(s, 'The wind. It was just the wind.');
      // something crosses the far end of the hall
      s.spawn(async (s2) => {
        const far = V(0, 1.2, -8.1);
        await s2.until(() => !st.flags.phoneRinging && W.in('foyer', g.player.pos) && lookingAt(g, far, 0.95) && g.flashlight.lit && her.mode === 'hidden', 60);
        if (!W.in('foyer', g.player.pos) || !lookingAt(g, far, 0.9)) return;
        her.show(V(-1.25, 0, -8.15), Math.PI / 2, 'lean');
        her.walking = 1;
        g.audio.sfx('skitter', { pos: V(0, 0.3, -8.1), vol: 0.9 });
        const t0 = g.time;
        while (g.time - t0 < 0.4) {
          her.root.position.x = -1.25 + ((g.time - t0) / 0.4) * 2.5;
          her.walking = 1;
          await s2.wait(0);
        }
        her.hide();
        g.fearTarget = Math.max(g.fearTarget, 0.6);
        await s2.wait(0.8);
        await st.line(s2, 'Hello?');
      });
      for (let i = 0; i < 3; i++) {
        g.audio.sfx('clockBell', { pos: A.clock.pos.clone().setY(1.8), vol: 0.75 });
        await s.wait(2.0);
      }
      await st.line(s, 'Three in the morning. The clock stopped at 3:13.');
      st.objective('Find the fuse box. Mom kept it in the pantry, off the kitchen.');

      await s.until(() => W.in('kitchen', g.player.pos));
      await s.wait(0.6);
      st.flags.phoneRinging = true;
      const ring = g.audio.phone(A.phone.pos, 0.9);
      g.fearTarget = 0.6;
      st.objective('Answer the phone.');
      await s.until(() => st.flags.phoneAnswered);
      ring.stop();
      W.props.handset.visible = false;
      g.player.canMove = false;
      g.audio.sfx('click', { vol: 0.6 });
      const hiss = g.audio.sfx('static', { vol: 0.12, loop: true, phone: true });
      await s.wait(1.6);
      g.audio.sfx('breathHer', { phone: true, vol: 1.2 });
      await s.wait(3.0);
      g.audio.sfx('giggle', { phone: true, vol: 0.9 });
      await st.line(s, 'You came home.', 'child', { speaker: 'On the line' });
      await s.wait(0.8);
      await st.line(s, "It's your turn to be it, Sam.", 'her', { wait: 1.6 });
      hiss?.stop(0.02);
      g.audio.sfx('scream', { phone: true, vol: 1.0 });
      g.audio.sfx('stinger', { vol: 0.5 });
      g.kick('static', 0.8);
      g.scareFx(0.7);
      await s.wait(0.9);
      g.audio.sfx('click', { vol: 0.6 });
      W.props.handset.visible = true;
      g.player.canMove = true;
      await s.wait(0.6);
      g.audio.sfx('runSteps', { pos: V(3.6, 3.3, -8.5), vol: 1.2 });
      await s.wait(1.9);
      g.audio.sfx('doorSlam', { pos: V(1.6, 4.2, -9.2), vol: 1 });
      g.fearTarget = 0.8;
      await s.wait(1.4);
      await st.line(s, "Someone's upstairs.");
      if (!st.flags.rules) {
        st.say("There's a note on the fridge. In Mom's handwriting.", 'inner');
        st.objective('Read the note on the fridge.');
        await s.until(() => st.flags.rules);
        await s.until(() => !g.ui.noteOpen);
      }
      st.objective('Get the power back on. The fuse box is in the pantry.');
      await s.until(() => st.flags.power);

      // power on
      g.audio.sfx('fuse', { pos: A.fusebox.pos, vol: 1 });
      W.props.fuseDoor.rotation.y = -1.7;
      W.lights.power = true;
      g.audio.setPower(true);
      s.spawn(async (s2) => {
        for (let i = 0; i < 16; i++) {
          W.lights.surge = 0.85 * (1 - i / 16);
          await s2.wait(0.09);
        }
        W.lights.surge = 0;
      });
      await s.wait(1.4);
      st.flags.tvOn = true;
      st.director.setTV(true);
      g.audio.sfx('static', { pos: A.tv.pos, vol: 1.3 });
      g.kick('static', 0.15);
      g.fearTarget = 0.6;
      await s.wait(1.2);
      await st.line(s, 'The TV...');
      st.objective("Go upstairs. Find Ellie's room.");
      st.save();
      s.spawn(async (s2) => {
        await s2.wait(4);
        g.audio.sfx('giggle', { pos: V(0.6, 4.3, -8), vol: 0.5, muffle: 2500 });
      });
      // a face at the living room window
      s.spawn(async (s2) => {
        const win = V(-8, 1.5, -5.7);
        await s2.until(() => W.in('livingroom', g.player.pos) && lookingAt(g, win, 0.88) && g.camera.position.distanceTo(win) < 7.5);
        her.show(V(-8.72, -0.6, -5.7), Math.PI / 2, 'smile');
        her.headTrack = 0.9;
        g.lightning({ near: true, delay: 0.2 });
        g.audio.sfx('stinger', { vol: 0.85, delay: 0.03 });
        g.audio.sfx('screech', { vol: 0.3, delay: 0.03 });
        g.scareFx(0.8);
        await s2.wait(0.32);
        her.hide();
        await s2.wait(1.5);
        await st.line(s2, 'No. No, no, no.');
      });
      // something in the TV snow
      s.spawn(async (s2) => {
        await s2.until(() => st.flags.tvOn && g.camera.position.distanceTo(A.tv.pos) < 2.6 && lookingAt(g, A.tv.pos, 0.9));
        st.director.tv.setFigure(1);
        await s2.wait(0.5);
        st.director.tv.setFigure(0);
      });
      await s.until(() => W.in('upstairs', g.player.pos));
      st.next(s);
    },
  },

  // -------------------------------------------------------------------
  rules: {
    id: 'rules',
    num: 'II',
    title: 'Her Room',
    setup(st, fromSave) {
      const g = st.game;
      const W = g.world;
      if (fromSave) {
        resetWorld(st, { power: true, rain: true });
        setDoors(W, DOORS);
        W.doors.front.lockedText = "It won't open. It isn't locked — something is holding it shut.";
        st.director.setTV(true);
        st.flags.tvOn = true;
        W.props.fuseDoor.rotation.y = -1.7;
        g.player.teleport(V(0.9, 3.0, -7.0), 0);
      }
      st.director.inside = true;
      for (const f of ['ellieKey', 'mirrorArmed', 'mirrorLocked', 'mirrorDone', 'calling', 'callingDone', 'ellieUnlocked', 'inEllie', 'drawing', 'powerOut']) st.flags[f] = false;
      st.inventory.delete('ellieKey');
      W.doors.ellie.locked = true;
      W.props.ellieBolt.visible = true;
      W.props.drawingPaper.visible = true;
      const m = W.props.mirror;
      m.key.visible = true;
      m.message.visible = false;
      m.target = m.angle = 0;
      m.pivot.rotation.y = 0;
      W.doors.ellie.unlockMode = 'slow';
      st.handlers = {
        ...commonHandlers(st),
        diary: () => {
          st.flags.readDiary = true;
        },
        mirror: () => {
          const mm = W.props.mirror;
          if (mm.target === 0) {
            mm.target = -1.75;
            mm.speed = 2.6;
            g.audio.sfx('creak2', { pos: mm.group.position, vol: 0.45, rate: 1.3 });
          } else {
            mm.target = 0;
            mm.speed = 2.6;
          }
        },
        bathKey: () => {
          W.props.mirror.key.visible = false;
          st.give('ellieKey', 'A small brass key. The tag says "E".');
          st.flags.mirrorArmed = true;
        },
        drawing: () => {
          W.props.drawingPaper.visible = false;
          st.readNote('drawing').then(() => {
            st.flags.drawing = true;
          });
        },
      };
      st.onLocked = (d) => {
        if (d.id === 'ellie' && !st.flags.saidLocked) {
          st.flags.saidLocked = true;
          st.script?.spawn(async (s2) => {
            await s2.wait(2.4);
            await st.line(s2, 'Mom padlocked it. From the outside.');
            if (!st.has('ellieKey')) st.objective("Find the key to Ellie's room.");
          });
        }
      };
      st.onUnlock = (d) => {
        if (d.id === 'ellie') {
          W.props.ellieBolt.visible = false;
          st.flags.ellieUnlocked = true;
        }
      };
    },
    async run(st, s) {
      const g = st.game;
      const W = g.world;
      const A = W.anchors;
      const her = g.entity;
      g.fadeTo(0, 1.2);
      g.ui.hud(true);
      g.ui.chapterCard('II', 'Her Room');
      st.objective("Find Ellie's room.");
      await s.wait(2.5);
      await st.line(s, "Ellie's room was the first door on the landing.");

      // Mom's wardrobe: her feet under the dresses
      s.spawn(async (s2) => {
        await s2.until(() => st.notesRead.includes('diary') && !g.ui.noteOpen && W.in('momRoom', g.player.pos));
        await s2.wait(1.2);
        const d = W.doors.momWardrobe;
        if (d.isOpen) return;
        const wp = A.momWardrobe.pos;
        const pose = clonePose(POSES.hang);
        pose.y = -0.28;
        her.show(V(wp.x + 0.02, wp.y, wp.z), -Math.PI / 2, pose);
        d.open('slow');
        g.fearTarget = 0.6;
        const t0 = g.time;
        let seen = 0;
        let last = g.time;
        await s2.until(() => {
          if (her.isObserved()) seen += g.time - last;
          last = g.time;
          return seen > 1.3 || her.distToPlayer() < 1.9 || g.time - t0 > 11;
        });
        g.flashlight.blackout(0.25);
        await s2.wait(0.1);
        her.hide();
        d.close('slam');
      });

      // a glimpse down the hall
      s.spawn(async (s2) => {
        await s2.wait(25);
        const end = V(0.1, 4.3, -11.5);
        await s2.until(() => W.in('upstairs', g.player.pos) && g.player.pos.z > -4.5 && !g.scares.busy && her.mode === 'hidden' && lookingAt(g, end, 0.96));
        her.show(V(0.1, 3.0, -11.4), 0, 'hang');
        await s2.wait(0.45);
        g.flashlight.blackout(0.12);
        await s2.wait(0.06);
        her.hide();
        g.fearTarget = Math.max(g.fearTarget, 0.55);
      });

      // Rule 2: the voice from downstairs, and the trap if you go
      const calling = async (s2) => {
        await s2.wait(5);
        st.flags.calling = true;
        const src = V(0.9, 1.4, -1.3);
        const lines = [
          ['Sammy? Is that you up there?', 'momA', 'mom'],
          ["Come downstairs, sweetheart. I made your favorite.", 'momB', 'mom'],
          ["Sam? Why won't you come down?", 'momC', 'mom'],
          ['SAM. COME DOWN HERE.', 'momBad', 'her'],
        ];
        const gaps = [0, 9, 12, 10];
        for (let i = 0; i < lines.length; i++) {
          await s2.wait(gaps[i]);
          if (!st.flags.calling) return;
          g.audio.sfx(lines[i][1], { pos: src, vol: 1.1, muffle: 1800 });
          st.say(lines[i][0], lines[i][2], { speaker: 'Downstairs' });
          if (i === 0) {
            await s2.wait(3.2);
            await st.line(s2, 'Rule two. Don\'t go down. It isn\'t her.');
          }
        }
        await s2.wait(9);
        st.flags.calling = false;
        st.flags.callingDone = true;
      };
      const trap = async (s2) => {
        await s2.until(() => st.flags.calling && W.in('stairsDown', g.player.pos));
        st.flags.calling = false;
        st.flags.callingDone = true;
        g.flashlight.blackout(1.0);
        g.audio.sfx('whisper1', { pos: V(0.9, 1.4, -1.5), vol: 1 });
        await s2.wait(0.8);
        await g.scares.lunge(s2, { level: 0.95 });
        g.player.teleport(V(0.9, 3.0, -7.0), 0);
        await s2.wait(0.8);
        await st.line(s2, "Don't go down. It isn't her. It was never her.");
      };

      // the mirror
      s.spawn(async (s2) => {
        const m = W.props.mirror;
        await s2.until(() => st.flags.mirrorArmed);
        await s2.wait(1.2);
        st.flags.mirrorLocked = true;
        m.speed = 0.9;
        m.target = 0;
        g.audio.sfx('creakLong', { pos: m.group.position, vol: 0.5, rate: 1.2 });
        await s2.until(() => Math.abs(m.angle) < 0.03);
        g.audio.sfx('doorShut', { pos: m.group.position, vol: 0.35 });
        const mp = m.reflector.getWorldPosition(new THREE.Vector3());
        const ok = await s2.until(() => W.in('bathroom', g.player.pos) && lookingAt(g, mp, 0.88) && g.camera.position.distanceTo(mp) < 2.8, 5);
        if (ok && W.in('bathroom', g.player.pos)) {
          const f = g.player.facing();
          const pos = g.player.pos.clone().addScaledVector(f, -0.8);
          const pose = clonePose(POSES.straight);
          pose.part = 0.75;
          pose.head = [0.0, 0, 0.35];
          her.show(pos, Math.atan2(f.x, f.z), pose);
          const yaw0 = g.player.yaw;
          await s2.wait(0.5);
          g.audio.scare({ scream: false, level: 0.85 });
          g.scareFx(0.6);
          await s2.until(() => Math.abs(wrapAngle(g.player.yaw - yaw0)) > 0.75, 2.4);
          g.flashlight.blackout(0.18);
          await s2.wait(0.05);
          her.hide();
          m.message.visible = true;
          await s2.wait(0.6);
        }
        st.flags.mirrorDone = true;
        // the power dies
        W.lights.surge = 1;
        await s2.wait(0.5);
        W.lights.power = false;
        W.lights.surge = 0;
        g.audio.setPower(false);
        g.audio.sfx('thud', { vol: 0.6 });
        st.director.setTV(false);
        st.flags.powerOut = true;
        g.fearTarget = 0.8;
        await s2.wait(1.2);
        g.audio.sfx('gasp', { vol: 0.5 });
        await st.line(s2, 'She was right behind me.');
        st.objective(st.flags.ellieUnlocked ? "Go into Ellie's room." : "Unlock Ellie's room.");
        s2.spawn(calling);
        s2.spawn(trap);
      });

      await s.until(() => st.has('ellieKey'));
      await s.until(() => st.flags.mirrorDone);
      await s.until(() => st.flags.ellieUnlocked);
      st.objective("Go into Ellie's room.");
      await s.until(() => W.in('ellieRoom', g.player.pos));
      st.flags.inEllie = true;
      st.save();
      const mb = g.audio.musicBox(A.musicbox.pos.clone().setY(A.musicbox.pos.y + 0.08), { slowdown: 0.012, vol: 0.55 });
      st.objective('Look around.');
      await s.wait(2);
      await st.line(s, "She's been sleeping in here. The sheets are wet.");
      await s.until(() => st.flags.drawing);
      // the door, the silence
      W.doors.ellie.close('slam');
      W.doors.ellie.locked = true;
      W.doors.ellie.lockedText = "It won't open.";
      mb.stop();
      g.scareFx(0.45);
      g.fearTarget = 0.85;
      st.objective('');
      await s.wait(3.2);
      g.audio.sfx('breathHer', { pos: A.wardrobe.pos.clone().setY(A.wardrobe.pos.y + 1.9), vol: 1 });
      await s.wait(2.4);
      W.doors.wardrobeL.open('slow');
      W.doors.wardrobeR.open('slow', { silent: true });
      const wp = A.wardrobe.pos;
      const inWardrobe = clonePose(POSES.hang);
      inWardrobe.y = -0.16;
      inWardrobe.kneeL = [0.35, 0, 0];
      inWardrobe.kneeR = [0.35, 0, 0];
      inWardrobe.hipL = [-0.2, 0, 0.03];
      inWardrobe.hipR = [-0.2, 0, -0.03];
      her.show(V(wp.x, wp.y, wp.z + 0.02), 0, inWardrobe);
      let seen = 0;
      let last = g.time;
      const t0 = g.time;
      await s.until(() => {
        if (her.isObserved()) seen += g.time - last;
        last = g.time;
        return seen > 2.4 || her.distToPlayer() < 1.6 || g.time - t0 > 15;
      });
      g.flashlight.blackout(1.3);
      g.audio.sfx('whisper2', { pos: her.headWorld(), vol: 1 });
      st.say('Ready or not...', 'whisper');
      await s.wait(0.55);
      s.spawn((s2) => g.scares.subliminal(s2, { dur: 0.06 }));
      await s.wait(0.4);
      her.hide();
      await s.wait(0.6);
      g.audio.sfx('giggle', { pos: V(-1.9, 4.3, -3.65), vol: 0.8 });
      await s.wait(1.8);
      W.doors.ellie.locked = false;
      W.doors.ellie.open('slow');
      await s.wait(1.2);
      await st.line(s, 'The door...');
      st.objective('Get out of her room.');
      await s.until(() => W.in('ellieDoorway', g.player.pos));
      g.flashlight.blackout(0.5);
      g.fadeTo(1, 0.25);
      g.audio.sfx('doorSlam', { vol: 0.6 });
      await s.wait(0.4);
      st.next(s);
    },
  },

  // -------------------------------------------------------------------
  hallway: {
    id: 'hallway',
    num: 'III',
    title: 'The Hallway',
    setup(st, fromSave) {
      const g = st.game;
      resetWorld(st, { power: false, rain: true });
      setDoors(g.world, DOORS);
      if (!st.flags.loop || st.flags.loop < 1 || st.flags.loop > 5) st.flags.loop = 1;
      if (!fromSave) st.flags.loop = 1;
      st.handlers = {
        sink: () => {
          st.flags.reaching = true;
        },
      };
      configureLoop(st, st.flags.loop);
    },
    async run(st, s) {
      const g = st.game;
      g.ui.hud(true);
      g.fadeTo(1, 0);
      g.fadeTo(0, 1.4);
      st.objective('');
      g.ui.chapterCard('III', 'The Hallway');
      let first = true;
      for (;;) {
        const n = st.flags.loop;
        if (!first) {
          configureLoop(st, n);
          g.fadeTo(0, 0.8);
        }
        const result = await runLoop(st, s, n, first);
        first = false;
        if (result === 'next') {
          if (n >= 5) break;
          st.flags.loop = n + 1;
          st.save();
        }
        g.fadeTo(1, 0.35);
        g.audio.sfx('doorSlam', { vol: 0.7 });
        await s.wait(0.9);
      }
      st.next(s);
    },
    tick(st, dt) {
      const L = st.loopTick;
      if (L) L(dt);
    },
  },

  // -------------------------------------------------------------------
  hunt: {
    id: 'hunt',
    num: 'IV',
    title: 'Ready or Not',
    setup(st, fromSave) {
      const g = st.game;
      const W = g.world;
      resetWorld(st, { power: false, rain: true });
      setDoors(W, { ...DOORS, kitchen: 'open', laundry: 0.35, pantry: 'closed', bath: 'closed', mom: 'closed', sam: 'closed' });
      W.doors.front.lockedText = "It won't open.";
      W.doors.basement.lockedText = 'Chained shut. The chain is new.';
      W.props.blockade.visible = true;
      W.blockadeCollider.enabled = true;
      ch4Decals(g).visible = true;
      for (const k of ['doll', 'ribbon', 'picture']) W.props[k].visible = !st.has(k);
      g.player.teleport(V(0, 0, -7.6), 0);
      g.entity.nav = null;
      g.entity.buildNav();
      st.handlers = {
        lastNote: () => {
          st.flags.lastNote = true;
        },
        item: (id) => {
          const n = ['doll', 'ribbon', 'picture'].filter((i) => st.has(i)).length;
          st.objective(n < 3 ? `Find Ellie's ribbon, doll and picture. (${n}/3)` : 'Go to the basement door.');
          st.save();
          const her = g.entity;
          her.speed = 2.5 + n * 0.3;
          st.script?.spawn(async (s2) => {
            if (n === 1) {
              const ring = g.audio.phone(W.anchors.phone.pos, 0.8);
              await s2.wait(7);
              ring.stop();
            }
            if (n < 3 && her.mode === 'stalk' && !her.observed && her.distToPlayer() > 5) her.relocateUnseen(5.5, 9);
            if (n === 2) {
              await s2.wait(1.5);
              st.say('Hurry, Sam.', 'whisper');
              g.audio.sfx('whisper3', { pos: st.director.around('behind'), vol: 0.9 });
            }
          });
        },
      };
    },
    async run(st, s) {
      const g = st.game;
      const W = g.world;
      const her = g.entity;
      g.ui.hud(true);
      g.whiteTo(1, 0);
      g.fadeTo(0, 0);
      g.whiteTo(0, 3.0);
      g.ui.chapterCard('IV', 'Ready or Not');
      await s.wait(3.2);
      if (!st.flags.lastNote) {
        await st.line(s, "I'm downstairs again. The basement door.");
        st.say('Something is nailed to it.', 'inner');
        st.objective('Read the note nailed to the basement door.');
        await s.until(() => st.flags.lastNote);
        await s.until(() => !g.ui.noteOpen);
      }
      if (!st.flags.counted) {
        await s.wait(1.2);
        for (let i = 1; i <= 10; i++) {
          g.audio.sfx(pick(['whisper1', 'whisper3']), { pos: st.director.around('far'), vol: 0.8, rate: rand(0.9, 1.1) });
          st.say(`${i}...`, 'child', { dur: 1.1 });
          await s.wait(1.2);
        }
        await s.wait(0.6);
        await st.line(s, 'Ready or not...', 'her', { wait: 1.8 });
        g.audio.sfx('scream2', { vol: 0.5, muffle: 1400, pos: V(4, 1.5, -2) });
        g.audio.sfx('swell', { vol: 0.6 });
        await st.line(s, 'HERE I COME.', 'her', { wait: 1.5 });
        st.flags.counted = true;
        st.save();
      }
      const n = ['doll', 'ribbon', 'picture'].filter((i) => st.has(i)).length;
      st.objective(`Find Ellie's ribbon, doll and picture. (${n}/3)`);
      g.ui.hint("She can't move while you can see her. Keep the light on her. The dark is where she walks.", 11);
      her.onCatch = () => st.die();
      her.startStalk(V(4.5, 0, -2.5), { speed: 2.5 + n * 0.3 });
      her.relocateUnseen(8, 13);
      await s.until(() => ['doll', 'ribbon', 'picture'].every((i) => st.has(i)) && !st.dead);
      await s.until(() => !her.observed || her.distToPlayer() > 3, 4);
      g.flashlight.blackout(0.3);
      await s.wait(0.1);
      her.hide();
      her.onCatch = null;
      await s.wait(1.0);
      g.audio.sfx('chains', { pos: V(0, 1.2, -8.9), vol: 1 });
      await s.wait(1.0);
      W.props.chains.visible = false;
      W.doors.basement.locked = false;
      W.doors.basement.open('slow');
      await s.wait(1.2);
      await st.line(s, 'She wants me to come down.');
      st.objective('Go down to the well.');
      await s.until(() => g.player.pos.y < -1.4 && g.player.pos.z < -10.5);
      st.next(s);
    },
    respawn(st, s) {
      const g = st.game;
      const her = g.entity;
      her.hide();
      g.player.teleport(V(0, 0, -7.6), 0);
      g.flashlight.on = true;
      st.script?.spawn(async (s2) => {
        await s2.wait(2.5);
        if (['doll', 'ribbon', 'picture'].every((i) => st.has(i))) return;
        her.onCatch = () => st.die();
        her.startStalk(V(4.5, 0, -2.5), { speed: her.speed });
        her.relocateUnseen(9, 14);
      });
    },
  },

  // -------------------------------------------------------------------
  well: {
    id: 'well',
    num: 'V',
    title: 'The Well',
    setup(st, fromSave) {
      const g = st.game;
      const W = g.world;
      resetWorld(st, { power: false, rain: true });
      setDoors(W, { ...DOORS, basement: 'open' });
      W.props.chains.visible = false;
      W.props.candles.visible = true;
      for (const f of W.props.flames) f.visible = true;
      for (const c of W.fixtures.candles) c.on = true;
      if (fromSave) {
        g.player.teleport(V(0, YB, -13.9), 0);
        for (const k of ['doll', 'ribbon', 'picture']) st.inventory.add(k);
      }
      for (const f of ['giving', 'gaveBack', 'saidGoodbye']) st.flags[f] = false;
      st.handlers = {
        well: () => {
          if (!st.flags.gaveBack) st.flags.giving = true;
          else st.flags.saidGoodbye = true;
        },
      };
    },
    async run(st, s) {
      const g = st.game;
      const W = g.world;
      const A = W.anchors;
      const her = g.entity;
      const wellTop = A.well.pos.clone().setY(YB + 0.8);
      g.fadeTo(0, 1);
      g.ui.chapterCard('V', 'The Well');
      st.objective('Give her things back to the well.');
      s.spawn(async (s2) => {
        await s2.until(() => g.player.pos.distanceTo(V(0, YB, -15.2)) < 1.8);
        await st.line(s2, 'Mom sat here. Every night, for twenty years. Watching it.');
      });
      await s.until(() => st.flags.giving);
      g.player.canMove = false;
      g.player.forceLook(wellTop, 3);
      const give = [
        ['ribbon', 'Your ribbon.'],
        ['doll', 'Mr. Buttons.'],
        ['picture', 'Your picture. From second grade.'],
      ];
      for (const [item, text] of give) {
        await st.line(s, text, 'inner', { wait: 1.6 });
        st.inventory.delete(item);
        g.audio.sfx('pickup', { vol: 0.5 });
        await s.wait(1.5);
        g.audio.sfx('splash', { pos: A.well.pos.clone().setY(YB - 1.5), vol: 0.6, rate: 0.8 });
        await s.wait(1.2);
      }
      g.player.forceLook(null);
      st.flags.gaveBack = true;
      st.flags.giving = false;
      st.objective('Say goodbye.');
      await s.until(() => st.flags.saidGoodbye);
      st.objective('');
      g.player.canMove = false;
      g.player.canLook = false;
      g.player.forceLook(wellTop.clone().setY(YB + 1.2), 2.5);
      await st.line(s, 'Goodbye, Ellie.', 'inner', { wait: 2.8 });
      await st.line(s, "I'm sorry I stopped looking.", 'inner', { wait: 3.0 });
      await st.line(s, "I'm sorry I went to Danny's.", 'inner', { wait: 3.2 });
      await s.wait(2.2);
      // the candles go out
      g.audio.sfx('whoosh', { vol: 1 });
      for (const f of W.props.flames) f.visible = false;
      for (const c of W.fixtures.candles) c.on = false;
      g.fearTarget = 0.9;
      await s.wait(1.6);
      g.audio.sfx('whisper4', { pos: V(0, YB + 1.8, -22), vol: 1.1 });
      await st.line(s, "You're it, Sam.", 'her', { wait: 2.0 });
      const steps = [[-22.3, 'hang', 0.8, 0.8], [-20.6, 'crouch', 0.6, 0.6], [-19.2, 'lean', 0.45, 0.5]];
      for (const [z, pose, off, on] of steps) {
        g.flashlight.blackout(off);
        await s.wait(off * 0.5);
        her.show(V(0, YB, z), 0, pose);
        her.headTrack = 0.8;
        g.audio.sfx('herStep1', { pos: V(0, YB + 0.1, z), vol: 1 });
        await s.wait(off * 0.5 + on);
      }
      g.flashlight.blackout(0.35);
      await s.wait(0.35);
      // over the well, in your face
      const cam = g.camera;
      const fwd = cam.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      const headAt = cam.position.clone().addScaledVector(fwd, 0.55);
      her.show(V(headAt.x, YB, headAt.z - 0.25), 0, 'lunge');
      her.update(0);
      her.root.updateMatrixWorld(true);
      const hw = her.headWorld(new THREE.Vector3());
      her.root.position.y += headAt.y - hw.y;
      her.root.position.z += headAt.z - hw.z;
      her.setFace('scream');
      her.jawTarget = 1;
      g.audio.scare({ level: 1, pos: headAt });
      g.scareFx(1);
      const hands = W.props.wellHands;
      hands.visible = true;
      hands.position.set(A.well.pos.x, YB - 0.9, A.well.pos.z);
      const t0 = g.time;
      while (g.time - t0 < 0.55) {
        hands.position.y = YB - 0.9 + ((g.time - t0) / 0.55) * 1.9;
        g.player.shake(0.3);
        await s.wait(0);
      }
      // yanked back and down into the dark
      const start = her.root.position.clone();
      const t1 = g.time;
      g.audio.sfx('screamFar', { pos: A.well.pos.clone().setY(YB), vol: 1 });
      while (g.time - t1 < 0.75) {
        const k = (g.time - t1) / 0.75;
        const e = k * k;
        her.root.position.set(start.x + (A.well.pos.x - start.x) * Math.min(1, k * 2), start.y - e * 4.5, start.z + (A.well.pos.z - start.z) * Math.min(1, k * 2));
        hands.position.y = YB + 1.0 - e * 4;
        g.player.shake(0.2);
        await s.wait(0);
      }
      her.hide();
      hands.visible = false;
      g.audio.sfx('splash', { pos: A.well.pos.clone().setY(YB - 2), vol: 1, rate: 0.7 });
      g.audio.sfx('thud', { vol: 0.4 });
      await s.wait(2.5);
      for (let i = 0; i < W.props.flames.length; i++) {
        W.props.flames[i].visible = true;
        if (i % 3 === 0) W.fixtures.candles[i / 3].on = true;
        await s.wait(0.32);
      }
      g.fearTarget = 0;
      await s.wait(1.2);
      g.audio.sfx('giggle', { pos: A.well.pos.clone().setY(YB + 0.5), vol: 0.35, rate: 1.05 });
      await st.line(s, 'Found you, Sam.', 'child', { wait: 3.2 });
      await st.line(s, 'Bye.', 'child', { wait: 2.4 });
      g.whiteTo(1, 4);
      await s.wait(4.5);
      st.next(s);
    },
  },

  // -------------------------------------------------------------------
  after: {
    id: 'after',
    num: '',
    title: 'After',
    setup(st) {
      const g = st.game;
      const W = g.world;
      resetWorld(st, { power: false, rain: false, env: 'dawn' });
      setDoors(W, { ...DOORS, front: 'open' });
      W.fixtures.porch.on = true;
      W.props.chains.visible = false;
      g.player.teleport(V(0, 0, 1.4), Math.PI);
      st.flags.leaving = false;
      st.handlers = {
        car: () => {
          st.flags.leaving = true;
        },
      };
    },
    async run(st, s) {
      const g = st.game;
      const ui = g.ui;
      g.ui.hud(true);
      g.whiteTo(1, 0);
      g.whiteTo(0, 4);
      await s.wait(3.5);
      await st.line(s, 'The porch light is on.');
      st.objective('Go home.');
      await s.until(() => st.flags.leaving);
      g.player.canMove = false;
      g.audio.sfx('carDoor', { vol: 0.9 });
      g.fadeTo(1, 1.4);
      await s.wait(2.4);
      ui.hud(false);
      st.objective('');
      g.mode = 'cine';
      const lines = [
        'I never went back to Hollow Creek Road.',
        'They tore the house down that spring. They filled in the well.',
        'I sleep with the lights on now.',
        'And some nights, when it gets too quiet...',
        '...I still count to ten. Just in case.',
      ];
      for (const t of lines) {
        ui.cineLine(t);
        await s.wait(3.8);
        ui.cineClear();
        await s.wait(1.9);
      }
      await s.wait(1.0);
      for (let i = 1; i <= 9; i++) {
        const el = ui.cineLine(String(i), 'count');
        g.audio.sfx(pick(['whisper1', 'whisper3']), { vol: 0.22 + i * 0.03 });
        await s.wait(1.05);
        if (i < 9) {
          el.classList.add('fade');
          setTimeout(() => el.remove(), 900);
        }
      }
      await s.wait(2.6);
      ui.cineClear(false);
      await g.scares.screenFace(s, { dur: 1.6 });
      g.fadeTo(1, 0);
      g.fx.face = 0;
      await s.wait(2.8);
      const sv = loadJSON('comehome.save');
      saveJSON('comehome.save', { ...sv, chapter: 'prologue', completed: true });
      g.mode = 'credits';
      g.running = false;
      g.input.exitLock();
      g.input.wantLock = false;
      document.getElementById('app').classList.remove('playing');
      g.audio.stopLoops();
      ui.credits(CREDITS, () => st.toTitle());
    },
  },
};

// =====================================================================
// The loop
function loopCopy(n) {
  return n === 3 || n === 5 ? 'long' : 'short';
}

function configureLoop(st, n) {
  const g = st.game;
  const W = g.world;
  const her = g.entity;
  her.hide();
  if (her.collider) her.collider.enabled = false;
  st.loopTick = null;
  g.player.onStep = null;
  g.audio.stopLoops();
  for (const [name, L] of Object.entries(W.loops)) {
    const active = name === loopCopy(n);
    setDoors(W, { [`loopStart_${name}`]: 'locked', [`loopBath_${name}`]: 'locked', [`loopExit_${name}`]: 'closed' });
    L.tilted.visible = active && n === 2;
    L.scrawl.visible = active && n === 3;
    L.exitGlow.visible = active && n === 5;
    L.exitFx.on = active && n === 5;
    L.bathFx.on = active && (n === 2 || n === 3);
    for (const b of L.bulbs) {
      b.fx.on = active && (n <= 3 || (n === 4 && b === L.bulbs[L.bulbs.length - 1]));
      b.fx.flicker = n === 4 ? 0.35 : n === 3 ? 0.15 : 0.05;
      b.fx.color.set(n === 3 ? 0xff2a1a : 0xffc98a);
      b.swing = n >= 4 ? 1 : 0.2;
    }
    L.bathFx.color.set(n === 3 ? 0xff2a1a : 0xffd9b0);
  }
  const L = W.loops[loopCopy(n)];
  if (n === 2 || n === 3) W.doors[`loopBath_${L.name}`].locked = false;
  if (n === 2) W.doors[`loopBath_${L.name}`].setAjar(0.35, 'instant');
  if (n === 3) {
    W.doors[`loopBath_${L.name}`].setAjar(0.8, 'instant');
    W.doors[`loopExit_${L.name}`].locked = true;
    W.doors[`loopExit_${L.name}`].lockedText = "It's locked. There's a keyhole.";
    st.inventory.delete('loopKey');
    st.flags.reaching = false;
  }
  if (n === 5) W.doors[`loopExit_${L.name}`].setAjar(1, 'instant');
  W.lights.tint.set(1, 1, 1);
  const a = W.anchors[`loopStart_${L.name}`];
  g.player.teleport(a.pos, 0);
}

async function runLoop(st, s, n, first) {
  const g = st.game;
  const W = g.world;
  const her = g.entity;
  const L = W.loops[loopCopy(n)];
  const name = L.name;
  const exitTrig = `loopExit_${name}`;
  const inB = () => W.in(`loopB_${name}`, g.player.pos);
  st.director.tension = [0, 0.45, 0.55, 0.7, 0.8, 0.9][n];
  const reachedExit = () => W.in(exitTrig, g.player.pos);

  if (n === 1) {
    await s.wait(first ? 2.4 : 1);
    await st.line(s, "This isn't the upstairs hall. This isn't anywhere in the house.");
    st.objective('Keep going.');
    s.spawn(async (s2) => {
      await s2.until(() => g.player.pos.z < -4.2);
      radio(st, s2, 1, L);
    });
    await s.until(reachedExit);
    return 'next';
  }
  if (n === 2) {
    await s.wait(1.2);
    await st.line(s, 'The same hallway. The same door.');
    s.spawn(async (s2) => {
      await s2.until(() => g.player.pos.z < -4.2);
      radio(st, s2, 2, L);
    });
    s.spawn(async (s2) => {
      const drips = setInterval(() => g.audio.sfx('drip', { pos: V(L.ox + 3.2, 0.9, -5), vol: 0.35, rate: rand(0.9, 1.2) }), 1300);
      try {
        await s2.until(() => inB() || reachedExit(), 120);
      } finally {
        clearInterval(drips);
      }
    });
    s.spawn(async (s2) => {
      await s2.until(() => W.in(`loopCorner_${name}`, g.player.pos));
      g.audio.sfx('giggle', { pos: g.player.pos.clone().add(V(0, 1.4, 2.2)), vol: 0.8 });
      await s2.wait(2);
      g.audio.sfx('knockSlow', { pos: V(L.ox - 1.2, 1.5, -6), vol: 0.9 });
    });
    await s.until(reachedExit);
    return 'next';
  }
  if (n === 3) {
    await s.wait(1.2);
    await st.line(s, "It's longer. The hallway is longer.");
    g.fearTarget = 0.5;
    s.spawn(async (s2) => {
      await s2.until(() => g.player.pos.z < -4.2);
      radio(st, s2, 3, L);
    });
    st.onLocked = (d) => {
      if (d.id === `loopExit_${name}` && !st.flags.saidSink) {
        st.flags.saidSink = true;
        st.script?.spawn(async (s2) => {
          await s2.wait(2.2);
          await st.line(s2, 'Locked. The light is on in the bathroom.');
          st.objective('Find the key.');
        });
      }
    };
    await s.until(() => st.flags.reaching);
    g.player.canMove = false;
    g.player.forceLook(W.anchors[`loopSink_${name}`].pos, 6);
    await st.line(s, 'Something is in the drain.', 'inner', { wait: 1.2 });
    g.audio.sfx('splash', { pos: W.anchors[`loopSink_${name}`].pos, vol: 0.8, rate: 1.2 });
    await s.wait(0.9);
    g.flashlight.blackout(0.5);
    g.audio.sfx('scream2', { vol: 0.7, muffle: 900, pos: W.anchors[`loopSink_${name}`].pos });
    g.audio.sfx('splash', { pos: W.anchors[`loopSink_${name}`].pos, vol: 1 });
    g.scareFx(0.8);
    g.player.shake(0.8);
    await s.wait(1.0);
    g.player.forceLook(null);
    g.player.canMove = true;
    st.give('loopKey', 'A small iron key. The water was warm.');
    await st.line(s, 'Something held my hand. Something small.');
    st.objective('Keep going.');
    st.flags.reaching = false;
    st.onLocked = null;
    await s.until(reachedExit);
    return 'next';
  }
  if (n === 4) {
    // Rule 3: never look at her when she smiles
    const zc = L.zc;
    const spot = V(L.ox + 0.05, 0, zc + 0.25);
    her.show(spot, 0, 'hang');
    her.headTrack = 0;
    if (!her.collider) her.collider = g.physics.addBox(0, 0, 0, 0.1, 2, 0.1, { occlude: false });
    Object.assign(her.collider, { minX: spot.x - 0.22, maxX: spot.x + 0.22, minZ: spot.z - 0.22, maxZ: spot.z + 0.22, minY: 0, maxY: 2.2, enabled: true });
    await s.wait(1.0);
    await st.line(s, 'Oh God.');
    let rising = false;
    let gaze = 0;
    let whisperT = 3;
    let failed = false;
    let passed = false;
    st.loopTick = (dt) => {
      if (failed || passed) return;
      const d = her.distToPlayer();
      if (!rising && d < 8.5) {
        rising = true;
        her.setPose('smile', false, 0.2);
        her.headTrack = 0.6;
        st.say("Don't look at her face. Rule three.", 'inner', { dur: 4 });
      }
      if (rising) {
        whisperT -= dt;
        if (whisperT <= 0) {
          whisperT = rand(3.5, 5.5);
          g.audio.sfx(pick(['whisper1', 'whisper2', 'whisper3']), { pos: her.headWorld(), vol: 0.8 });
          st.say(pick(['Look at me, Sam.', 'Sam. Look at me.', "Why won't you look at me?"]), 'whisper', { dur: 2.2 });
        }
        const revealed = her.pose.part > 0.45;
        if (revealed && her.faceInView(0.3, 14)) gaze += dt;
        else gaze = Math.max(0, gaze - dt * 0.35);
        g.fearTarget = Math.max(g.fearTarget, 0.4 + gaze * 0.5);
        if (gaze > 0.35) g.kick('distort', gaze * 0.4);
        if (gaze > 1.0) failed = true;
      }
      if (inB() && g.player.pos.x > L.ox + 2.4) passed = true;
    };
    await s.until(() => failed || passed);
    st.loopTick = null;
    if (failed) {
      await g.scares.lunge(s, { from: her.headWorld() });
      her.collider.enabled = false;
      await st.line(s, "I looked. I looked at her.", 'inner', { wait: 1.5 });
      return 'retry';
    }
    her.collider.enabled = false;
    her.hide();
    g.audio.sfx('giggle', { pos: V(L.ox, 1.4, zc), vol: 0.5 });
    await s.until(reachedExit);
    return 'next';
  }
  // n === 5 — Rule 4: don't look back
  await s.wait(0.8);
  await st.line(s, 'Longer again. And there is light at the end.');
  st.objective("Walk to the light. Don't look back.");
  const zc = L.zc;
  const pose = clonePose(POSES.reach);
  pose.part = 0.4;
  her.show(V(L.ox, 0, 2), 0, pose);
  her.breathLoop(true);
  let failed = false;
  let stillT = 0;
  let whisperT = 4;
  const behind = new THREE.Vector3();
  g.player.onStep = () => {
    g.audio.sfx(Math.random() < 0.5 ? 'herStep1' : 'herStep2', { pos: her.root.position.clone().setY(0.1), vol: 0.9, delay: 0.16 });
  };
  st.loopTick = (dt) => {
    if (failed) return;
    const p = g.player.pos;
    // path-behind: back down corridor A, or back toward the corner in corridor B
    if (p.x < L.ox + 1.0) behind.set(L.ox, 0, Math.min(p.z + 1.35, 1.2));
    else behind.set(Math.max(p.x - 1.35, L.ox), 0, zc);
    her.root.position.lerp(behind, 1 - Math.exp(-10 * dt));
    her.faceTowards(p);
    const moving = g.player.moving;
    stillT = moving ? 0 : stillT + dt;
    g.flashlight.flicker = Math.max(g.flashlight.flicker, stillT > 3 ? 0.4 : 0.05);
    g.fearTarget = Math.max(g.fearTarget, 0.55 + Math.min(0.4, stillT * 0.1));
    whisperT -= dt * (stillT > 3 ? 2 : 1);
    if (whisperT <= 0) {
      whisperT = rand(4.5, 7.5);
      g.audio.sfx(pick(['whisper1', 'whisper2', 'whisper3', 'whisper4']), { pos: her.headWorld(), vol: 0.9 });
      st.say(pick(['Sam.', 'Turn around.', "I'm right behind you.", 'You never looked for me.', 'Look at me. Just once.']), 'whisper', { dur: 2.2 });
    }
    // looking back at her = she has you
    const cam = g.camera;
    const f = cam.getWorldDirection(new THREE.Vector3());
    const h = her.headWorld(new THREE.Vector3());
    const toHer = h.clone().sub(cam.position).normalize();
    const chest = her.root.position.clone().setY(1.5).sub(cam.position).normalize();
    if (f.dot(toHer) > 0.72 || f.dot(chest) > 0.72) failed = true;
  };
  await s.until(() => failed || reachedExit());
  st.loopTick = null;
  g.player.onStep = null;
  her.breathLoop(false);
  if (failed) {
    await g.scares.lunge(s, { from: her.headWorld() });
    await st.line(s, "Don't look back. Don't look back.", 'inner', { wait: 1.4 });
    return 'retry';
  }
  her.hide();
  g.whiteTo(1, 0.8);
  g.audio.sfx('swell', { vol: 0.35, rate: 1.4 });
  await s.wait(1.2);
  return 'next';
}

function radio(st, s, which, L) {
  const g = st.game;
  const pos = V(L.ox - 0.78, 1.0, -6.5);
  const hiss = g.audio.sfx('static', { pos, vol: 0.5, loop: true });
  const voice = which === 3 ? 'radioBad' : which === 1 ? 'radioA' : 'radioB';
  g.audio.sfx(voice, { pos, vol: 1.0, delay: 0.6 });
  st.say(RADIO[which], which === 3 ? 'her' : 'radio', { speaker: which === 3 ? '' : 'Radio', dur: 7 });
  s.spawn(async (s2) => {
    await s2.wait(7.5);
    hiss?.stop(0.4);
  });
}
