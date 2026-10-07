// Real-time 3D avatar: Quaternius' CC0 woman and man bodies (public/models/avatar-{woman,man}.glb), painted per
// body region with the player's skin tone and outfit. Loaded lazily; falls back to the 2D avatar.
// Swap in nicer bodies later (Tripo / Quaternius base characters) on the same humanoid rig.
import { bodyOf, type AvatarConfig } from "@hc/shared";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export type AvatarAction =
  | "Idle_Loop"
  | "Walk_Loop"
  | "Jog_Fwd_Loop"
  | "Dance_Loop"
  | "Idle_Talking_Loop"
  | "Sitting_Idle_Loop"
  | "Fixing_Kneeling"
  | "PickUp_Table"
  | "Interact";

// Body regions baked into the model by scripts/build-avatar.mjs (COLOR_0.r = id / 7).
const R = { skin: 0, top: 1, upperArm: 2, forearm: 3, bottom: 4, shin: 5, feet: 6, head: 7 } as const;

interface OutfitPaint {
  top: string;
  upperArm: string | "skin";
  forearm: string | "skin";
  bottom: string;
  shin: string | "skin";
  feet: string;
  /** Second colour for an Ankara circle pattern on the top. */
  pattern?: string;
  /** The garment's own fabric colour, when it differs from the painted top (a jacket over a shirt, a saree over a
   * blouse): the outfit colour then dyes the garment and the parts in that same cloth, not the shirt. */
  fabric?: string;
}

const OUTFITS: Record<string, OutfitPaint> = {
  ankara_green: { top: "#00a859", upperArm: "#00a859", forearm: "skin", bottom: "#1b2238", shin: "#1b2238", feet: "#6b3b1f", pattern: "#ffc72c" },
  agbada_white: { top: "#ece6d6", upperArm: "#ece6d6", forearm: "#ece6d6", bottom: "#e4ddcb", shin: "#e4ddcb", feet: "#5a3a22" },
  jersey_red: { top: "#df382b", upperArm: "#df382b", forearm: "skin", bottom: "#151515", shin: "skin", feet: "#f2f2f2" },
  tee_blue: { top: "#1e2a5e", upperArm: "#1e2a5e", forearm: "skin", bottom: "#3b5b8a", shin: "#3b5b8a", feet: "#f2f2f2" },
  kaftan_gold: { top: "#d9a21f", upperArm: "#d9a21f", forearm: "#d9a21f", bottom: "#c9921a", shin: "#c9921a", feet: "#5a3a22", pattern: "#8a5a00" },
  hoodie_black: { top: "#25282b", upperArm: "#25282b", forearm: "#25282b", bottom: "#4a4f55", shin: "#4a4f55", feet: "#f2f2f2" },
  // Buba blouse and a long wrapper in the same Ankara cloth.
  buba_wrapper: { top: "#0f7b6c", upperArm: "#0f7b6c", forearm: "skin", bottom: "#0f7b6c", shin: "#0f7b6c", feet: "#c9921a", pattern: "#f2b705" },
  peplum_coral: { top: "#e4572e", upperArm: "skin", forearm: "skin", bottom: "#e4572e", shin: "skin", feet: "#c9921a", pattern: "#f6c8a8" },
  // Added with the layered sprites: what shows under (or round) each new garment.
  suit: { top: "#f4f4f2", upperArm: "#f4f4f2", forearm: "#f4f4f2", bottom: "#1f2a6b", shin: "#1f2a6b", feet: "#151515", fabric: "#1f2a6b" },
  jeans_jacket: { top: "#f4f4f2", upperArm: "#f4f4f2", forearm: "#f4f4f2", bottom: "#3b5b8a", shin: "#3b5b8a", feet: "#f2f2f2", fabric: "#4b5a2a" },
  summer_dress: { top: "#e985b5", upperArm: "skin", forearm: "skin", bottom: "#e985b5", shin: "skin", feet: "#c9921a", fabric: "#e985b5" },
  abaya: { top: "#25282b", upperArm: "#25282b", forearm: "#25282b", bottom: "#25282b", shin: "#25282b", feet: "#25211d", fabric: "#25282b" },
  kente: { top: "#f2b705", upperArm: "#f2b705", forearm: "skin", bottom: "#f2b705", shin: "skin", feet: "#6b3b1f", fabric: "#f2b705" },
  boubou: { top: "#2f5fb3", upperArm: "#2f5fb3", forearm: "#2f5fb3", bottom: "#2f5fb3", shin: "#2f5fb3", feet: "#5a3a22", fabric: "#2f5fb3" },
  kurta: { top: "#f4f4f2", upperArm: "#f4f4f2", forearm: "#f4f4f2", bottom: "#ece6d6", shin: "#ece6d6", feet: "#6b3b1f", fabric: "#f4f4f2" },
  salwar_kameez: { top: "#0f7b6c", upperArm: "#0f7b6c", forearm: "#0f7b6c", bottom: "#0f7b6c", shin: "#0f7b6c", feet: "#c9921a", fabric: "#0f7b6c" },
  saree: { top: "#c9921a", upperArm: "#c9921a", forearm: "skin", bottom: "#c8321e", shin: "#c8321e", feet: "#c9921a", fabric: "#c8321e" },
};

