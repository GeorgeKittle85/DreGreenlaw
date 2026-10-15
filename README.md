# COME HOME

*A first-person psychological horror game that runs in your browser.*

> **1 new voicemail — received 3:13 AM — from: Mom**
> "Sammy? Please come home. Ellie's been asking for you. She says she's done hiding. She says it's your turn."
>
> Mom died nineteen days ago. Ellie died when I was twelve.

You drive back to 57 Hollow Creek Road, the house you were sent away from twenty years ago. Your mother left rules on the fridge. Follow them. **All** of them.

**Put on headphones. Turn off the lights.**

## Play

Open **`index.html`** in a recent Chrome, Edge, Firefox or Safari — on a desktop, or on a tablet such as an iPad. That's it — the whole game (engine, textures, sounds, fonts) is one self-contained file with no network access needed. Every texture is painted procedurally and every sound is synthesised at load time; there are no image or audio files.

### Keyboard and mouse

| Key | Action |
| --- | --- |
| W A S D | Walk |
| Mouse | Look |
| Shift | Run (you tire quickly) |
| E / Left click | Interact |
| F | Flashlight |
| J | Journal (the Rules, notes, current objective) |
| Esc | Pause / settings |

### Touch joysticks (iPad, tablets, phones)

Two on-screen sticks, played landscape:

| Control | Action |
| --- | --- |
| Left stick | Walk — a light push is a slow walk. Drag past the dashed outer ring to run (you tire quickly) |
| Right stick | Look |
| USE | Interact |
| LIGHT | Flashlight |
| JOURNAL | Journal (the Rules, notes, current objective) |
| PAUSE | Pause / settings |

The game picks touch controls by itself on devices whose main input is a finger. Either way you can switch at any time under **Settings → Controls** (from the title screen or the pause menu); the choice is remembered. Add the page to your iPad's Home Screen to hide the browser bars.

Settings include the control scheme, look sensitivity, volume, brightness, a retro-pixel toggle and three quality levels. Progress is saved per chapter (Continue on the title screen).

A first playthrough takes roughly 20–30 minutes. The test autopilot, which knows where everything is, finishes in about 8.

## What's in it

- **Five chapters and an epilogue**, each built around one of the Rules of the House: a rain-soaked arrival, a mirror that shows what's behind you, a voice calling from downstairs, a hallway that loops (and gets longer), a thing that can only move while you can't see it, and the well in the basement.
- **Her.** A procedurally built, rigged creature with a painted face, a morphing jaw, parted wet hair, mannequin poses that change every time she moves unseen, and nervous twitches.
- **Real mechanics behind the rules**: an A\* stalker that only moves when she's out of your view or your light (and eats your flashlight when she's close), a gaze meter for the smile, a follower that is always exactly behind you.
- **Procedural audio** through HRTF 3D sound: synthesised creaks, slams, whispers, screams, a winding-down music box, telephone bells, thunder, rain, heartbeat and breathing that follow your fear.
- **Horror post-processing**: low-res HDR rendering with film grain, dithering, chromatic aberration, VHS jitter, static, subliminal frames and flashlight shadows.

## Develop

```bash
npm install        # three + esbuild
npm run build      # bundles src/ into the single-file index.html
npm run watch      # rebuild on change
```

Source lives in `src/`: `engine/` (renderer, input, physics, textures), `world/` (the house, yard, loop, basement), `audio/` (synth + mixer), `game/` (player, creature, story, chapters), `ui/` (menus and HUD; `touch.js` is the on-screen joystick layer, which writes into `Input.touch`).

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main`, or on demand from the **Actions** tab. Pull requests only run the build, so a broken build is caught before it merges. The site is built from `src/` in CI, so the deployed game never depends on the committed `index.html` being up to date.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. After the first run the game lives at `https://<owner>.github.io/<repo>/` (the finished URL is also shown on the workflow run). Opening that link on an iPad is the easiest way to play it with the touch controls.

### Automated playthrough

`tests/playthrough.mjs` plays the entire game headlessly: an autopilot walks the real player controller through every route, aims at every object and presses E — including dying once in chapter IV and deliberately breaking Rules 3 and 4 before obeying them — and writes screenshots to `test-output/`.

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm test
```

Append `?chapter=hunt` (or `arrival`, `rules`, `hallway`, `well`, `after`) to the URL to jump to a chapter while developing.

---

Fonts: IM Fell English, Caveat (SIL OFL 1.1); Special Elite, Schoolbell (Apache 2.0) — licences in `src/assets/fonts/licenses/`. Engine: [three.js](https://threejs.org) (MIT).
