import * as THREE from 'three';

/**
 * Renders the scene into a small HDR target, then runs one full-screen "horror"
 * pass: ACES tone mapping, grade, chromatic aberration, VHS jitter, static,
 * grain, vignette, flashes, subliminal face frames and ordered dithering.
 * The canvas itself is kept at the low internal resolution and scaled up by an
 * integer factor with CSS, which is both the look and the performance budget.
 */
const QUALITY = {
  low: { height: 300, samples: 0, shadow: 512 },
  medium: { height: 420, samples: 2, shadow: 1024 },
  high: { height: 600, samples: 4, shadow: 1024 },
};

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tFace;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uBrightness;
uniform float uGrain;
uniform float uVignette;
uniform float uAberration;
uniform float uDistort;
uniform float uStatic;
uniform float uFlash;
uniform float uRed;
uniform float uBlackout;
uniform float uDesat;
uniform float uFace;
uniform float uFaceZoom;
uniform float uPulse;
uniform vec3 uTint;
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  // 4x4 Bayer matrix, row-major
  float b = 0.0;
  if (i < 0.5) b = 0.0; else if (i < 1.5) b = 8.0; else if (i < 2.5) b = 2.0; else if (i < 3.5) b = 10.0;
  else if (i < 4.5) b = 12.0; else if (i < 5.5) b = 4.0; else if (i < 6.5) b = 14.0; else if (i < 7.5) b = 6.0;
  else if (i < 8.5) b = 3.0; else if (i < 9.5) b = 11.0; else if (i < 10.5) b = 1.0; else if (i < 11.5) b = 9.0;
  else if (i < 12.5) b = 15.0; else if (i < 13.5) b = 7.0; else if (i < 14.5) b = 13.0; else b = 5.0;
  return (b + 0.5) / 16.0;
}

