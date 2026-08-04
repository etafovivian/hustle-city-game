# Shared helpers for the Naija Hustle City Blender scripts (garments.py, sprites.py).
# Loaded with sys.path.insert(0, <script dir>) from inside Blender.
import bpy, bmesh, math
from mathutils import Vector, Matrix, kdtree

FINGERS = ("index", "middle", "pinky", "ring", "thumb")
TORSO = {"pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "neck_01"}
LEGS = {"thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r", "ball_leaf_l", "ball_leaf_r"}
UPPERLEGS = {"pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r"}
ARM = {s: {f"upperarm_{s}", f"lowerarm_{s}", f"hand_{s}"} for s in "lr"}


def smoothstep(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def load_body(path):
    """Fresh scene with one body glb. Returns (armature, body mesh, other meshes)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.name.startswith("Icosphere"):
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    body = max(meshes, key=lambda o: len(o.data.vertices))
    ad = arm.animation_data
    for t in ad.nla_tracks:
        t.mute = True
    return arm, body, [m for m in meshes if m is not body]


def set_action(arm, name, frame=1.0):
    ad = arm.animation_data
    act = bpy.data.actions[name]
    ad.action = act
    if hasattr(ad, "action_slot") and len(act.slots):
        ad.action_slot = act.slots[0]
    f = int(math.floor(frame))
    bpy.context.scene.frame_set(f, subframe=frame - f)


def build_pose(arm):
    """Pose used to model loose garments: rest pose (straight legs, upright spine) with the arms
    lowered as in Idle_Loop frame 1. Garments are modelled here, then un-skinned back to rest."""
    set_action(arm, "Idle_Loop", 1)
    keep = {}
    for pb in arm.pose.bones:
        n = pb.name
        if any(k in n for k in ("clavicle", "upperarm", "lowerarm", "hand")) or n.startswith(FINGERS):
            keep[n] = (pb.location.copy(), pb.rotation_quaternion.copy(), pb.scale.copy())
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
        if pb.name in keep:
            pb.location, pb.rotation_quaternion, pb.scale = keep[pb.name]
    bpy.context.view_layer.update()


def bucket(name):
    """Fold finger bones into their hand for weighting/masks."""
    if name.startswith(FINGERS):
        return "hand_" + name[-1]
    return name


class BodyData:
    """Posed body vertices, their bone weights and KD trees per bone mask."""

    def __init__(self, arm, body):
        self.arm, self.body = arm, body
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg)
        me = ev.to_mesh()
        mw = body.matrix_world
        self.co = [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
        names = {g.index: g.name for g in body.vertex_groups}
        self.w = []
        self.dom = []
        for v in body.data.vertices:
            d = {}
            for g in v.groups:
                if g.weight > 1e-4:
                    b = names[g.group]
                    d[b] = d.get(b, 0) + g.weight
            s = sum(d.values()) or 1
            d = {k: x / s for k, x in d.items()}
            self.w.append(d)
            self.dom.append(bucket(max(d, key=d.get)) if d else "root")
        self._trees = {}

    def idx(self, mask):
        return [i for i, b in enumerate(self.dom) if b in mask]

    def tree(self, mask):
        key = frozenset(mask)
        if key not in self._trees:
            ids = self.idx(mask)
            t = kdtree.KDTree(len(ids))
            for j, i in enumerate(ids):
                t.insert(self.co[i], i)
            t.balance()
            self._trees[key] = t
        return self._trees[key]

    def weights_near(self, p, mask, k=8):
        acc = {}
        for co, i, d in self.tree(mask).find_n(p, k):
            f = 1.0 / (d + 0.01) ** 2
            for b, x in self.w[i].items():
                acc[b] = acc.get(b, 0) + x * f
        return norm_w(acc)

    def pts(self, mask, zmin=-9, zmax=9):
        return [self.co[i] for i in self.idx(mask) if zmin <= self.co[i].z <= zmax]

    def bone_head(self, name):
        return self.arm.matrix_world @ self.arm.pose.bones[name].head

    def rest_head(self, name):
        return self.arm.matrix_world @ self.arm.data.bones[name].head_local


def norm_w(d, maxn=4):
    items = sorted(((b, x) for b, x in d.items() if x > 0), key=lambda t: -t[1])[:maxn]
    s = sum(x for _, x in items) or 1
    return {b: x / s for b, x in items if x / s > 0.01}


def mix_w(*pairs):
    acc = {}
    for f, d in pairs:
        for b, x in d.items():
            acc[b] = acc.get(b, 0) + f * x
    return norm_w(acc)


def support(pts2, n, c=(0.0, 0.0)):
    """Support function of a 2D point set (convex hull distance per direction)."""
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        ux, uy = math.cos(a), math.sin(a)
        out.append(max(((p[0] - c[0]) * ux + (p[1] - c[1]) * uy) for p in pts2) if pts2 else 0.0)
    return out


def smooth_rows(rows, passes=1):
    for _ in range(passes):
        new = []
        for i, r in enumerate(rows):
            a = rows[max(0, i - 1)]
            b = rows[min(len(rows) - 1, i + 1)]
            new.append([0.25 * a[j] + 0.5 * r[j] + 0.25 * b[j] for j in range(len(r))])
        rows = new
    return rows


def smooth_ring(r, passes=1):
    n = len(r)
    for _ in range(passes):
        r = [0.25 * r[(j - 1) % n] + 0.5 * r[j] + 0.25 * r[(j + 1) % n] for j in range(n)]
    return r


def grid_mesh(name, rings, closed=True, cap_top=False, cap_bottom=False):
    """Quad grid from rings (list of lists of Vector, all the same length)."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n if closed else n - 1):
            j2 = (j + 1) % n
            bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j2], vs[i][j2]))
    if cap_top:
        bm.faces.new(list(reversed(vs[0])))
    if cap_bottom:
        bm.faces.new(vs[-1])
    return bm


