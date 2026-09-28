import * as THREE from 'three';

/**
 * Looks along the centre of the screen for something usable within reach.
 * Items: { id, meshes, prompt (string|fn), enabled (fn), onUse (fn), range, tag, locked (fn) }
 */
export class Interact {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.ray = new THREE.Raycaster();
    this.ray.far = 3;
    this.current = null;
    this.enabled = true;
    this._center = new THREE.Vector2(0, 0);
  }

  add(item) {
    const it = { range: 2.1, enabled: () => true, ...item };
    it.meshes = (it.meshes || []).filter(Boolean);
    for (const m of it.meshes) {
      m.traverse((o) => {
        o.userData.interact = it;
      });
    }
    this.items.push(it);
    return it;
  }

  remove(item) {
    this.items = this.items.filter((i) => i !== item);
  }

  byId(id) {
    return this.items.find((i) => i.id === id);
  }

  update() {
    const g = this.game;
    this.current = null;
    if (this.enabled) {
      const targets = [];
      for (const it of this.items) {
        if (!it.enabled()) continue;
        for (const m of it.meshes) if (m.visible !== false && isVisible(m)) targets.push(m);
      }
      if (targets.length) {
        this.ray.setFromCamera(this._center, g.camera);
        this.ray.far = 2.6;
        const hits = this.ray.intersectObjects(targets, true);
        for (const h of hits) {
          const it = h.object.userData.interact;
          if (!it || h.distance > it.range) continue;
          // blocked by a wall?
          const o = this.ray.ray.origin;
          const d = this.ray.ray.direction;
          const block = g.physics.raycast(o.x, o.y, o.z, d.x, d.y, d.z, h.distance);
          if (block.dist < h.distance - 0.12 && !(it.tag && block.hit && block.hit.tag === it.tag)) break;
          this.current = it;
          break;
        }
      }
    }
    const it = this.current;
    if (it) {
      const text = typeof it.prompt === 'function' ? it.prompt() : it.prompt;
      const locked = it.locked ? it.locked() : false;
      g.ui.setPrompt(text, locked);
    } else g.ui.setPrompt(null);
  }

  use() {
    const it = this.current;
    if (!it) return false;
    it.onUse(it);
    return true;
  }
}

function isVisible(o) {
  while (o) {
    if (o.visible === false) return false;
    o = o.parent;
  }
  return true;
}
