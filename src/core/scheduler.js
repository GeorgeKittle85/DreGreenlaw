/**
 * Game-time scheduler for story scripts. Everything waits on *game* time, so
 * pausing the game (or reading a note) freezes every scripted sequence.
 * cancelAll() rejects every pending wait with Cancelled, which is how a
 * chapter restart (after dying, for instance) tears down a running script.
 */
export class Cancelled extends Error {
  constructor() {
    super('cancelled');
    this.cancelled = true;
  }
}

export const ignoreCancel = (e) => {
  if (!e || !e.cancelled) throw e;
};

export class Scheduler {
  constructor() {
    this.time = 0;
    this.tasks = [];
    this.gen = 0;
  }

  update(dt) {
    this.time += dt;
    if (!this.tasks.length) return;
    const due = [];
    const keep = [];
    for (const t of this.tasks) {
      if (t.gen !== this.gen) continue;
      let done = false;
      if (t.at !== undefined && this.time >= t.at) done = true;
      else if (t.pred) {
        let ok = false;
        try {
          ok = t.pred();
        } catch (e) {
          console.error(e);
        }
        if (ok) done = true;
        else if (t.timeoutAt !== undefined && this.time >= t.timeoutAt) {
          t.timedOut = true;
          done = true;
        }
      }
      (done ? due : keep).push(t);
    }
    this.tasks = keep;
    for (const t of due) t.resolve(!t.timedOut);
  }

  /** Resolve after `sec` seconds of game time. */
  wait(sec) {
    return this._add({ at: this.time + Math.max(0, sec) });
  }

  /** Resolve (true) once pred() is truthy, or (false) after `timeout` seconds. */
  until(pred, timeout) {
    return this._add({ pred, timeoutAt: timeout !== undefined ? this.time + timeout : undefined });
  }

  _add(t) {
    t.gen = this.gen;
    return new Promise((resolve, reject) => {
      t.resolve = resolve;
      t.reject = reject;
      this.tasks.push(t);
    });
  }

  cancelAll() {
    const old = this.tasks;
    this.tasks = [];
    this.gen++;
    for (const t of old) t.reject(new Cancelled());
  }
}

/**
 * A cancellable script run. Every await goes through check() on both sides, so a
 * script whose wait resolved in the same frame it was killed can never leak
 * into the next chapter run.
 */
export class Script {
  constructor(sched) {
    this.sched = sched;
    this.alive = true;
  }
  check() {
    if (!this.alive) throw new Cancelled();
  }
  async wait(sec) {
    this.check();
    await this.sched.wait(sec);
    this.check();
  }
  async until(pred, timeout) {
    this.check();
    const ok = await this.sched.until(() => !this.alive || pred(), timeout);
    this.check();
    return ok;
  }
  /** Run a detached sub-sequence that dies with this script. */
  spawn(fn) {
    Promise.resolve()
      .then(() => fn(this))
      .catch(ignoreCancel)
      .catch((e) => console.error(e));
  }
  kill() {
    this.alive = false;
  }
}