// How far down the head the hair colour reaches (model is ~1.83 m tall).
const HAIR_LINE: Record<string, number | null> = {
  low_cut: 1.75,
  buzzcut: 1.77,
  high_top: 1.7,
  curly: 1.71,
  puff: 1.71,
  locs: 1.68,
  bald: null,
  cap: 1.72,
  braids: 1.62,
  bob: 1.64,
  gele: 1.69,
  straight: 1.72,
  wavy: 1.66,
  ponytail: 1.7,
  bun: 1.7,
  side_part: 1.73,
  long_straight: 1.64,
  hijab: 1.6,
};

/** Fabric colours for wraps and caps; everything else is near-black hair. */
const HAIR_TINT: Record<string, string> = { cap: "#df382b", gele: "#f2b705", hijab: "#7a1f3d" };

/**
 * The outfit painted in the player's chosen fabric colour: everything dyed in the outfit's main colour takes the new
 * one (trousers that match the top get a slightly deeper shade), and the Ankara pattern switches to gold on dark
 * cloth or deep brown on light cloth so it still shows.
 */
export function paintFor(a: AvatarConfig): OutfitPaint {
  const o = OUTFITS[a.outfit] ?? OUTFITS.ankara_green!;
  if (!a.outfitColor) return o;
  const pick = new THREE.Color(a.outfitColor);
  const base = new THREE.Color(o.fabric ?? o.top);
  // (Color.sub clamps at zero, so compare channel by channel.)
  const near = (hex: string) => {
    if (hex === "skin") return false;
    const c = new THREE.Color(hex);
    return Math.abs(c.r - base.r) < 0.08 && Math.abs(c.g - base.g) < 0.08 && Math.abs(c.b - base.b) < 0.08;
  };
  const deeper = "#" + pick.clone().multiplyScalar(0.86).getHexString();
  const hsl = { h: 0, s: 0, l: 0 };
  pick.getHSL(hsl);
  const dye = (hex: string, deep = false) => (near(hex) ? (deep ? deeper : a.outfitColor!) : hex);
  return {
    ...o,
    top: o.fabric ? dye(o.top) : a.outfitColor,
    fabric: a.outfitColor,
    upperArm: dye(o.upperArm),
    forearm: dye(o.forearm),
    bottom: dye(o.bottom, true),
    shin: dye(o.shin, true),
    ...(o.pattern ? { pattern: hsl.l < 0.45 ? "#f2b705" : "#3a2410" } : {}),
  };
}

