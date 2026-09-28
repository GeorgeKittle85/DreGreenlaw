const $ = (sel) => document.querySelector(sel);

/** All DOM overlays. Timed things (subtitles, objective fade) advance with game time via update(dt). */
export class UI {
  constructor() {
    this.app = $('#app');
    this.hudEl = $('#hud');
    this.promptEl = $('#prompt');
    this.promptLabel = $('#prompt .label');
    this.crossEl = $('#crosshair');
    this.objEl = $('#objective');
    this.objText = $('#objective .obj-text');
    this.subsEl = $('#subtitles');
    this.toastEl = $('#toast');
    this.hintEl = $('#hint');
    this.staminaEl = $('#stamina');
    this.staminaFill = $('#stamina .fill');
    this.cardEl = $('#chapter-card');
    this.cineEl = $('#cinematic');
    this.noteEl = $('#note');
    this.journalEl = $('#journal');
    this.pauseEl = $('#pause');
    this.settingsEl = $('#settings');
    this.controlsEl = $('#controls');
    this.titleEl = $('#title');
    this.gateEl = $('#gate');
    this.deathEl = $('#death');
    this.creditsEl = $('#credits');
    this.errorEl = $('#error');
    this.subs = [];
    this.objTimer = 0;
    this.toastTimer = 0;
    this.hintTimer = 0;
    this.objective = '';
    this.noteResolve = null;
    this.onAction = () => {};
    this.menuReturn = null;

    for (const el of document.querySelectorAll('[data-act]')) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAction(el.dataset.act, el.closest('.overlay')?.id || '');
      });
    }
    this.noteEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.closeNote();
    });
  }

  // ------------------------------------------------------------ gate / loading
  gateProgress(frac, text) {
    $('.gate-fill').style.width = `${Math.round(frac * 100)}%`;
    if (text) $('.gate-status').textContent = text;
  }

  gateReady(onGo) {
    $('.gate-status').textContent = '';
    $('.gate-go').classList.remove('hidden');
    const go = (e) => {
      e?.preventDefault?.();
      this.gateEl.removeEventListener('click', go);
      window.removeEventListener('keydown', go);
      this.gateEl.classList.add('hidden');
      onGo();
    };
    this.gateEl.addEventListener('click', go);
    window.addEventListener('keydown', go);
  }

  error(html) {
    this.errorEl.querySelector('.err-inner').innerHTML = html;
    this.errorEl.classList.remove('hidden');
  }

  // ------------------------------------------------------------ HUD
  hud(show) {
    this.hudEl.classList.toggle('hidden', !show);
  }

  setPrompt(text, locked = false) {
    if (!text) {
      this.promptEl.classList.remove('show');
      this.crossEl.classList.remove('active');
      return;
    }
    if (this.promptLabel.textContent !== text) this.promptLabel.textContent = text;
    this.promptEl.classList.add('show');
    this.promptEl.classList.toggle('locked', locked);
    this.crossEl.classList.add('active');
  }

  setObjective(text, show = true) {
    this.objective = text || '';
    this.objText.textContent = this.objective;
    if (show && text) {
      this.objEl.classList.add('show');
      this.objTimer = 9;
    } else if (!text) this.objEl.classList.remove('show');
  }

  flashObjective() {
    if (!this.objective) return;
    this.objEl.classList.add('show');
    this.objTimer = 5;
  }

  toast(text, dur = 3.5) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = dur;
  }

  hint(text, dur = 6) {
    this.hintEl.textContent = text;
    this.hintEl.classList.add('show');
    this.hintTimer = dur;
  }

  stamina(v, show) {
    this.staminaEl.classList.toggle('show', show);
    this.staminaFill.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`;
  }

  /**
   * Show a subtitle line. o: { cls: 'inner'|'mom'|'her'|'whisper'|'radio'|'child'|'system', speaker, dur }
   */
  say(text, o = {}) {
    const line = document.createElement('div');
    line.className = `line ${o.cls || ''}`;
    if (o.speaker) {
      const s = document.createElement('span');
      s.className = 'speaker';
      s.textContent = o.speaker;
      line.appendChild(s);
    }
    line.appendChild(document.createTextNode(text));
    this.subsEl.appendChild(line);
    requestAnimationFrame(() => line.classList.add('show'));
    const dur = o.dur ?? Math.max(2.4, 1.2 + text.length * 0.055);
    const entry = { el: line, t: dur };
    this.subs.push(entry);
    while (this.subs.length > 3) this._dropSub(this.subs[0]);
    return dur;
  }

  _dropSub(entry) {
    this.subs = this.subs.filter((s) => s !== entry);
    entry.el.classList.remove('show');
    setTimeout(() => entry.el.remove(), 400);
  }

  clearSubs() {
    for (const s of [...this.subs]) this._dropSub(s);
  }

  update(dt) {
    for (const s of [...this.subs]) {
      s.t -= dt;
      if (s.t <= 0) this._dropSub(s);
    }
    if (this.objTimer > 0) {
      this.objTimer -= dt;
      if (this.objTimer <= 0) this.objEl.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hintEl.classList.remove('show');
    }
  }

  // ------------------------------------------------------------ notes
  showNote(note) {
    const paper = this.noteEl.querySelector('.paper');
    paper.className = `paper ${note.style || ''}`;
    this.noteEl.querySelector('.note-title').innerHTML = note.title || '';
    const img = this.noteEl.querySelector('.note-img');
    img.innerHTML = '';
    if (note.image) {
      const im = document.createElement('img');
      im.src = note.image.toDataURL();
      im.alt = note.alt || '';
      img.appendChild(im);
    }
    this.noteEl.querySelector('.note-body').innerHTML = note.body || '';
    paper.scrollTop = 0;
    this.noteEl.classList.remove('hidden');
    return new Promise((res) => {
      this.noteResolve = res;
    });
  }

  get noteOpen() {
    return !this.noteEl.classList.contains('hidden');
  }

  closeNote() {
    if (!this.noteOpen) return;
    this.noteEl.classList.add('hidden');
    const r = this.noteResolve;
    this.noteResolve = null;
    r?.();
  }

  // ------------------------------------------------------------ journal
  openJournal(objective, notes, onRead) {
    $('#j-objective').textContent = objective || '—';
    const ul = $('#j-notes');
    ul.innerHTML = '';
    if (!notes.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nothing yet.';
      ul.appendChild(li);
    }
    for (const n of notes) {
      const li = document.createElement('li');
      li.textContent = n.journal || n.title;
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        onRead(n);
      });
      ul.appendChild(li);
    }
    this.journalEl.classList.remove('hidden');
  }

  get journalOpen() {
    return !this.journalEl.classList.contains('hidden');
  }

  closeJournal() {
    this.journalEl.classList.add('hidden');
  }

  // ------------------------------------------------------------ menus
  show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  openSub(which, from) {
    this.menuReturn = from;
    this.show(this.pauseEl, false);
    this.show(this.titleEl, false);
    this.show(which === 'settings' ? this.settingsEl : this.controlsEl, true);
  }

  closeSub() {
    this.show(this.settingsEl, false);
    this.show(this.controlsEl, false);
    if (this.menuReturn === 'title') this.show(this.titleEl, true);
    else if (this.menuReturn === 'pause') this.show(this.pauseEl, true);
    const r = this.menuReturn;
    this.menuReturn = null;
    return r;
  }

  bindSettings(settings, onChange) {
    const bind = (id, key, parse = parseFloat) => {
      const el = document.getElementById(id);
      if (el.type === 'checkbox') el.checked = !!settings[key];
      else el.value = settings[key];
      el.addEventListener('input', () => {
        settings[key] = el.type === 'checkbox' ? el.checked : parse(el.value);
        onChange(key);
      });
      el.addEventListener('change', () => {
        settings[key] = el.type === 'checkbox' ? el.checked : parse(el.value);
        onChange(key);
      });
    };
    bind('set-sens', 'sensitivity');
    bind('set-vol', 'volume');
    bind('set-bright', 'brightness');
    bind('set-invert', 'invertY');
    bind('set-retro', 'retro');
    bind('set-quality', 'quality', (v) => v);
  }

  // ------------------------------------------------------------ big text
  chapterCard(num, name, hold = 3.2) {
    this.cardEl.querySelector('.num').textContent = num;
    this.cardEl.querySelector('.name').textContent = name;
    this.cardEl.classList.add('show');
    clearTimeout(this._cardT);
    this._cardT = setTimeout(() => this.cardEl.classList.remove('show'), hold * 1000);
  }

  cineLine(text, cls = '') {
    const el = document.createElement('div');
    el.className = `cl ${cls}`;
    el.textContent = text;
    this.cineEl.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    return el;
  }

  cineClear(fade = true) {
    for (const el of [...this.cineEl.children]) {
      if (fade) {
        el.classList.add('fade');
        setTimeout(() => el.remove(), 1900);
      } else el.remove();
    }
  }

  death(msg, sub) {
    this.deathEl.querySelector('.msg').textContent = msg;
    this.deathEl.querySelector('.sub').textContent = sub || '';
    this.deathEl.classList.remove('hidden');
    requestAnimationFrame(() => this.deathEl.classList.add('show'));
  }

  hideDeath() {
    this.deathEl.classList.remove('show');
    setTimeout(() => this.deathEl.classList.add('hidden'), 1500);
  }

  credits(items, onDone) {
    const inner = this.creditsEl.querySelector('.credits-inner');
    inner.innerHTML = '';
    this.creditsEl.classList.remove('hidden');
    const els = items.map(([text, cls]) => {
      const el = document.createElement(cls === 'button' ? 'button' : 'div');
      el.className = `c ${cls}`;
      el.textContent = text;
      inner.appendChild(el);
      return el;
    });
    els.forEach((el, i) => setTimeout(() => el.classList.add('show'), 600 + i * 1400));
    const btn = inner.querySelector('button');
    if (btn) {
      btn.parentElement.classList.add('menu');
      btn.addEventListener('click', () => {
        this.creditsEl.classList.add('hidden');
        onDone?.();
      });
    }
  }
}
