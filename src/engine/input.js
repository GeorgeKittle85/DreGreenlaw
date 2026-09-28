/**
 * Keyboard + mouse. Uses pointer lock when it can; when it can't (embedded
 * frames, some browsers) it falls back to drag-to-look and arrow-key turning.
 */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyJ', 'Tab', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mdx = 0;
    this.mdy = 0;
    this.locked = false;
    this.fallback = false;
    this.dragging = false;
    this.wantLock = false;
    this.clicked = false;
    this.listeners = { lockchange: [] };
    // Autopilot / tests can drive input through this object.
    this.virtual = null;

    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code) && this.wantLock) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragging = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked || (this.fallback && this.dragging)) {
        let dx = e.movementX || 0;
        let dy = e.movementY || 0;
        // Some browsers spike on (re)lock; drop absurd deltas.
        if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
        this.mdx += dx;
        this.mdy += dy;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.wantLock) return;
      if (this.locked) {
        if (e.button === 0) this.clicked = true;
        return;
      }
      if (this.fallback) {
        // no pointer lock available: drag to look, E to interact
        this.dragging = true;
        return;
      }
      this.requestLock();
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was !== this.locked) for (const fn of this.listeners.lockchange) fn(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.fallback) return;
      this.fallback = true;
      this.onFallback?.();
    });
  }

  on(evt, fn) {
    this.listeners[evt].push(fn);
  }

  requestLock() {
    if (this.fallback || this.locked) return;
    const fail = () => {
      if (this.fallback) return;
      this.fallback = true;
      this.onFallback?.();
    };
    try {
      if (!this.canvas.requestPointerLock) return fail();
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(fail);
    } catch (e) {
      fail();
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) {
    return this.keys.has(code);
  }

  hit(code) {
    return this.pressed.has(code);
  }

  /** Movement intent in [-1,1]: x = strafe right, y = forward. */
  moveAxis() {
    if (this.virtual) return { x: this.virtual.x || 0, y: this.virtual.y || 0 };
    let x = 0;
    let y = 0;
    if (this.down('KeyW') || (!this.fallback && this.down('ArrowUp'))) y += 1;
    if (this.down('KeyS') || (!this.fallback && this.down('ArrowDown'))) y -= 1;
    if (this.down('KeyD')) x += 1;
    if (this.down('KeyA')) x -= 1;
    if (this.fallback) {
      if (this.down('ArrowUp')) y += 1;
      if (this.down('ArrowDown')) y -= 1;
    }
    return { x, y };
  }

  /** Keyboard turning, always available (arrow keys), essential for the fallback mode. */
  turnAxis() {
    if (this.virtual) return 0;
    let t = 0;
    if (this.down('ArrowLeft')) t -= 1;
    if (this.down('ArrowRight')) t += 1;
    return t;
  }

  sprinting() {
    if (this.virtual) return !!this.virtual.sprint;
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  interactPressed() {
    return this.hit('KeyE') || this.clicked;
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.mdx = 0;
    this.mdy = 0;
  }
}
