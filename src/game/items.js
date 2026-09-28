import * as THREE from 'three';
import { Kit } from '../world/builder.js';
import * as P from '../world/props.js';
import { makeKey } from '../world/mirror.js';

/**
 * Every usable thing that isn't a door. Each item's enabled() reads story
 * state, so chapters only have to set flags; handlers call back into the
 * chapter via story.on(<event>).
 */
export function setupItems(game, story) {
  const W = game.world;
  const M = game.mats;
  const I = game.interact;
  const A = W.anchors;
  const items = {};
  const ch = () => story.chapterId;
  const emit = (name, ...args) => story.handlers?.[name]?.(...args);

  const hitBox = (x, y, z, w, h, d, parent = W.root) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // --- chapter I
  items.mailbox = I.add({
    id: 'mailbox',
    meshes: [hitBox(A.mailbox.pos.x, A.mailbox.pos.y, A.mailbox.pos.z, 0.4, 0.4, 0.6)],
    prompt: 'Open the mailbox',
    enabled: () => ch() === 'arrival' && !story.flags.letter,
    onUse: () => emit('mailbox'),
  });
  items.rules = I.add({
    id: 'rules',
    meshes: [hitBox(A.rules.pos.x, A.rules.pos.y, A.rules.pos.z, 0.1, 0.35, 0.35)],
    prompt: 'Read the note',
    enabled: () => ['arrival', 'rules', 'hunt'].includes(ch()),
    onUse: () => {
      story.readNote('rules').then(() => emit('rules'));
    },
  });
  items.phone = I.add({
    id: 'phone',
    meshes: [hitBox(A.phone.pos.x, A.phone.pos.y, A.phone.pos.z, 0.2, 0.35, 0.3)],
    prompt: () => (story.flags.phoneRinging ? 'Answer the phone' : 'The phone'),
    enabled: () => !!story.flags.phoneRinging,
    onUse: () => emit('phone'),
  });
  items.fusebox = I.add({
    id: 'fusebox',
    meshes: [hitBox(A.fusebox.pos.x, A.fusebox.pos.y, A.fusebox.pos.z, 0.5, 0.6, 0.3)],
    prompt: 'Throw the main switch',
    enabled: () => ch() === 'arrival' && story.flags.phoneAnswered && story.flags.rules && !story.flags.power,
    onUse: () => emit('fusebox'),
  });
  items.placecard = I.add({
    id: 'placecard',
    meshes: [hitBox(5.0, 0.82, -2.7, 0.4, 0.2, 0.4)],
    prompt: 'Look at the place card',
    enabled: () => ['arrival', 'rules'].includes(ch()),
    onUse: () => story.readNote('placecard'),
  });
  items.photos = I.add({
    id: 'photos',
    meshes: [hitBox(-1.4, 1.62, -3.5, 0.1, 0.55, 0.45), hitBox(-1.4, 1.7, -6.3, 0.1, 0.5, 0.4)],
    prompt: 'Look at the photographs',
    enabled: () => ['arrival', 'rules'].includes(ch()),
    onUse: () => story.readNote('photos'),
  });
  items.tv = I.add({
    id: 'tv',
    meshes: [hitBox(A.tv.pos.x, A.tv.pos.y, A.tv.pos.z, 0.7, 0.5, 0.4)],
    prompt: 'Turn off the TV',
    enabled: () => !!story.flags.tvOn && ['arrival', 'rules'].includes(ch()),
    onUse: () => emit('tv'),
  });

  // --- chapter II
  items.diary = I.add({
    id: 'diary',
    meshes: [hitBox(A.diary.pos.x, A.diary.pos.y, A.diary.pos.z, 0.35, 0.15, 0.3)],
    prompt: "Read Mom's diary",
    enabled: () => ['arrival', 'rules'].includes(ch()),
    onUse: () => story.readNote('diary').then(() => emit('diary')),
  });
  {
    const k = new Kit({ group: W.root, physics: game.physics, add() {} }, A.diary.pos.x, A.diary.pos.y, A.diary.pos.z, 0.3, { dynamic: true });
    k.box(-0.1, 0, -0.07, 0.1, 0.035, 0.07, M.blanketMom);
    k.box(-0.095, 0.035, -0.065, 0.095, 0.037, 0.065, M.paper);
  }
  items.clipping = I.add({
    id: 'clipping',
    meshes: [hitBox(A.clipping.pos.x - 0.15, A.clipping.pos.y, A.clipping.pos.z, 0.1, 0.55, 0.45)],
    prompt: 'Read the clipping',
    enabled: () => ['arrival', 'rules'].includes(ch()),
    onUse: () => story.readNote('clipping'),
  });
  items.samNote = I.add({
    id: 'samNote',
    meshes: [hitBox(A.samNote.pos.x, A.samNote.pos.y, A.samNote.pos.z, 0.35, 0.12, 0.3)],
    prompt: 'Read the note',
    enabled: () => ['arrival', 'rules'].includes(ch()),
    onUse: () => story.readNote('samNote'),
  });
  {
    const k = new Kit({ group: W.root, physics: game.physics, add() {} }, A.samNote.pos.x, A.samNote.pos.y, A.samNote.pos.z, -0.4, { dynamic: true });
    k.box(-0.1, 0, -0.14, 0.1, 0.004, 0.14, M.paper);
  }
  items.poster = I.add({
    id: 'poster',
    meshes: [hitBox(A.poster.pos.x, A.poster.pos.y, A.poster.pos.z, 0.1, 0.75, 0.55)],
    prompt: 'Look at the poster',
    enabled: () => ['arrival', 'rules'].includes(ch()),
    onUse: () => {
      story.readNote('poster');
      story.flags.poster = true;
    },
  });
  const mirror = W.props.mirror;
  items.mirror = I.add({
    id: 'mirror',
    meshes: [mirror.reflector, ...mirror.frames],
    prompt: () => (mirror.target !== 0 ? 'Close the cabinet' : 'Open the cabinet'),
    enabled: () => ['arrival', 'rules'].includes(ch()) && !story.flags.mirrorLocked,
    onUse: () => emit('mirror'),
  });
  items.bathKey = I.add({
    id: 'bathKey',
    meshes: [hitBox(-3.3 + 0.02, mirror.group.position.y + 0.02, mirror.group.position.z + 0.08, 0.14, 0.08, 0.12)],
    prompt: 'Take the key',
    enabled: () => mirror.angle < -1.0 && !story.has('ellieKey') && mirror.key.visible,
    onUse: () => emit('bathKey'),
  });
  items.drawing = I.add({
    id: 'drawing',
    meshes: [hitBox(A.drawingNote.pos.x, A.drawingNote.pos.y, A.drawingNote.pos.z, 0.4, 0.15, 0.4)],
    prompt: 'Pick up the drawing',
    enabled: () => ch() === 'rules' && story.flags.inEllie && !story.flags.drawing,
    onUse: () => emit('drawing'),
  });
  {
    const k = new Kit({ group: W.root, physics: game.physics, add() {} }, A.drawingNote.pos.x, A.drawingNote.pos.y + 0.005, A.drawingNote.pos.z, 0.5, { dynamic: true });
    k.plane(0.3, 0.3, 0, 0, 0, M.drawing.tall, { rx: -Math.PI / 2 });
    W.props.drawingPaper = k.group;
  }
  items.musicBox = I.add({
    id: 'musicBox',
    meshes: [hitBox(A.musicbox.pos.x, A.musicbox.pos.y + 0.06, A.musicbox.pos.z, 0.25, 0.2, 0.2)],
    prompt: 'The music box',
    enabled: () => ch() === 'rules' && story.flags.inEllie,
    onUse: () => story.say('Her music box. Still wound. Somebody winds it.', 'inner'),
  });

  // --- chapter III
  for (const name of ['short', 'long']) {
    const a = A[`loopSink_${name}`];
    items[`sink_${name}`] = I.add({
      id: `sink_${name}`,
      meshes: [hitBox(a.pos.x, a.pos.y, a.pos.z, 0.5, 0.25, 0.45)],
      prompt: 'Reach into the black water',
      enabled: () => ch() === 'hallway' && story.flags.loop === 3 && !story.has('loopKey'),
      onUse: () => emit('sink'),
    });
  }

  // --- chapter IV: the three things she was brought back with
  const mk = (name, x, y, z, ry, build) => {
    const k = new Kit({ group: W.root, physics: game.physics, add() {} }, x, y, z, ry, { dynamic: true });
    build(k);
    k.group.visible = false;
    W.props[name] = k.group;
    return k.group;
  };
  const doll = mk('doll', -5.5, 0.45, -1.1, Math.PI, (k) => P.doll(k, M));
  const ribbon = mk('ribbon', A.ribbon.pos.x, A.ribbon.pos.y + 0.01, A.ribbon.pos.z, 0.3, (k) => {
    k.rbox(0.09, 0.02, 0.05, -0.045, 0.01, 0, M.ribbon, 0, 0, 0.3);
    k.rbox(0.09, 0.02, 0.05, 0.045, 0.01, 0, M.ribbon, 0, 0, -0.3);
    k.rbox(0.02, 0.012, 0.14, -0.02, 0.006, 0.08, M.ribbon, 0, 0.3, 0);
    k.rbox(0.02, 0.012, 0.14, 0.02, 0.006, 0.08, M.ribbon, 0, -0.3, 0);
  });
  const picture = mk('picture', A.picture.pos.x, A.picture.pos.y, A.picture.pos.z + 0.1, 0, (k) => {
    k.rbox(0.2, 0.25, 0.02, 0, 0.125, 0, M.furniture, -0.25, 0, 0);
    k.plane(0.16, 0.21, 0, 0.13, 0.03, M.photo.ellie, { rx: -0.25 });
  });
  const take = (id, label) => () => {
    W.props[id].visible = false;
    story.give(id, label);
    emit('item', id);
  };
  // small things get a generous invisible grab volume
  const grab = (g, w, h, d, dy = 0) => {
    const m = hitBox(0, h / 2 + dy, 0, w, h, d, g);
    return m;
  };
  items.doll = I.add({ id: 'doll', meshes: [grab(doll, 0.35, 0.35, 0.35), doll], prompt: "Take Ellie's doll", enabled: () => ch() === 'hunt' && doll.visible && !story.dead, onUse: take('doll', 'Mr. Buttons, her doll') });
  items.ribbon = I.add({ id: 'ribbon', meshes: [grab(ribbon, 0.3, 0.12, 0.3, -0.02), ribbon], prompt: "Take Ellie's ribbon", enabled: () => ch() === 'hunt' && ribbon.visible && !story.dead, onUse: take('ribbon', 'Her red hair ribbon') });
  items.picture = I.add({ id: 'picture', meshes: [grab(picture, 0.32, 0.34, 0.2), picture], prompt: "Take Ellie's picture", enabled: () => ch() === 'hunt' && picture.visible && !story.dead, onUse: take('picture', 'Her school picture') });
  items.lastNote = I.add({
    id: 'lastNote',
    meshes: [hitBox(0.2, 1.55, -8.88, 0.3, 0.35, 0.1)],
    prompt: 'Read the note',
    enabled: () => ch() === 'hunt',
    onUse: () => story.readNote('lastNote').then(() => emit('lastNote')),
  });

  // --- chapter V
  items.well = I.add({
    id: 'well',
    meshes: [hitBox(A.well.pos.x, A.well.pos.y + 0.6, A.well.pos.z, 1.7, 1.2, 1.7)],
    range: 2.6,
    prompt: () => (story.flags.gaveBack ? 'Say goodbye' : 'Give back her things'),
    enabled: () => ch() === 'well' && !story.flags.saidGoodbye && !story.flags.giving,
    onUse: () => emit('well'),
  });

  // --- after
  items.car = I.add({
    id: 'car',
    meshes: [hitBox(A.car.pos.x, A.car.pos.y + 0.9, A.car.pos.z, 2.0, 1.6, 4.6)],
    range: 2.8,
    prompt: 'Go home',
    enabled: () => ch() === 'after',
    onUse: () => emit('car'),
  });

  // spare keys for the story beats
  const bk = makeKey(M);
  bk.visible = false;
  W.root.add(bk);
  items.keyMesh = bk;
  return items;
}
