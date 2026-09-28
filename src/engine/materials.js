import * as THREE from 'three';
import * as T from './textures.js';
import { toTex } from './textures.js';
import { gownTexture, skinTexture, hairTexture, paintFace } from './faces.js';

/**
 * Every material in the game, created once. `userData.texScale` is the size in
 * metres that one texture repeat covers; the level builder generates world-space
 * UVs from it so walls and floors tile at a consistent density.
 */
export function createMaterials(onStep = () => {}) {
  const M = {};
  const std = (canvas, { scale = 1, rough = 0.9, metal = 0, bump = 0, color = 0xffffff, emissive = 0x000000, side } = {}) => {
    const m = new THREE.MeshStandardMaterial({
      map: canvas ? toTex(canvas) : null,
      roughness: rough,
      metalness: metal,
      color,
      emissive,
    });
    if (canvas && bump) {
      m.bumpMap = toTex(canvas, { srgb: false });
      m.bumpScale = bump;
    }
    if (side !== undefined) m.side = side;
    m.userData.texScale = scale;
    return m;
  };
  const flat = (color, rough = 0.85, metal = 0, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    m.userData.texScale = 1;
    return m;
  };

  // walls
  M.wallHall = std(T.wallpaper({ style: 'damask', base: '#5c6149', motif: 'rgba(32,36,22,0.5)', seed: 1 }), { scale: 0.8, bump: 1.2 });
  M.wallLiving = std(T.wallpaper({ style: 'stripes', base: '#5a2b2c', motif: 'rgba(28,10,12,0.45)', accent: 'rgba(170,130,80,0.2)', seed: 3 }), { scale: 0.9, bump: 1.0 });
  M.wallDining = std(T.wallpaper({ style: 'damask', base: '#3d4a3e', motif: 'rgba(18,26,18,0.55)', accent: 'rgba(160,150,110,0.14)', seed: 4 }), { scale: 0.8, bump: 1.2 });
  M.wallEllie = std(T.wallpaper({ style: 'floral', base: '#b48f8c', motif: 'rgba(150,60,80,0.55)', accent: 'rgba(255,255,255,0.1)', seed: 2, age: 1.4 }), { scale: 0.7, bump: 0.8 });
  M.wallMom = std(T.wallpaper({ style: 'floral', base: '#6c7584', motif: 'rgba(40,46,70,0.5)', accent: 'rgba(255,255,255,0.06)', seed: 5 }), { scale: 0.7, bump: 0.8 });
  M.wallSam = std(T.plaster({ base: [104, 124, 140], stains: 5, cracks: 4, seed: 6 }), { scale: 2.2, bump: 1.0 });
  M.plaster = std(T.plaster({ base: [150, 144, 128], seed: 7, stains: 1, cracks: 5 }), { scale: 2.0, bump: 1.0 });
  M.ceiling = std(T.plaster({ base: [128, 124, 114], stains: 5, cracks: 4, seed: 8 }), { scale: 2.4, bump: 1.0 });
  M.wainscot = std(T.wainscot({}), { scale: 1.0, bump: 1.5, rough: 0.7 });
  M.tile = std(T.tiles({}), { scale: 1.2, bump: 1.5, rough: 0.35 });
  M.tileFloor = std(T.tiles({ count: 6, base: [150, 150, 140], seed: 14 }), { scale: 1.0, bump: 1.5, rough: 0.4 });
  M.lino = std(T.linoleum({}), { scale: 1.2, bump: 0.6, rough: 0.6 });
  M.stone = std(T.stone({}), { scale: 2.2, bump: 3.0, rough: 0.95 });
  M.concrete = std(T.ground({ kind: 'concrete', seed: 33 }), { scale: 3.0, bump: 1.5, rough: 0.95 });
  onStep();

  // floors & exterior
  M.wood = std(T.woodFloor({}), { scale: 1.6, bump: 1.2, rough: 0.62 });
  M.woodDark = std(T.woodFloor({ color: [62, 42, 28], seed: 9 }), { scale: 1.6, bump: 1.2, rough: 0.7 });
  M.furniture = std(T.woodFloor({ color: [70, 46, 30], planks: 4, seed: 10 }), { scale: 1.0, rough: 0.6 });
  M.furnitureLight = std(T.woodFloor({ color: [120, 92, 64], planks: 4, seed: 12 }), { scale: 1.0, rough: 0.65 });
  M.siding = std(T.siding({}), { scale: 1.6, bump: 2.0 });
  M.shingles = std(T.shingles({}), { scale: 1.5, bump: 2.0 });
  M.grass = std(T.ground({ kind: 'grass' }), { scale: 4.0, bump: 1.0, rough: 1 });
  M.gravel = std(T.ground({ kind: 'gravel' }), { scale: 2.0, bump: 2.0, rough: 1 });
  M.dirt = std(T.ground({ kind: 'dirt' }), { scale: 3.0, bump: 1.5, rough: 1 });
  M.asphalt = std(T.ground({ kind: 'concrete', seed: 35 }), { scale: 4.0, rough: 0.95, color: 0x777777 });
  M.bark = std(T.bark({}), { scale: 1.0, rough: 1 });
  M.foundation = std(T.stone({ base: [80, 78, 74], seed: 20 }), { scale: 1.6, bump: 2.0 });
  M.porchWood = std(T.woodFloor({ color: [78, 72, 64], seed: 15, planks: 8 }), { scale: 1.6, bump: 1.0, rough: 0.9 });
  onStep();

  // fabrics & misc
  M.sofa = std(T.fabric({ base: [84, 52, 46], pattern: 'floral', seed: 41 }), { scale: 0.8 });
  M.armchair = std(T.fabric({ base: [60, 70, 58], pattern: 'plaid', seed: 42, motif: 'rgba(20,20,10,0.3)' }), { scale: 0.8 });
  M.sheet = std(T.fabric({ base: [180, 172, 156], seed: 43 }), { scale: 1.0 });
  M.blanketPink = std(T.fabric({ base: [170, 110, 118], pattern: 'floral', seed: 44, motif: 'rgba(250,240,240,0.35)' }), { scale: 0.8 });
  M.blanketBlue = std(T.fabric({ base: [60, 74, 100], pattern: 'plaid', seed: 45, motif: 'rgba(10,10,20,0.3)' }), { scale: 0.9 });
  M.blanketMom = std(T.fabric({ base: [110, 96, 80], pattern: 'floral', seed: 46, motif: 'rgba(60,30,30,0.3)' }), { scale: 0.9 });
  M.curtain = std(T.fabric({ base: [96, 70, 60], seed: 47 }), { scale: 1.2, side: THREE.DoubleSide });
  M.curtainEllie = std(T.fabric({ base: [170, 150, 150], pattern: 'floral', seed: 48, motif: 'rgba(160,70,90,0.4)' }), { scale: 1.0, side: THREE.DoubleSide });
  M.rug = std(T.rug({}), { scale: 1, rough: 1 });
  M.rugRunner = std(T.rug({ w: 512, h: 128, seed: 49, base: [70, 24, 22] }), { scale: 1, rough: 1 });
  M.door = std(T.doorPanel({}), { scale: 1, rough: 0.6 });
  M.doorWhite = std(T.doorPanel({ color: [182, 176, 160], painted: true, seed: 51 }), { scale: 1, rough: 0.55 });
  M.doorExterior = std(T.doorPanel({ color: [58, 30, 24], painted: true, seed: 52 }), { scale: 1, rough: 0.55 });
  M.books = std(T.bookSpines({}), { scale: 1, rough: 0.8 });
  onStep();

  M.trim = flat(0x2a1d14, 0.6);
  M.trimWhite = flat(0x9b958a, 0.6);
  M.metal = flat(0x6b665e, 0.45, 0.8);
  M.darkMetal = flat(0x222222, 0.5, 0.7);
  M.brass = flat(0x8a6a2e, 0.35, 0.9);
  M.chrome = flat(0xb0b0b0, 0.2, 1.0);
  M.porcelain = flat(0xcfcbc0, 0.25);
  M.enamel = flat(0xbab4a2, 0.35);
  M.appliance = flat(0xa39f90, 0.5, 0.1);
  M.black = flat(0x050505, 0.9);
  M.plastic = flat(0x2c2a27, 0.5);
  M.cardboard = flat(0x6e5536, 1);
  M.brick = std(T.stone({ base: [96, 52, 40], seed: 22 }), { scale: 1.2, bump: 2.0 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x0c1520, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
  M.glassDark = flat(0x05080b, 0.1, 0.4);
  M.water = new THREE.MeshStandardMaterial({ color: 0x020303, roughness: 0.02, metalness: 0.6 });
  M.foliage = flat(0x0e1a12, 1);
  M.foliageDark = flat(0x0a120d, 1);
  M.carPaint = flat(0x2a3440, 0.35, 0.6);
  M.tire = flat(0x0c0c0c, 0.9);
  M.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 3 });
  M.taillight = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 0.5 });
  M.bulbOn = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 4 });
  M.lampShade = new THREE.MeshStandardMaterial({ color: 0xc8b48c, roughness: 0.9, emissive: 0xffc070, emissiveIntensity: 0, side: THREE.DoubleSide });
  M.flame = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  M.wax = flat(0xd8d0bc, 0.6);
  M.jar = flat(0x3a3a24, 0.25, 0.1);
  M.rope = flat(0x5a4a34, 1);
  M.skinDoll = flat(0xd9c3a8, 0.7);
  M.dollDress = flat(0x7a2a3a, 0.9);
  M.ribbon = flat(0xa3162c, 0.5);
  onStep();

  // pictures & decals (single-use canvases)
  M.photo = {};
  for (const k of ['ellie', 'ellie_dark', 'family', 'christmas', 'mom', 'sam']) M.photo[k] = std(T.photo(k, 71 + k.length), { rough: 0.4 });
  M.drawing = {};
  for (const k of ['family', 'tall', 'well', 'eyes', 'mommy', 'taller', 'sam', 'windows']) M.drawing[k] = std(T.drawing(k, 61 + k.charCodeAt(0)), { rough: 0.95 });
  M.poster = std(T.poster85(), { rough: 0.9 });
  M.newspaper = std(T.newspaper(), { rough: 0.95 });
  M.rules = std(T.rulesPaper(), { rough: 0.95 });
  M.paper = std(T.paper(256, 320, 55), { rough: 0.95 });
  M.sign = std(T.sign(), { rough: 0.9 });
  M.clock = std(T.clockFace(), { rough: 0.6 });
  M.plate57 = std(T.numberPlate('57'), { rough: 0.7 });
  M.placeCard = {};
  for (const n of ['MOM', 'ELLIE', 'SAM']) M.placeCard[n] = std(T.placeCard(n), { rough: 0.9 });
  onStep();

  const decal = (canvas, opacity = 1) =>
    new THREE.MeshStandardMaterial({
      map: toTex(canvas, { repeat: false }),
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.6,
    });
  M.decal = decal;
  M.handprints = decal(T.handprints({}));
  M.tally = decal(T.tally({}));
  M.rainGlassTex = toTex(T.rainGlass({}));
  M.rainGlass = new THREE.MeshBasicMaterial({ map: M.rainGlassTex, transparent: true, opacity: 0.55, depthWrite: false, color: 0x8899aa });
  M.flashCookie = toTex(T.flashCookie(), { repeat: false, srgb: false });

  // the thing
  M.faceIdle = paintFace(512, { scream: false });
  M.faceScream = paintFace(512, { scream: true });
  M.faceFrame = paintFace(1024, { frame: true, scream: false, seed: 667 });
  M.faceFrameScream = paintFace(1024, { frame: true, scream: true, seed: 668 });
  M.faceIdleTex = toTex(M.faceIdle, { repeat: false });
  M.faceScreamTex = toTex(M.faceScream, { repeat: false });
  M.faceFrameTex = toTex(M.faceFrame, { repeat: false });
  M.faceFrameScreamTex = toTex(M.faceFrameScream, { repeat: false });
  M.herSkin = new THREE.MeshStandardMaterial({ map: toTex(skinTexture()), roughness: 0.55, emissive: 0x1a1a18, emissiveIntensity: 0.6 });
  M.herFace = new THREE.MeshStandardMaterial({ map: M.faceIdleTex, roughness: 0.5, emissive: 0x1a1a18, emissiveIntensity: 0.6 });
  M.herGown = new THREE.MeshStandardMaterial({ map: toTex(gownTexture()), roughness: 0.95, emissive: 0x161614, emissiveIntensity: 0.7, side: THREE.DoubleSide });
  // matte: flat hair cards catch grazing-angle specular and turn white otherwise
  M.herHair = new THREE.MeshLambertMaterial({ map: toTex(hairTexture(), { repeat: false }), color: 0x0b0908, alphaTest: 0.35, side: THREE.DoubleSide });
  M.herHairCap = new THREE.MeshLambertMaterial({ color: 0x080606 });
  M.herMouth = flat(0x040101, 1);
  onStep();
  return M;
}
