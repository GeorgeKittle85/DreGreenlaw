/**
 * Keyboard + mouse, or on-screen joysticks. With a mouse it uses pointer lock
 * when it can; when it can't (embedded frames, some browsers) it falls back to
 * drag-to-look and arrow-key turning. In touch mode (tablets) there is no
 * pointer at all: ui/touch.js writes the two sticks into `touch` and taps the
 * action buttons through `tap()`.
 */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyJ', 'Tab', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ',
]);

/** True on devices whose main input is a finger (iPad, phones), not a mouse. */
export function prefersTouch() {
  try {
    const mm = (q) => !!window.matchMedia?.(q).matches;
    if (mm('(pointer: coarse)') && !mm('(pointer: fine)')) return true;
    // iPadOS Safari reports itself as a Mac when "Request Desktop Website" is on
    return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  } catch (e) {
    return false;
  }
}

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
    // On-screen joysticks. move: x = strafe right, y = forward. look: x = right, y = down. All in [-1,1].
    this.touchMode = false;
    this.touch = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, sprint: false };

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
      // touch taps arrive here as emulated mouse events; they must never grab the pointer
      if (!this.wantLock || this.touchMode) return;
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

  /** Switch between keyboard + mouse (false) and on-screen joysticks (true). */
  setTouchMode(on) {
    on = !!on;
    if (on === this.touchMode) return;
    this.touchMode = on;
    this.releaseTouch();
    if (on) {
      this.exitLock();
      this.keys.clear();
      this.dragging = false;
    }
  }

  /** Let go of both sticks (a finger lifted, a menu opened, the window lost focus). */
  releaseTouch() {
    const t = this.touch;
    t.moveX = t.moveY = t.lookX = t.lookY = 0;
    t.sprint = false;
  }

  /** Press a key from an on-screen button, exactly as if it had been typed. */
  tap(code) {
    this.pressed.add(code);
  }

  requestLock() {
    if (this.touchMode || this.fallback || this.locked) return;
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
    // the stick is analogue: a light push walks slowly, and it wins over a held key
    if (this.touch.moveX || this.touch.moveY) return { x: this.touch.moveX, y: this.touch.moveY };
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

  /** Right-stick look rate in [-1,1] (x = right, y = down); zero when no stick is held. */
  lookAxis() {
    if (this.virtual) return { x: 0, y: 0 };
    return { x: this.touch.lookX, y: this.touch.lookY };
  }

  sprinting() {
    if (this.virtual) return !!this.virtual.sprint;
    return this.down('ShiftLeft') || this.down('ShiftRight') || this.touch.sprint;
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