void main() {
  vec2 uv = vUv;

  // VHS tracking jitter + wobble
  if (uDistort > 0.001) {
    float row = floor(uv.y * uResolution.y / 2.0);
    float n = hash12(vec2(row, floor(uTime * 30.0)));
    uv.x += (n - 0.5) * 0.06 * uDistort * step(0.72, n);
    uv.x += sin(uv.y * 30.0 + uTime * 12.0) * 0.003 * uDistort;
    uv.y += (hash12(vec2(floor(uTime * 20.0), 3.0)) - 0.5) * 0.01 * uDistort * step(0.9, hash12(vec2(floor(uTime * 9.0), 7.0)));
  }

  vec2 dc = uv - 0.5;
  float r2 = dot(dc, dc);
  float ca = uAberration * 0.018 * (0.25 + r2 * 3.5);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dc * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dc * ca).b;

  col *= uExposure;
  col = aces(col);

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l), uDesat);
  col *= uTint;

  // to display gamma, then the user's brightness lift (mostly lifts shadows)
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col = pow(col, vec3(1.0 - uBrightness * 0.45)) + uBrightness * 0.012;

  // subliminal face frame: sampled here, composited last (over the blackout, so it can come out of the dark)
  vec3 faceCol = vec3(0.0);
  float faceMask = 0.0;
  if (uFace > 0.001) {
    vec2 fuv = dc * vec2(uResolution.x / uResolution.y, 1.0) / uFaceZoom;
    fuv += vec2(hash12(vec2(uTime, 1.0)) - 0.5, hash12(vec2(uTime, 2.0)) - 0.5) * 0.02 * uFace;
    fuv += 0.5;
    vec4 f = texture2D(tFace, fuv);
    float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
    // a soft oval, so the painting's square border never shows
    float soft = smoothstep(1.0, 0.7, length((fuv - 0.5) / vec2(0.5, 0.52)));
    faceMask = f.a * uFace * inside * soft;
    faceCol = pow(f.rgb, vec3(1.0 / 2.2)); // the sRGB texture samples as linear; we're past the display transform

  }

  // vignette (tightens with fear pulses)
  float vd = length(dc * vec2(1.0, 0.82));
  float vig = smoothstep(0.78 - uVignette * 0.28 - uPulse * 0.08, 0.12, vd);
  col *= mix(1.0, vig, 0.9);

  // static / snow
  float sn = hash12(gl_FragCoord.xy + fract(uTime * 13.7) * 1000.0);
  col = mix(col, vec3(sn * 0.85), uStatic);

  // film grain
  float g = hash12(gl_FragCoord.xy * 1.37 + fract(uTime * 7.31) * 517.0) - 0.5;
  col += g * uGrain * (0.6 + 0.4 * (1.0 - l));

  col = mix(col, vec3(0.62, 0.02, 0.02) * (0.35 + l * 1.4), uRed);
  col += vec3(uFlash);
  col *= 1.0 - uBlackout;

  // the face, with a little of the frame's static, grain and blood so it belongs to it
  if (uFace > 0.001) {
    float fl = dot(faceCol, vec3(0.2126, 0.7152, 0.0722));
    faceCol = mix(faceCol, vec3(sn * 0.85), uStatic * 0.4);
    faceCol += g * uGrain;
    faceCol = mix(faceCol, vec3(0.62, 0.02, 0.02) * (0.35 + fl * 1.4), uRed * 0.6);
    faceCol *= mix(1.0, vig, 0.5);
    col = mix(col * (1.0 - 0.8 * uFace), faceCol, faceMask);
  }

  col += (bayer4(gl_FragCoord.xy) - 0.5) / 96.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.info.autoReset = true;

    this.quality = 'medium';
    this.retro = true;
    this.width = 2;
    this.height = 2;
    this.scale = 1;

    this.rt = this._makeTarget(2, 2, QUALITY.medium.samples);

    this.uniforms = {
      tDiffuse: { value: this.rt.texture },
      tFace: { value: null },
      uResolution: { value: new THREE.Vector2(2, 2) },
      uTime: { value: 0 },
      uExposure: { value: 1.0 },
      uBrightness: { value: 0.35 },
      uGrain: { value: 0.07 },
      uVignette: { value: 0.3 },
      uAberration: { value: 0.15 },
      uDistort: { value: 0 },
      uStatic: { value: 0 },
      uFlash: { value: 0 },
      uRed: { value: 0 },
      uBlackout: { value: 0 },
      uDesat: { value: 0.25 },
      uFace: { value: 0 },
      uFaceZoom: { value: 1 },
      uPulse: { value: 0 },
      uTint: { value: new THREE.Color(0.96, 1.0, 0.98) },
    };
    this.post = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const quad = new THREE.Mesh(tri, this.post);
    quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  _makeTarget(w, h, samples) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples,
      depthBuffer: true,
      stencilBuffer: false,
    });
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    return rt;
  }

  setQuality(q) {
    if (!QUALITY[q]) q = 'medium';
    const changed = q !== this.quality;
    this.quality = q;
    if (changed) {
      this.rt.dispose();
      this.rt = this._makeTarget(this.width, this.height, QUALITY[q].samples);
      this.uniforms.tDiffuse.value = this.rt.texture;
    }
    this.resize();
  }

  get shadowSize() {
    return QUALITY[this.quality].shadow;
  }

  setRetro(on) {
    this.retro = on;
    this.canvas.classList.toggle('retro', on);
    this.resize();
  }

  /** Size the canvas to the window at a low internal resolution with integer upscaling. */
  resize(camera) {
    const W = Math.max(1, window.innerWidth);
    const H = Math.max(1, window.innerHeight);
    const target = QUALITY[this.quality].height * (this.retro ? 1 : 1.5);
    const scale = Math.max(1, Math.round(H / target));
    const w = Math.ceil(W / scale);
    const h = Math.ceil(H / scale);
    this.scale = scale;
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.gl.setSize(w, h, false);
      this.rt.setSize(w, h);
      this.uniforms.uResolution.value.set(w, h);
    }
    this.canvas.style.width = `${w * scale}px`;
    this.canvas.style.height = `${h * scale}px`;
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    this._camera = camera || this._camera;
  }

  render(scene, camera, time) {
    this.uniforms.uTime.value = time;
    this.gl.setRenderTarget(this.rt);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCam);
  }
}
