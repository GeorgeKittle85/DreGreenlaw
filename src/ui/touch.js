/**
 * On-screen controls for devices without a keyboard and mouse (iPad, phones).
 *
 *   left stick   walk; drag past the dashed outer ring to run
 *   right stick  look (a rate stick: hold it and the view keeps turning)
 *   USE / LIGHT  tap = E / F
 *   JOURNAL / PAUSE are plain [data-act] buttons handled by the story, like the menus
 *
 * Every finger is tracked by its own pointerId, so both thumbs work at once.
 * Pointer events also fire for a mouse, so the layout can be tried on a desktop.
 */
const DEAD_MOVE = 0.14; // stick travel ignored around the centre (fractions of the base radius)
const DEAD_LOOK = 0.1;
const RUN_ON = 1.5; // the outer ring sits 1.5 base radii from the centre; cross it and it's yards-after-catch mode
const RUN_OFF = 1.3; // ...and running only lets go once you come well back inside it

/** 0..1 stick strength once the dead zone is removed. The base edge is full strength. */
function strength(f, dead) {
  return Math.max(0, (Math.min(f, 1) - dead) / (1 - dead));
}

/** One virtual joystick. Reports (unit direction on screen, distance in base radii); 0,0,0 on release. */
class Stick {
  constructor(el, onChange) {
    this.el = el;
    this.base = el.querySelector('.base');
    this.knob = el.querySelector('.knob');
    this.onChange = onChange;
    this.id = null;
    this.cx = 0;
    this.cy = 0;
    this.r = 1;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      el.addEventListener(type, (e) => {
        if (e.pointerId === this.id) this.release();
      });
    }
  }

  down(e) {
    if (this.id !== null) return;
    e.preventDefault();
    // measure now, not at startup: the layout changes with the screen size and orientation
    const b = this.base.getBoundingClientRect();
    this.cx = b.left + b.width / 2;
    this.cy = b.top + b.height / 2;
    this.r = Math.max(1, b.width / 2);
    this.id = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* a pointer that already went away */
    }
    this.el.classList.add('held');
    this.move(e);
  }

  move(e) {
    if (e.pointerId !== this.id) return;
    const dx = e.clientX - this.cx;
    const dy = e.clientY - this.cy;
    const dist = Math.hypot(dx, dy);
    const k = dist > this.r ? this.r / dist : 1; // the knob stops at the rim; the finger may go on
    this.knob.style.transform = `translate3d(${dx * k}px, ${dy * k}px, 0)`;
    if (dist < 1e-3) this.onChange(0, 0, 0);
    else this.onChange(dx / dist, dy / dist, dist / this.r);
  }

  release() {
    if (this.id !== null) {
      try {
        this.el.releasePointerCapture(this.id);
      } catch (err) {
        /* already released */
      }
    }
    this.id = null;
    this.knob.style.transform = '';
    this.el.classList.remove('held', 'run');
    this.onChange(0, 0, 0);
  }
}

export class TouchControls {
  constructor(root) {
    this.root = root;
    this.input = null;
    this.active = false;

    this.moveStick = new Stick(root.querySelector('#stick-move'), (nx, ny, f) => {
      const t = this.input?.touch;
      if (!t) return;
      const m = strength(f, DEAD_MOVE);
      t.moveX = nx * m;
      t.moveY = -ny * m; // up on the screen is forward
      // sprint has a little hysteresis so it doesn't flutter while the thumb rides the ring
      t.sprint = t.sprint ? f > RUN_OFF : f >= RUN_ON;
      this.moveStick.el.classList.toggle('run', t.sprint);
    });
    this.lookStick = new Stick(root.querySelector('#stick-look'), (nx, ny, f) => {
      const t = this.input?.touch;
      if (!t) return;
      // eased, so small nudges aim finely and the rim still whips around when something is behind you
      const m = Math.pow(strength(f, DEAD_LOOK), 1.5);
      t.lookX = nx * m;
      t.lookY = ny * m;
    });

    this.buttons = [];
    for (const [id, code] of [['tb-use', 'KeyE'], ['tb-light', 'KeyF']]) {
      const b = root.querySelector(`#${id}`);
      this.buttons.push(b);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); // also stops the compatibility mouse events a finger would send afterwards
        b.classList.add('down');
        this.input?.tap(code);
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
        b.addEventListener(type, () => b.classList.remove('down'));
      }
    }
    // taps must not leave a button focused, or a hardware Space/Enter would press it again
    for (const b of root.querySelectorAll('button')) b.addEventListener('click', () => b.blur());

    root.addEventListener('contextmenu', (e) => e.preventDefault()); // no long-press menu
    window.addEventListener('blur', () => this.release());
    // iOS Safari still pinch-zooms in places touch-action doesn't reach (touch mode only: leave desktop Safari alone)
    document.addEventListener('gesturestart', (e) => {
      if (this.input?.touchMode) e.preventDefault();
    });
  }

  bind(input) {
    this.input = input;
  }

  /** Show the controls while the game is running; hide them (and let go of everything) otherwise. */
  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    this.root.classList.toggle('hidden', !on);
    if (!on) this.release();
  }

  release() {
    this.moveStick.release();
    this.lookStick.release();
    for (const b of this.buttons) b.classList.remove('down');
    this.input?.releaseTouch();
  }
}
