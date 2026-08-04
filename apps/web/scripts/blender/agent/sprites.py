# Isometric walking sprite sheets rendered from the rigged bodies (+ garments from garments.py, hair).
#   blender -b -P sprites.py -- <hustle_dir> <garment_dir> <outdir> [variant ...]
# hustle_dir holds body-Male.glb, body-Female.glb, hair-Male/, hair-Female/. garment_dir holds the
# garment-*.glb files from garments.py (used for the traditional outfits; re-bound to the body skeleton).
# Output: walk-{variant}-{se|sw|ne|nw}.png (8 frames of 96x160 in a row = 768x160) + walk-contact.png.
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import garments as G

args = sys.argv[sys.argv.index("--") + 1:]
HUSTLE, GDIR, OUT = args[0], args[1], args[2]
ONLY = set(args[3:])
os.makedirs(OUT, exist_ok=True)

FW, FH, NF = 96, 160, 8
PPM = 76.0            # pixels per metre (same for every variant, so children come out smaller)
FOOT_PX = 16          # ground point (origin) this many px above the frame bottom; striding feet reach ~10 px lower
ELEV = math.degrees(math.atan(0.5))  # 26.57 deg: exact 2:1 isometric tiles
CAM_AZ = -45.0        # camera azimuth (deg) around Z, i.e. the front camera rotated 45 deg

DARK, MEDIUM = (0.25, 0.14, 0.08), (0.42, 0.25, 0.14)


# ------------------------------------------------------------------ camera / directions
def cam_axes():
    az, el = math.radians(CAM_AZ), math.radians(ELEV)
    to_cam = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
    right = Vector((-math.sin(az), math.cos(az), 0))
    up = to_cam.cross(right).normalized()
    if up.z < 0:
        up = -up
    return to_cam, right, up


def facing_angle(sx, sy_down):
    """Z rotation (deg) that makes a character (facing -Y at rest) walk towards that screen direction."""
    to_cam, right, _ = cam_axes()
    toward = Vector((to_cam.x, to_cam.y, 0)).normalized()
    g = right * sx + toward * sy_down
    # facing(theta) = (sin t, -cos t)
    return math.degrees(math.atan2(g.x, -g.y))


DIRS = {"se": (1, 1), "sw": (-1, 1), "ne": (1, -1), "nw": (-1, -1)}


