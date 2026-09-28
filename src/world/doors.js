import * as THREE from 'three';
import { boxGeom } from './builder.js';
import { clamp } from '../core/util.js';

/**
 * A hinged door. The panel is a live mesh under a pivot at the hinge; its
 * collider is a thick segment from hinge to tip that follows the swing, and
 * while (nearly) closed it also blocks line of sight.
 */
export class Door {
  /**
   * @param game
   * @param parent  Object3D to attach to
   * @param o { id, hinge: [x,y,z], baseAngle, width, height, thick, swing: ±1, mat, locked, lockedText, openAngle, kind }
   */
  constructor(game, parent, o) {
    this.game = game;
    this.id = o.id;
    this.kind = o.kind || 'door';
    this.width = o.width;
    this.height = o.height;
    this.thick = o.thick ?? 0.045;
    this.swing = o.swing ?? 1;
    this.baseAngle = o.baseAngle;
    this.openAngle = o.openAngle ?? 1.5;
    this.locked = !!o.locked;
    this.lockedText = o.lockedText || "It's locked.";
    this.angle = 0;
    this.target = 0;
    this.speed = 2.2;
    this.moving = false;
    this.onOpen = null;
    this.interactable = o.interactable !== false;
    this.useText = o.useText || null;

    this.pivot = new THREE.Group();
    this.pivot.position.set(o.hinge[0], o.hinge[1], o.hinge[2]);
    this.pivot.rotation.y = this.baseAngle;
    parent.add(this.pivot);

    const w = this.width;
    const h = this.height;
    const t = this.thick;
    const g = boxGeom(0.005, 0, -t / 2, w - 0.005, h, t / 2, 1);
    // stretch UVs over the whole panel so the door texture maps once
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / w, pos.getY(i) / h);
    }
    this.panel = new THREE.Mesh(g, o.mat);
    this.panel.castShadow = true;
    this.panel.receiveShadow = true;
    this.pivot.add(this.panel);
    if (o.knobMat) {
      for (const side of [-1, 1]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), o.knobMat);
        knob.position.set(w - 0.08, Math.min(1.0, h * 0.48), side * (t / 2 + 0.03));
        knob.castShadow = true;
        this.pivot.add(knob);
      }
    }
    this.meshes = [this.panel];
    this.panel.userData.door = this;

    const [x, y, z] = o.hinge;
    this.seg = game.physics.addSeg(x, z, x, z, y, y + h, t / 2 + 0.01, { occlude: true, tag: `door:${this.id}` });
    this._updateSeg();
  }

  get isOpen() {
    return this.target > 0.01;
  }

  get isClosed() {
    return this.angle < 0.02 && this.target === 0;
  }

  _updateSeg() {
    const a = this.pivot.rotation.y;
    const x = this.pivot.position.x;
    const z = this.pivot.position.z;
    this.seg.x1 = x;
    this.seg.z1 = z;
    this.seg.x2 = x + Math.cos(a) * this.width;
    this.seg.z2 = z - Math.sin(a) * this.width;
    this.seg.occlude = this.angle < 0.25;
  }

  /** mode: 'normal' | 'slow' | 'slam' | 'instant' */
  open(mode = 'normal', { silent = false } = {}) {
    if (this.target === this.openAngle && mode !== 'instant') return;
    this.target = this.openAngle;
    this._start(mode, silent, true);
  }

  close(mode = 'normal', { silent = false } = {}) {
    if (this.target === 0 && this.angle === 0) return;
    this.target = 0;
    this._start(mode, silent, false);
  }

  /** Set an arbitrary opening fraction (0..1). */
  setAjar(frac, mode = 'slow') {
    this.target = clamp(frac, 0, 1) * this.openAngle;
    this._start(mode, false, true);
  }

  _start(mode, silent, opening) {
    const a = this.game.audio;
    const p = this.pivot.getWorldPosition(new THREE.Vector3());
    p.y += 1.2;
    if (mode === 'instant') {
      this.angle = this.target;
      this._apply();
      return;
    }
    this.speed = mode === 'slow' ? 0.45 : mode === 'slam' ? 9 : 2.0;
    this.moving = true;
    this.slamming = mode === 'slam' && !opening;
    if (silent || !a) return;
    if (mode === 'slam') {
      if (opening) a.sfx('doorBang', { pos: p, vol: 0.9 });
    } else if (opening) a.sfx(mode === 'slow' ? 'creakLong' : 'creak', { pos: p, vol: mode === 'slow' ? 0.9 : 0.55 });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  _apply() {
    this.pivot.rotation.y = this.baseAngle + this.angle * this.swing;
    this._updateSeg();
  }

  update(dt) {
    if (!this.moving) return;
    const d = this.target - this.angle;
    const step = this.speed * dt * (0.35 + Math.min(1, Math.abs(d) * 1.4));
    if (Math.abs(d) <= step) {
      this.angle = this.target;
      this.moving = false;
      if (this.target === 0 && this.game.audio) {
        const p = this.pivot.getWorldPosition(new THREE.Vector3());
        p.y += 1.1;
        this.game.audio.sfx(this.slamming ? 'doorSlam' : 'doorShut', { pos: p, vol: this.slamming ? 1 : 0.5 });
        if (this.slamming) this.game.onSlam?.(p);
      }
    } else this.angle += Math.sign(d) * step;
    this._apply();
  }
}