function regionColors(a: AvatarConfig): THREE.Color[] {
  const o = paintFor(a);
  // THREE.Color already converts sRGB hex to linear, so no extra conversion (doing it twice
  // turned skin orange-red and deep tones black). Very deep tones get a small lift so their form reads.
  const skin = new THREE.Color(a.skinTone);
  const hsl = { h: 0, s: 0, l: 0 };
  skin.getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.l < 0.2) skin.setHSL(hsl.h, hsl.s, 0.2, THREE.SRGBColorSpace);
  const c = (v: string) => (v === "skin" ? skin.clone() : new THREE.Color(v));
  const out: THREE.Color[] = [];
  out[R.skin] = skin.clone();
  out[R.head] = skin.clone();
  out[R.top] = c(o.top);
  out[R.upperArm] = c(o.upperArm);
  out[R.forearm] = c(o.forearm);
  out[R.bottom] = c(o.bottom);
  out[R.shin] = c(o.shin);
  out[R.feet] = c(o.feet);
  return out;
}

/** One material for the whole body: picks a colour per vertex region, adds hair and an Ankara pattern. */
function makeMaterial(a: AvatarConfig) {
  const uniforms = {
    uColors: { value: regionColors(a) },
    uPattern: { value: new THREE.Color(paintFor(a).pattern ?? "#000000") },
    uHasPattern: { value: paintFor(a).pattern ? 1 : 0 },
    uHairLine: { value: HAIR_LINE[a.hairStyle] ?? 1.75 },
    uHasHair: { value: HAIR_LINE[a.hairStyle] === null ? 0 : 1 },
    uHairColor: { value: new THREE.Color(a.hairColor ?? HAIR_TINT[a.hairStyle] ?? "#1b1410") },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 region;\nvarying float vRegion;\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegion = region.r * 7.0;\nvLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vRegion;
varying vec3 vLocal;
uniform vec3 uColors[8];
uniform vec3 uPattern;
uniform float uHasPattern;
uniform float uHairLine;
uniform float uHasHair;
uniform vec3 uHairColor;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
int r = int(floor(vRegion + 0.5));
vec3 base = uColors[0];
for (int i = 0; i < 8; i++) { if (i == r) base = uColors[i]; }
// Ankara-style circles on the torso and sleeves.
if (uHasPattern > 0.5 && (r == 1 || r == 2)) {
  vec2 p = vec2(vLocal.x * 9.0, vLocal.y * 9.0);
  vec2 cell = fract(p) - 0.5;
  float d = length(cell);
  float ring = step(0.18, d) * step(d, 0.26) + step(d, 0.07);
  base = mix(base, uPattern, ring);
}
// Hair: the top (and back) of the head.
if (uHasHair > 0.5 && r == 7 && (vLocal.y > uHairLine || (vLocal.y > uHairLine - 0.08 && vLocal.z < -0.05))) base = uHairColor;
diffuseColor.rgb = base;`,
      );
  };
  return { mat, uniforms };
}

// Woman and man bodies (Quaternius Universal Base Characters + Universal Animation Library, CC0),
// built by scripts/blender/bodies.py and scripts/build-bodies.mjs.
const modelCache = new Map<string, Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTF>>();
function loadModel(body: string) {
  if (!modelCache.has(body)) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    modelCache.set(body, loader.loadAsync(`/models/avatar-${body}.glb`));
  }
  return modelCache.get(body)!;
}

/** 3D hair pieces made in Blender (scripts/blender/hair.py), in the mannequin's rest-pose space. */
const HAIR_FILES = new Set(["low_cut", "buzzcut", "curly", "high_top", "puff", "bob", "braids", "locs", "gele", "cap", "straight", "wavy", "ponytail", "bun", "side_part", "long_straight", "hijab"]);
const hairCache = new Map<string, Promise<THREE.Object3D>>();
function loadHair(body: string, style: string) {
  const key = `${body}/${style}`;
  if (!hairCache.has(key)) {
    hairCache.set(
      key,
      new GLTFLoader().loadAsync(`/models/hair/${key.replace("/", "/hair-")}.glb`).then((g) => g.scene),
    );
  }
  return hairCache.get(key)!;
}

/** Loose traditional clothes made in Blender (scripts/blender/agent/garments.py), skinned to the same skeleton. */
const GARMENTS: Record<string, Partial<Record<string, string>>> = {
  man: { agbada_white: "agbada", kaftan_gold: "kaftan", suit: "suit_jacket", jeans_jacket: "denim_jacket", kente: "kente", boubou: "boubou", kurta: "kurta" },
  woman: {
    buba_wrapper: "buba_wrapper",
    peplum_coral: "peplum_gown",
    suit: "suit_jacket",
    jeans_jacket: "denim_jacket",
    summer_dress: "summer_dress",
    abaya: "abaya",
    kente: "kente",
    boubou: "boubou",
    salwar_kameez: "kameez",
    saree: "saree",
  },
};
/**
 * Woven and printed cloth, drawn in the shader from the garment's own (rest-pose) position, like the ankara circles:
 * kente is woven in blocks and bands (the fabric colour with gold, green and black), the boubou's cloth carries a
 * printed lattice a shade lighter or darker than the fabric.
 */
function patterned(mat: THREE.MeshStandardMaterial, kind: "kente" | "print", fabric: THREE.Color) {
  const light = new THREE.Color(fabric).lerp(new THREE.Color(fabric.getHSL({ h: 0, s: 0, l: 0 }).l < 0.45 ? "#f2e6c8" : "#2a1a10"), 0.45);
  const u = { uFab: { value: fabric.clone() }, uAlt: { value: light }, uKind: { value: kind === "kente" ? 0 : 1 } };
  mat.color.set("#ffffff");
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCloth;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloth = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCloth;\nuniform vec3 uFab;\nuniform vec3 uAlt;\nuniform float uKind;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 c = uFab;
if (uKind < 0.5) {
  // kente: bands every 5.5 cm; every fourth a narrow accent stripe, between them blocks round the body
  float band = floor(vCloth.y / 0.055);
  float col = floor((atan(vCloth.z, vCloth.x) + 3.14159) / 6.28318 * 12.0);
  float fy = fract(vCloth.y / 0.055);
  if (mod(band, 4.0) == 1.0) c = mod(col, 2.0) < 1.0 ? vec3(0.07, 0.36, 0.16) : vec3(0.03, 0.025, 0.02);
  else if (mod(band / 4.0 + col, 3.0) < 1.0) c = vec3(0.93, 0.66, 0.04);
  // the weave: fine stripes across each band
  c *= 0.9 + 0.1 * step(0.5, fract(fy * 6.0));
} else {
  // a printed lattice of diamonds with a dot in each
  vec2 p = vec2(vCloth.x + vCloth.z, vCloth.y) * 14.0;
  vec2 q = abs(fract(p) - 0.5);
  float line = step(0.44, q.x + q.y);
  float dot_ = step(length(fract(p) - 0.5), 0.09);
  c = mix(uFab, uAlt, max(line, dot_));
}
diffuseColor.rgb = c;`,
      );
  };
  mat.needsUpdate = true;
}

