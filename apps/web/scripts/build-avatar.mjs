// Builds public/models/avatar-base.glb from Quaternius' Universal Animation Library (CC0).
//
//   node scripts/build-avatar.mjs <AnimationLibrary_Godot_Standard.glb>
//
// - keeps only the animations the game uses
// - tags every vertex with a body region (from its strongest bone) in COLOR_0.r,
//   so the app can paint skin and outfits per region with one material
// - meshopt-compresses the result for mobile
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, prune, dedup, resample } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const [src] = process.argv.slice(2);
if (!src) throw new Error("usage: node scripts/build-avatar.mjs <source.glb>");
const out = new URL("../public/models/avatar-base.glb", import.meta.url).pathname;

const KEEP = new Set([
  "Idle_Loop",
  "Walk_Loop",
  "Jog_Fwd_Loop",
  "Dance_Loop",
  "Idle_Talking_Loop",
  "Sitting_Idle_Loop",
  "Fixing_Kneeling",
  "PickUp_Table",
  "Interact",
]);

// Region ids written to COLOR_0.r as id / 7. Keep in sync with Avatar3D.tsx.
const REGION = { skin: 0, top: 1, upperArm: 2, forearm: 3, bottom: 4, shin: 5, feet: 6, head: 7 };
function regionFor(bone) {
  if (/head|neck/.test(bone)) return REGION.head;
  if (/hand|f_|thumb/.test(bone)) return REGION.skin;
  if (/forearm/.test(bone)) return REGION.forearm;
  if (/upper_arm/.test(bone)) return REGION.upperArm;
  if (/spine|shoulder|breast|chest/.test(bone)) return REGION.top;
  if (/foot|toe/.test(bone)) return REGION.feet;
  if (/shin/.test(bone)) return REGION.shin;
  if (/hips|thigh|pelvis/.test(bone)) return REGION.bottom;
  return REGION.top;
}

const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({
  "meshopt.encoder": MeshoptEncoder,
});
const doc = await io.read(src);
const root = doc.getRoot();

for (const anim of root.listAnimations()) {
  if (!KEEP.has(anim.getName())) anim.dispose();
}

const skin = root.listSkins()[0];
const jointNames = skin.listJoints().map((n) => n.getName());

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const joints = prim.getAttribute("JOINTS_0");
    const weights = prim.getAttribute("WEIGHTS_0");
    const count = joints.getCount();
    const colors = new Float32Array(count * 4);
    const j = [0, 0, 0, 0];
    const w = [0, 0, 0, 0];
    for (let i = 0; i < count; i++) {
      joints.getElement(i, j);
      weights.getElement(i, w);
      const best = w.indexOf(Math.max(...w));
      const region = regionFor(jointNames[j[best]] ?? "");
      colors.set([region / 7, 0, 0, 1], i * 4);
    }
    const acc = doc.createAccessor().setType("VEC4").setArray(colors).setBuffer(root.listBuffers()[0]);
    prim.setAttribute("COLOR_0", acc);
    prim.setAttribute("TEXCOORD_1", null);
  }
}

await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await io.write(out, doc);

const kept = root.listAnimations().map((a) => a.getName());
console.log(`wrote ${out}\nanimations: ${kept.join(", ")}`);
