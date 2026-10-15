// Builds public/models/avatar-woman.glb and avatar-man.glb from the Blender bodies
// (scripts/blender/bodies.py: Quaternius Universal Base Characters + Universal Animation Library, both CC0).
//
//   node scripts/build-bodies.mjs <body-Female.glb> <body-Male.glb>
//
// - tags every body vertex with a region (from its strongest bone) in COLOR_0.r, like build-avatar.mjs,
//   so the app paints skin and outfits per region; eyes and brows keep their own materials
// - meshopt-compresses for mobile
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const [female, male] = process.argv.slice(2);
if (!female || !male) throw new Error("usage: node scripts/build-bodies.mjs <body-Female.glb> <body-Male.glb>");

// Region ids written to COLOR_0.r as id / 7. Keep in sync with Avatar3D.tsx. Unreal-style bone names.
const REGION = { skin: 0, top: 1, upperArm: 2, forearm: 3, bottom: 4, shin: 5, feet: 6, head: 7 };
function regionFor(bone) {
  const b = bone.toLowerCase();
  if (/head|neck/.test(b)) return REGION.head;
  if (/hand|index|middle|ring|pinky|thumb/.test(b)) return REGION.skin;
  if (/lowerarm/.test(b)) return REGION.forearm;
  if (/upperarm/.test(b)) return REGION.upperArm;
  if (/spine|clavicle|breast|chest/.test(b)) return REGION.top;
  if (/foot|ball|toe/.test(b)) return REGION.feet;
  if (/calf/.test(b)) return REGION.shin;
  if (/pelvis|thigh|hips/.test(b)) return REGION.bottom;
  return REGION.top;
}

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

for (const [src, name] of [
  [female, "avatar-woman"],
  [male, "avatar-man"],
]) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const jointNames = skin.listJoints().map((n) => n.getName());
  // The body is the biggest mesh; eyes and eyebrows keep their own materials. Name them for the app.
  const size = (m) => m.listPrimitives().reduce((n, p) => n + p.getAttribute("POSITION").getCount(), 0);
  const meshes = root.listMeshes().sort((a, b) => size(b) - size(a));
  for (const m of meshes.slice(1)) {
    const mat = m.listPrimitives()[0]?.getMaterial()?.getName() ?? "";
    m.setName(/eye/i.test(mat) && !/hair/i.test(mat) ? "Eyes" : "Eyebrows");
  }
  for (const mesh of meshes.slice(0, 1)) {
    mesh.setName("Body");
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
        colors.set([regionFor(jointNames[j[best]] ?? "") / 7, 0, 0, 1], i * 4);
      }
      prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(colors).setBuffer(root.listBuffers()[0]));
      for (const sem of ["TEXCOORD_1", "TANGENT"]) prim.setAttribute(sem, null);
    }
  }
  await doc.transform(resample(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const out = new URL(`../public/models/${name}.glb`, import.meta.url).pathname;
  await io.write(out, doc);
  console.log(`wrote ${out}: meshes ${root.listMeshes().map((m) => m.getName()).join(", ")}; animations ${root.listAnimations().length}`);
}