const garmentCache = new Map<string, Promise<THREE.Object3D>>();
function loadGarment(body: string, key: string) {
  const id = `${body}/${key}`;
  if (!garmentCache.has(id)) garmentCache.set(id, new GLTFLoader().loadAsync(`/models/garments/${id}.glb`).then((g) => g.scene));
  return garmentCache.get(id)!;
}
/** Poses the loose clothes weren't modelled for (they'd stretch through the legs); the painted outfit shows instead. */
const NO_GARMENT_POSES = new Set(["Fixing_Kneeling", "Sitting_Idle_Loop", "Driving_Loop"]);

export default function Avatar3D({
  avatar,
  action = "Idle_Loop",
  height = 240,
  onFail,
}: {
  avatar: AvatarConfig;
  action?: AvatarAction;
  height?: number;
  onFail?: () => void;
}) {
  const body = bodyOf(avatar);
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{
    mixer?: THREE.AnimationMixer;
    actions?: Map<string, THREE.AnimationAction>;
    current?: THREE.AnimationAction;
    uniforms?: ReturnType<typeof makeMaterial>["uniforms"];
    model?: THREE.Object3D;
    /** The head bone and its bind inverse, for attaching hair so it follows every animation. */
    head?: { bone: THREE.Bone; inverse: THREE.Matrix4 };
    hair?: THREE.Object3D;
    garment?: THREE.Object3D;
  }>({});
  const [ready, setReady] = useState(false);

  // Scene setup once.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps skin and fabric hues true (ACES pushed skin towards orange-red).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    // Framed so the head (and tall styles like a gele or high top) always fit in short preview cards.
    camera.position.set(0, 1.05, 4.6);
    camera.lookAt(0, 0.98, 0);
    // White key and fill light so the chosen colours read as chosen; a soft gold rim for the brand.
    scene.add(new THREE.HemisphereLight("#ffffff", "#4a5470", 1.6));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const front = new THREE.DirectionalLight("#ffffff", 0.9);
    front.position.set(0, 1.5, 4);
    scene.add(front);
    const rim = new THREE.DirectionalLight("#ffc72c", 0.6);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    // Gold ring floor.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: "#ffc72c", transparent: true, opacity: 0.55 }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.28 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.001;
    scene.add(disc);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Drag to spin.
    let spin = 0.35;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      spin += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const up = () => (dragging = false);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    const clock = new THREE.Clock();
    let raf = 0;
    let alive = true;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      state.current.mixer?.update(dt);
      if (state.current.model) state.current.model.rotation.y = spin;
      renderer.render(scene, camera);
    };

    loadModel(body)
      .then((gltf) => {
        if (!alive) return;
        // SkeletonUtils.clone rebinds bones, so several viewers can share one loaded file.
        const model = cloneSkinned(gltf.scene);
        const { mat, uniforms } = makeMaterial(avatar);
        model.traverse((o) => {
          const m = o as THREE.SkinnedMesh;
          // Only the body is painted by region; eyes and eyebrows keep their own materials.
          if (m.isSkinnedMesh && m.geometry.getAttribute("color")) {
            const geo = m.geometry;
            if (geo.getAttribute("color")) geo.setAttribute("region", geo.getAttribute("color"));
            m.material = mat;
            m.frustumCulled = false;
          }
        });
        scene.add(model);
        const mixer = new THREE.AnimationMixer(model);
        const actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
        // The freshly cloned model is still in its rest pose: remember where the head bone sits in model
        // space, so hair made in that same space can be re-parented onto the bone.
        model.updateMatrixWorld(true);
        const bone = model.getObjectByName("Head") as THREE.Bone | undefined;
        const head = bone ? { bone, inverse: bone.matrixWorld.clone().invert() } : undefined;
        state.current = { mixer, actions, uniforms, model, head };
        const first = actions.get(action) ?? actions.get("Idle_Loop");
        first?.play();
        state.current.current = first;
        setReady(true);
        loop();
      })
      .catch(() => onFail?.());

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      renderer.dispose();
      renderer.domElement.remove();
      // (a new body builds a new scene: the hair and garment effects re-run for it once it's ready)
      state.current = {};
      setReady(false);
    };
    // Built once per body (the woman's and man's models differ); look and action changes are applied by the effects
    // below. Rebuilding on a body switch keeps a saree from being shown on the man's body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  // Repaint when the look changes.
  useEffect(() => {
    const u = state.current.uniforms;
    if (!u) return;
    const fresh = makeMaterial(avatar).uniforms;
    u.uColors.value = fresh.uColors.value;
    u.uPattern.value = fresh.uPattern.value;
    u.uHasPattern.value = fresh.uHasPattern.value;
    u.uHairLine.value = fresh.uHairLine.value;
    u.uHasHair.value = state.current.hair ? 0 : fresh.uHasHair.value;
    u.uHairColor.value = fresh.uHairColor.value;
  }, [avatar.skinTone, avatar.hairStyle, avatar.outfit, avatar.outfitColor, avatar.hairColor, ready]);

  // Hair: a real 3D piece on the head bone; the painted hairline is only a fallback while it loads.
  useEffect(() => {
    const s = state.current;
    if (!s.head || !s.uniforms) return;
    const style = avatar.hairStyle;
    let cancelled = false;
    if (s.hair) {
      s.hair.removeFromParent();
      s.hair = undefined;
    }
    if (!HAIR_FILES.has(style)) return;
    loadHair(body, style)
      .then((src) => {
        if (cancelled || !s.head) return;
        const hair = src.clone(true);
        // From rest-pose model space into the head bone's own space.
        hair.applyMatrix4(s.head.inverse);
        hair.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.frustumCulled = false;
          // The chosen hair colour (or the gele / cap fabric), on this avatar's own copy of the material.
          if (avatar.hairColor) {
            const mat = (m.material as THREE.MeshStandardMaterial).clone();
            mat.color.set(avatar.hairColor);
            if (mat.map) mat.color.multiplyScalar(1.6);
            m.material = mat;
          }
        });
        s.head.bone.add(hair);
        s.hair = hair;
        if (s.uniforms) s.uniforms.uHasHair.value = 0;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [avatar.hairStyle, avatar.hairColor, ready]);

  // Loose clothes: re-bind the garment's skinned mesh to this avatar's bones (same names), tint to the outfit.
  useEffect(() => {
    const s = state.current;
    if (!s.model) return;
    if (s.garment) {
      s.garment.removeFromParent();
      s.garment = undefined;
    }
    const key = GARMENTS[body]?.[avatar.outfit];
    const model = s.model;
    model.visible = true;
    if (!key) return;
    // Hide the body until its robe or gown arrives, so the painted stand-in (a full coral or white body
    // suit) never flashes up first. If the garment is slow or fails, show the painted outfit after 5 s.
    model.visible = false;
    const show = () => void (model.visible = true);
    const fallback = window.setTimeout(show, 5000);
    let cancelled = false;
    loadGarment(body, key)
      .then((src) => {
        if (cancelled || !s.model) return;
        const bones = new Map<string, THREE.Bone>();
        s.model.traverse((o) => {
          if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone);
        });
        const group = new THREE.Group();
        const paint = paintFor(avatar);
        const colour = paint.fabric ?? paint.top;
        src.traverse((o) => {
          const m = o as THREE.SkinnedMesh;
          if (!m.isSkinnedMesh) return;
          const mine = bones.size ? m.skeleton.bones.map((b) => bones.get(b.name)) : [];
          if (mine.some((b) => !b)) return;
          const mesh = new THREE.SkinnedMesh(m.geometry, (m.material as THREE.MeshStandardMaterial).clone());
          const mat = mesh.material as THREE.MeshStandardMaterial;
          // Newer garments name their materials by role: T_fab (the fabric), T_deep (the same cloth a shade deeper),
          // FIX_* (trims and kente accents, kept as they are).
          if (key === "kente") patterned(mat, "kente", new THREE.Color(colour ?? "#f2b705"));
          else if (key === "boubou" && !mat.name.startsWith("FIX_")) patterned(mat, "print", new THREE.Color(colour ?? "#2f5fb3"));
          else if (colour && !mat.name.startsWith("FIX_")) {
            mat.color.set(colour);
            if (mat.name.startsWith("T_deep")) mat.color.multiplyScalar(0.86);
          }
          mat.side = THREE.DoubleSide;
          mat.roughness = 0.75;
          mesh.frustumCulled = false;
          mesh.bind(new THREE.Skeleton(mine as THREE.Bone[], m.skeleton.boneInverses), m.bindMatrix);
          group.add(mesh);
        });
        s.model.add(group);
        s.garment = group;
        group.visible = !NO_GARMENT_POSES.has(action);
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(fallback);
        if (!cancelled) show();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      model.visible = true;
    };
  }, [avatar.outfit, avatar.outfitColor, ready]);

  useEffect(() => {
    const g = state.current.garment;
    if (g) g.visible = !NO_GARMENT_POSES.has(action);
  }, [action]);

  // Cross-fade between animations.
  useEffect(() => {
    const s = state.current;
    const next = s.actions?.get(action);
    if (!next || next === s.current) return;
    next.reset().fadeIn(0.35).play();
    s.current?.fadeOut(0.35);
    s.current = next;
  }, [action, ready]);

  return (
    <div
      ref={host}
      className="avatar3d"
      style={{ height }}
      role="img"
      aria-label="Your 3D character. Drag to turn them around."
    />
  );
}