def make_mat(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)
    m.use_backface_culling = False  # open cloth: exported as doubleSided
    return m


def paint_body(body, rgb):
    for slot in body.material_slots:
        if slot.material:
            slot.material.diffuse_color = (*rgb, 1)


def skin_object(arm, obj, weights):
    """weights: list (per vertex) of {bone: w}, in build-pose coordinates. Converts the mesh to rest
    coordinates by inverting the linear-blend skinning, adds vertex groups and an Armature modifier."""
    mats = {}
    for pb in arm.pose.bones:
        mats[pb.name] = arm.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted() @ arm.matrix_world.inverted()
    me = obj.data
    for v, w in zip(me.vertices, weights):
        M = Matrix(((0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 0)))
        for b, x in w.items():
            M = M + mats[b] * x
        v.co = M.inverted() @ (obj.matrix_world @ v.co)
    groups = {}
    for i, w in enumerate(weights):
        for b, x in w.items():
            if b not in groups:
                groups[b] = obj.vertex_groups.new(name=b)
            groups[b].add([i], x, "REPLACE")
    obj.parent = arm
    obj.matrix_parent_inverse = Matrix.Identity(4)
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def obj_from_bm(bm, name, mat):
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def attach_hair(arm, path, bone="Head"):
    """Hair glbs are modelled in rest-pose coordinates without skin: parent them to the Head bone."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    b = arm.data.bones[bone]
    pm = arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
    for o in new:
        mw = o.matrix_world.copy()
        o.parent = arm
        o.parent_type = "BONE"
        o.parent_bone = bone
        o.matrix_parent_inverse = pm.inverted()
        o.matrix_basis = mw
    return new


def workbench(scene, w, h, outline=False, light="STUDIO"):
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = light
    sh.color_type = "MATERIAL"
    sh.show_object_outline = outline
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