def setup_camera(scene):
    to_cam, right, up = cam_axes()
    cam = bpy.data.objects.new("isocam", bpy.data.cameras.new("isocam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "VERTICAL"
    cam.data.ortho_scale = FH / PPM
    centre = up * ((FH / 2 - FOOT_PX) / PPM / 1.0)
    # the ground origin must land FOOT_PX above the bottom: shift the view centre up along screen-up,
    # measured on the image plane (up is already the image-plane up vector)
    cam.location = centre + to_cam * 20
    cam.rotation_euler = (-to_cam).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 100
    scene.camera = cam
    return cam


# ------------------------------------------------------------------ outfit helpers
def region_paint(body, arm, rule, mats):
    """rule(centre_rest, dominant_bone_set, L) -> material key or None (skin). Assigns per-face materials."""
    me = body.data
    keys = list(mats)
    for k in keys:
        me.materials.append(mats[k])
    names = {g.index: g.name for g in body.vertex_groups}
    dom = []
    for v in me.vertices:
        g = max(v.groups, key=lambda g: g.weight, default=None)
        dom.append(bucket(names[g.group]) if g else "root")
    bones = arm.data.bones
    L = {
        "neck": bones["neck_01"].head_local.z, "hip": bones["thigh_l"].head_local.z,
        "knee": bones["calf_l"].head_local.z, "ankle": bones["foot_l"].head_local.z,
        "waist": bones["spine_01"].head_local.z + 0.03, "sh_x": bones["upperarm_l"].head_local.x,
        "elbow_x": bones["lowerarm_l"].head_local.x, "wrist_x": bones["hand_l"].head_local.x,
    }
    for p in me.polygons:
        c = p.center
        k = rule(c, {dom[i] for i in p.vertices}, L)
        if k:
            p.material_index = 1 + keys.index(k)


def bind_garment(arm, path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "MESH":
            mw = o.matrix_world.copy()
            o.parent = arm
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_basis = mw
            for m in o.modifiers:
                if m.type == "ARMATURE":
                    m.object = arm
    for o in new:
        if o.type != "MESH" or o.name.startswith("Icosphere"):
            bpy.data.objects.remove(o)


def attach_rest(arm, obj, bone):
    """Parent an object modelled in rest-pose world space to a bone."""
    b = arm.data.bones[bone]
    pm = arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_parent_inverse = pm.inverted()
    obj.matrix_basis = mw


def backpack(arm, body, rgb):
    bones = arm.data.bones
    zc = bones["spine_02"].head_local.z + 0.06
    back = max(v.co.y for v in body.data.vertices if abs(v.co.z - zc) < 0.12 and abs(v.co.x) < 0.12)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.26, 0.12, 0.32), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.025, segments=2, affect="EDGES")
    bmesh.ops.translate(bm, vec=(0, back + 0.065, zc), verts=bm.verts)
    o = obj_from_bm(bm, "backpack", make_mat("backpack", rgb))
    attach_rest(arm, o, "spine_03")
    return o


def shoes(c, ds, L, extra=0.03):
    return c.z < L["ankle"] + extra and not (ds & {"hand_l", "hand_r"})


def is_arm(ds):
    return bool(ds & {"upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "hand_l", "hand_r"})


def top_rule(c, ds, L, sleeve):
    """Shirt region: torso from the hips up to the neck base, arms out to `sleeve` (0..1 of shoulder->wrist)."""
    if "Head" in ds:
        return False
    if is_arm(ds) and not (ds & TORSO):  # T-pose at rest: arms are horizontal
        return abs(c.x) < L["sh_x"] + (L["wrist_x"] - L["sh_x"]) * sleeve
    if ds & {"clavicle_l", "clavicle_r"}:
        return True
    return L["hip"] + 0.02 < c.z < L["neck"] + 0.005


def pinafore(arm, body, rgb):
    """Navy school pinafore: loose sleeveless dress from the chest to just above the knee."""
    F = G.Fit(arm, body)
    p = G.Part()
    zt = F.z_shoulder - 0.07
    hem = F.z_knee + 0.06
    zs = G.levels(zt, hem, 0.045)
    rings = F.body_loft(zs, TORSO | UPPERLEGS | LEGS, 24,
                        lambda z, a: lerp(0.02, 0.07, smoothstep(F.z_waist, hem, z)), shoulders=False)
    v, f = G.grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    o = F.finish(p, "pinafore", make_mat("pinafore", rgb))
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
    return o


# ------------------------------------------------------------------ variants
def v_woman_buba(arm, body):
    paint_body(body, DARK)
    bind_garment(arm, os.path.join(GDIR, "garment-woman-buba_wrapper.glb"))
    region_paint(body, arm, lambda c, ds, L: "sandal" if shoes(c, ds, L, 0.0) else None, {"sandal": make_mat("sandal", (0.35, 0.18, 0.06))})
    attach_hair(arm, os.path.join(HUSTLE, "hair-Female", "hair-braids.glb"))


def v_woman_gele(arm, body):
    paint_body(body, MEDIUM)
    bind_garment(arm, os.path.join(GDIR, "garment-woman-peplum_gown.glb"))
    region_paint(body, arm, lambda c, ds, L: "shoe" if shoes(c, ds, L, 0.0) else None, {"shoe": make_mat("shoe", (0.75, 0.55, 0.1))})
    attach_hair(arm, os.path.join(HUSTLE, "hair-Female", "hair-gele.glb"))


def v_man_kaftan(arm, body):
    paint_body(body, DARK)
    bind_garment(arm, os.path.join(GDIR, "garment-man-kaftan.glb"))
    navy = (0.12, 0.16, 0.37)

    def rule(c, ds, L):
        if shoes(c, ds, L):
            return "shoe"
        if not is_arm(ds) and c.z < L["hip"] + 0.05:
            return "trouser"
        return None
    region_paint(body, arm, rule, {"shoe": make_mat("shoe", (0.05, 0.04, 0.03)), "trouser": make_mat("trouser", navy)})
    attach_hair(arm, os.path.join(HUSTLE, "hair-Male", "hair-low_cut.glb"))


def v_man_casual(arm, body):
    paint_body(body, MEDIUM)

    def rule(c, ds, L):
        if shoes(c, ds, L, 0.04):
            return "sneaker"
        if not is_arm(ds) and c.z < L["hip"] + 0.06:
            return "jeans"
        if top_rule(c, ds, L, 0.28):
            return "tee"
        return None
    region_paint(body, arm, rule, {"sneaker": make_mat("sneaker", (0.92, 0.92, 0.9)), "jeans": make_mat("jeans", (0.12, 0.22, 0.48)),
                                   "tee": make_mat("tee", (0.78, 0.09, 0.07))})
    attach_hair(arm, os.path.join(HUSTLE, "hair-Male", "hair-high_top.glb"))


def kid_rule(top_key, bottom_key, bottom_to_knee):
    def rule(c, ds, L):
        if shoes(c, ds, L, 0.02):
            return "shoe"
        if not is_arm(ds) and c.z < L["ankle"] + 0.2:
            return "sock"
        if not is_arm(ds) and c.z < L["hip"] + 0.06 and c.z > L["knee"] + bottom_to_knee:
            return bottom_key
        if top_rule(c, ds, L, 0.3):
            return top_key
        return None
    return rule


def v_schoolgirl(arm, body):
    paint_body(body, MEDIUM)
    navy = (0.08, 0.1, 0.3)
    region_paint(body, arm, kid_rule("blouse", "skirt", 0.06), {
        "shoe": make_mat("shoe", (0.03, 0.03, 0.03)), "sock": make_mat("sock", (0.95, 0.95, 0.95)),
        "skirt": make_mat("skirt", navy), "blouse": make_mat("blouse", (0.62, 0.78, 0.95))})
    pinafore(arm, body, navy)
    attach_hair(arm, os.path.join(HUSTLE, "hair-Female", "hair-puff.glb"))
    backpack(arm, body, (0.75, 0.12, 0.35))
    arm.scale = (0.72, 0.72, 0.72)


def v_schoolboy(arm, body):
    paint_body(body, DARK)
    region_paint(body, arm, kid_rule("shirt", "shorts", 0.1), {
        "shoe": make_mat("shoe", (0.03, 0.03, 0.03)), "sock": make_mat("sock", (0.95, 0.95, 0.95)),
        "shorts": make_mat("shorts", (0.45, 0.42, 0.22)), "shirt": make_mat("shirt", (0.95, 0.95, 0.93))})
    attach_hair(arm, os.path.join(HUSTLE, "hair-Male", "hair-low_cut.glb"))
    backpack(arm, body, (0.12, 0.35, 0.65))
    arm.scale = (0.72, 0.72, 0.72)


VARIANTS = [
    ("woman_buba", "Female", v_woman_buba),
    ("woman_gele", "Female", v_woman_gele),
    ("man_kaftan", "Male", v_man_kaftan),
    ("man_casual", "Male", v_man_casual),
    ("schoolgirl", "Female", v_schoolgirl),
    ("schoolboy", "Male", v_schoolboy),
]


# ------------------------------------------------------------------ rendering
def read_png(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return a


def write_png(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new("out", w, h, alpha=True)
    img.pixels = arr.reshape(-1).tolist()
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def sync_viewport_colors():
    """Workbench uses material.diffuse_color: copy the glTF base colours into it (hair, garments, brows)."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not b:
            continue
        bc = b.inputs["Base Color"]
        if not bc.links:
            m.diffuse_color = tuple(bc.default_value)
            continue
        src = bc.links[0].from_node  # glTF importer: vertex colour x factor through a Mix node
        for i in src.inputs:
            if i.type == "RGBA" and not i.links:
                m.diffuse_color = tuple(i.default_value)
                break


def render_variant(name, sex, fn, tmp):
    arm, body, others = load_body(os.path.join(HUSTLE, f"body-{sex}.glb"))
    skin = body.material_slots[0].material
    fn(arm, body)
    keep = tuple(skin.diffuse_color)
    sync_viewport_colors()
    skin.diffuse_color = keep
    arm.rotation_mode = "XYZ"
    scene = bpy.context.scene
    look = os.environ.get("LOOK", "studio")
    workbench(scene, FW, FH, outline=True, light="FLAT" if look == "flat" else "STUDIO")
    sh = scene.display.shading
    sh.object_outline_color = (0.05, 0.03, 0.02)
    sh.show_specular_highlight = False
    sh.show_cavity = look != "flat"
    sh.cavity_type = "WORLD"
    sh.cavity_ridge_factor, sh.cavity_valley_factor = 0.6, 1.0
    if look == "flat":
        sh.show_cavity = False
    scene.display.render_aa = "8"
    setup_camera(scene)
    act = bpy.data.actions["Walk_Loop"]
    f0, f1 = 1.0, 33.0  # one full cycle (frame 33 == frame 1)
    frames0 = {}
    for d, (sx, sy) in DIRS.items():
        arm.rotation_euler = (0, 0, math.radians(facing_angle(sx, sy)))
        sheet = np.zeros((FH, FW * NF, 4), dtype=np.float32)
        for i in range(NF):
            set_action(arm, "Walk_Loop", f0 + (f1 - f0) * i / NF)
            p = os.path.join(tmp, f"{name}-{d}-{i}.png")
            scene.render.filepath = p
            bpy.ops.render.render(write_still=True)
            a = read_png(p)
            sheet[:, i * FW:(i + 1) * FW] = a
            if i == 0:
                frames0[d] = a
        write_png(sheet, os.path.join(OUT, f"walk-{name}-{d}.png"))
        print("SHEET", name, d, "rot", round(facing_angle(sx, sy), 1))
    return frames0


tmp = os.path.join(OUT, "_frames")
os.makedirs(tmp, exist_ok=True)
contact = {}
for name, sex, fn in VARIANTS:
    if ONLY and name not in ONLY:
        continue
    contact[name] = render_variant(name, sex, fn, tmp)

# contact sheet: rows = variants, columns = se, sw, ne, nw (frame 1), on a light ground with a tile grid hint
rows = list(contact)
cs = np.zeros((FH * len(rows), FW * 4, 4), dtype=np.float32)
cs[..., :3] = 0.9
cs[..., 3] = 1
for r, name in enumerate(reversed(rows)):  # numpy rows are bottom-up in Blender images
    for c, d in enumerate(DIRS):
        a = contact[name][d]
        y0, x0 = r * FH, c * FW
        al = a[..., 3:4]
        cs[y0:y0 + FH, x0:x0 + FW, :3] = a[..., :3] * al + cs[y0:y0 + FH, x0:x0 + FW, :3] * (1 - al)
        cs[y0 + FOOT_PX, x0:x0 + FW, :3] = (0.7, 0.4, 0.4)  # ground line marker
write_png(cs, os.path.join(OUT, "walk-contact.png" if not ONLY else "walk-contact-partial.png"))
print("DONE", rows)
