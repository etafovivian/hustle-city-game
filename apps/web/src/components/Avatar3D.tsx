// Real-time 3D avatar: Quaternius' CC0 animated mannequin (public/models/avatar-base.glb), painted per
// body region with the player's skin tone and outfit. Loaded lazily; falls back to the 2D avatar.
// Swap in nicer bodies later (Tripo / Quaternius base characters) on the same humanoid rig.
import type { AvatarConfig } from "@hc/shared";
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
}

const OUTFITS: Record<string, OutfitPaint> = {
  ankara_green: { top: "#00a859", upperArm: "#00a859", forearm: "skin", bottom: "#1b2238", shin: "#1b2238", feet: "#6b3b1f", pattern: "#ffc72c" },
  agbada_white: { top: "#ece6d6", upperArm: "#ece6d6", forearm: "#ece6d6", bottom: "#e4ddcb", shin: "#e4ddcb", feet: "#5a3a22" },
  jersey_red: { top: "#df382b", upperArm: "#df382b", forearm: "skin", bottom: "#151515", shin: "skin", feet: "#f2f2f2" },
  tee_blue: { top: "#1e2a5e", upperArm: "#1e2a5e", forearm: "skin", bottom: "#3b5b8a", shin: "#3b5b8a", feet: "#f2f2f2" },
  kaftan_gold: { top: "#d9a21f", upperArm: "#d9a21f", forearm: "#d9a21f", bottom: "#c9921a", shin: "#c9921a", feet: "#5a3a22", pattern: "#8a5a00" },
  hoodie_black: { top: "#25282b", upperArm: "#25282b", forearm: "#25282b", bottom: "#4a4f55", shin: "#4a4f55", feet: "#f2f2f2" },
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
};

function regionColors(a: AvatarConfig): THREE.Color[] {
  const o = OUTFITS[a.outfit] ?? OUTFITS.ankara_green!;
  const skin = new THREE.Color(a.skinTone).convertSRGBToLinear();
  const c = (v: string) => (v === "skin" ? skin.clone() : new THREE.Color(v).convertSRGBToLinear());
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
    uPattern: { value: new THREE.Color((OUTFITS[a.outfit] ?? OUTFITS.ankara_green!).pattern ?? "#000000").convertSRGBToLinear() },
    uHasPattern: { value: (OUTFITS[a.outfit] ?? OUTFITS.ankara_green!).pattern ? 1 : 0 },
    uHairLine: { value: HAIR_LINE[a.hairStyle] ?? 1.75 },
    uHasHair: { value: HAIR_LINE[a.hairStyle] === null ? 0 : 1 },
    uHairColor: { value: new THREE.Color(a.hairStyle === "cap" ? "#df382b" : "#1b1410").convertSRGBToLinear() },
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

let cachedGltf: Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTF> | null = null;
function loadModel() {
  if (!cachedGltf) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    cachedGltf = loader.loadAsync("/models/avatar-base.glb");
  }
  return cachedGltf;
}

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
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{
    mixer?: THREE.AnimationMixer;
    actions?: Map<string, THREE.AnimationAction>;
    current?: THREE.AnimationAction;
    uniforms?: ReturnType<typeof makeMaterial>["uniforms"];
    model?: THREE.Object3D;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 1.0, 3.7);
    camera.lookAt(0, 0.9, 0);
    scene.add(new THREE.HemisphereLight("#fff3d6", "#3a4a7b", 2.4));
    const sun = new THREE.DirectionalLight("#ffe7b8", 3.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const rim = new THREE.DirectionalLight("#ffc72c", 1.1);
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

    loadModel()
      .then((gltf) => {
        if (!alive) return;
        // SkeletonUtils.clone rebinds bones, so several viewers can share one loaded file.
        const model = cloneSkinned(gltf.scene);
        const { mat, uniforms } = makeMaterial(avatar);
        model.traverse((o) => {
          const m = o as THREE.SkinnedMesh;
          if (m.isSkinnedMesh) {
            const geo = m.geometry;
            if (geo.getAttribute("color")) geo.setAttribute("region", geo.getAttribute("color"));
            m.material = mat;
            m.frustumCulled = false;
          }
        });
        scene.add(model);
        const mixer = new THREE.AnimationMixer(model);
        const actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
        state.current = { mixer, actions, uniforms, model };
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
    };
    // Scene is built once; avatar and action changes are applied by the effects below.
  }, []);

  // Repaint when the look changes.
  useEffect(() => {
    const u = state.current.uniforms;
    if (!u) return;
    const fresh = makeMaterial(avatar).uniforms;
    u.uColors.value = fresh.uColors.value;
    u.uPattern.value = fresh.uPattern.value;
    u.uHasPattern.value = fresh.uHasPattern.value;
    u.uHairLine.value = fresh.uHairLine.value;
    u.uHasHair.value = fresh.uHasHair.value;
    u.uHairColor.value = fresh.uHairColor.value;
  }, [avatar.skinTone, avatar.hairStyle, avatar.outfit, ready]);

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
