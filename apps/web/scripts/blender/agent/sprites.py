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


# ------------------------------------------------------------------ toon look (LOOK=toon)
SS = 2                                   # supersample factor (render 2x, box-filter down)
OUTLINE_SRGB = (0x1b / 255, 0x14 / 255, 0x10 / 255)
TOON_LIGHT = None                        # set in setup_toon: key light up and to the left of the camera


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def toon_palette(rgb, name):
    """Richer colours: more saturation; greys/whites become warm off-white; eyes/brows dark."""
    import colorsys
    n = name.lower()
    if "eye" in n and "brow" not in n:
        return (0.02, 0.012, 0.008)
    if "brow" in n or n.startswith("mi_hair"):
        return (0.015, 0.01, 0.006)
    # The outfit colours are treated as display (sRGB) colours, then converted to linear for the emission
    # shader, so dark skin stays a rich brown instead of washing out to tan.
    r, g, b = rgb[:3]
    h, sat, v = colorsys.rgb_to_hsv(r, g, b)
    if n.startswith("mi_superhero"):     # skin: lift to a readable warm brown (the shadow band darkens it)
        out = colorsys.hsv_to_rgb(h, min(1.0, sat * 1.05), min(1.0, v * 1.55))
    elif sat < 0.16 and v > 0.6:         # whites / cream: warm off-white instead of grey
        out = (0.98 * v / 0.93, 0.94 * v / 0.93, 0.84 * v / 0.93)
    else:
        out = colorsys.hsv_to_rgb(h, min(1.0, sat * 1.1), min(1.0, v * 1.04))
    return tuple(srgb_to_lin(min(1.0, c)) for c in out)


def toon_material(src, cache):
    if src.name in cache:
        return cache[src.name]
    base = toon_palette(tuple(src.diffuse_color), src.name)
    m = bpy.data.materials.new("toon_" + src.name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = TOON_LIGHT
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY_ADD"
    fac.inputs[1].default_value, fac.inputs[2].default_value = 0.5, 0.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    shadow = (base[0] * 0.58, base[1] * 0.52, base[2] * 0.64)          # cool, darker shadow band
    lit = (min(1, base[0] * 1.18), min(1, base[1] * 1.1), min(1, base[2] * 0.98))  # warm highlight band
    cr.elements[0].position, cr.elements[0].color = 0.0, (*shadow, 1)
    cr.elements[1].position, cr.elements[1].color = 0.44, (*base, 1)
    e = cr.elements.new(0.8)
    e.color = (*lit, 1)
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], fac.inputs[0])
    nt.links.new(fac.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    cache[src.name] = m
    return m


def setup_toon(scene):
    global TOON_LIGHT
    to_cam, right, up = cam_axes()
    TOON_LIGHT = tuple((-right * 0.55 + Vector((0, 0, 1)) * 0.75 + to_cam * 0.35).normalized())
    cache = {}
    for o in bpy.data.objects:
        if o.type == "MESH":
            for slot in o.material_slots:
                if slot.material:
                    slot.material = toon_material(slot.material, cache)
    print("TOON materials", sorted(cache))
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.max_bounces = 0
    scene.cycles.filter_width = 1.0
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.resolution_x, scene.render.resolution_y = FW * SS, FH * SS
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("w")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Strength"].default_value = 0.0
    # Freestyle outlines: silhouette, open borders (hems, sleeve ends), material boundaries, contours
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = "ABSOLUTE"
    scene.render.line_thickness = 1.0
    vl = bpy.context.view_layer
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.mode = "EDITOR"
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("outline")
    ls.select_by_visibility = True
    ls.visibility = "VISIBLE"
    ls.select_by_edge_types = True
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_material_boundary = True
    ls.select_external_contour = True
    ls.select_contour = True
    ls.select_crease = False
    st = ls.linestyle or bpy.data.linestyles.new("ink")
    ls.linestyle = st
    st.color = tuple(srgb_to_lin(c) for c in OUTLINE_SRGB)
    st.thickness = float(os.environ.get("TOON_LINE", "4.0"))   # at 2x: ~2 px after downscale
    st.thickness_position = "CENTER"
    st.alpha = 1.0
    st.use_length_min = True             # drop short muscle/fold squiggles
    st.length_min = 7.0 * SS


def downsample(a):
    if SS == 1:
        return a
    h, w = a.shape[0] // SS, a.shape[1] // SS
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4]
    pm = pm.reshape(h, SS, w, SS, 4).mean(axis=(1, 3))
    al = pm[..., 3:4]
    pm[..., :3] = np.where(al > 1e-4, pm[..., :3] / np.maximum(al, 1e-4), 0)
    return pm


LIBRARY_FBX = os.path.join(HUSTLE, "al_ue.fbx")   # Quaternius Universal Animation Library (Unreal rig)


def import_library_actions(names):
    """Copy extra clips (e.g. Sitting_Talking_Loop) from the UAL fbx onto the scene; the fbx objects are removed."""
    before_o, before_a = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=LIBRARY_FBX)
    for a in list(bpy.data.actions):
        if a in before_a:
            continue
        short = a.name.split("|")[-1]
        if short in names and short not in bpy.data.actions:
            a.name = short
            a.use_fake_user = True
            # keep bone channels only: the fbx clip also keys the rig object's transform, which would
            # override the direction rotation we set on the armature object
            for layer in a.layers:
                for st in layer.strips:
                    for cb in st.channelbags:
                        for fc in [f for f in cb.fcurves if not f.data_path.startswith("pose.bones")]:
                            cb.fcurves.remove(fc)
        else:
            bpy.data.actions.remove(a)
    for o in list(bpy.data.objects):
        if o not in before_o:
            bpy.data.objects.remove(o)


def prepare_variant(name, sex, fn, extra_actions=()):
    arm, body, others = load_body(os.path.join(HUSTLE, f"body-{sex}.glb"))
    if extra_actions:
        import_library_actions(extra_actions)
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
    if look == "toon":
        setup_toon(scene)
        if arm.scale[0] < 0.9:  # children: thinner ink so their slim legs don't turn into solid lines
            for ls in bpy.context.view_layer.freestyle_settings.linesets:
                ls.linestyle.thickness = float(os.environ.get("TOON_LINE", "4.0")) * 0.75
    return arm, scene, look


def render_variant(name, sex, fn, tmp):
    arm, scene, look = prepare_variant(name, sex, fn)
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
            if look == "toon":
                a = downsample(a)
            sheet[:, i * FW:(i + 1) * FW] = a
            if i == 0:
                frames0[d] = a
        write_png(sheet, os.path.join(OUT, f"walk-{name}-{d}.png"))
        print("SHEET", name, d, "rot", round(facing_angle(sx, sy), 1))
    return frames0


# ------------------------------------------------------------------ interior poses (POSE=1)
# action -> (base clip, variants). Directions: se/sw only (interiors are seen from the front).
POSES = {
    "sit_eat": ("Sitting_Idle_Loop", ["woman_buba", "man_kaftan", "man_casual", "woman_gele"]),
    "sit_talk": ("Sitting_Talking_Loop", ["woman_buba", "man_kaftan", "man_casual", "woman_gele", "schoolgirl", "schoolboy"]),
    "stand_idle": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"]),
    "serve": (os.environ.get("SERVE_BASE", "Idle_Talking_Loop"), ["woman_buba", "man_casual"]),
    "dance": ("Dance_Loop", ["woman_gele", "man_kaftan", "woman_buba"]),
}
POSE_DIRS = {"se": DIRS["se"], "sw": DIRS["sw"]}


def ik_hand(arm, side):
    """IK on the forearm (2-bone chain) towards an empty parented to the armature object."""
    e = bpy.data.objects.new(f"ik_{side}", None)
    bpy.context.scene.collection.objects.link(e)
    e.parent = arm
    c = arm.pose.bones[f"lowerarm_{side}"].constraints.new("IK")
    c.target = e
    c.chain_count = 2
    c.use_tail = True
    return e, c


def clear_ik(arm):
    for pb in arm.pose.bones:
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    for o in list(bpy.data.objects):
        if o.name.startswith("ik_"):
            bpy.data.objects.remove(o)


def bone_pos(arm, name):
    return arm.pose.bones[name].head.copy()  # armature space (follows the object's rotation and scale)


def body_point(arm, bone, offset):
    """A point fixed to a bone: `offset` is given in the rest-pose axes (x = character's left, -y = forward,
    z = up) relative to the bone head, then carried along with the bone's current pose (twist, lean)."""
    pb = arm.pose.bones[bone]
    delta = pb.matrix @ pb.bone.matrix_local.inverted()
    return delta @ (pb.bone.head_local + Vector(offset))


def pose_frames(arm, action, base):
    """Generator: sets up frame i of the pose loop (0..NF-1)."""
    act = bpy.data.actions[base]
    f0, f1 = act.frame_range
    span = f1 - f0
    clear_ik(arm)
    hooks = None
    if action in ("sit_eat", "serve", "dance"):
        er, cr = ik_hand(arm, "r")
        el, cl = ik_hand(arm, "l")
        cr.influence = cl.influence = 0.0
        hooks = (er, cr, el, cl)
    for i in range(NF):
        t = i / NF
        set_action(arm, base, f0 + span * t)
        if hooks:
            er, cr, el, cl = hooks
            cr.influence = cl.influence = 0.0
            bpy.context.view_layer.update()
            if action == "sit_eat":
                # left hand holds the bowl above the lap; right hand goes bowl -> mouth -> bowl once per loop
                k = smoothstep(0.0, 1.0, 0.5 - 0.5 * math.cos(2 * math.pi * t))
                bowl = body_point(arm, "spine_01", (-0.05, -0.3, 0.05))
                mouth = body_point(arm, "Head", (-0.02, -0.13, 0.03))
                er.location = bowl.lerp(mouth, k)
                el.location = body_point(arm, "spine_01", (0.07, -0.28, 0.02))
            elif action == "dance":
                # owambe: both hands up around head height, waving/swaying in alternation over the clip
                a = 2 * math.pi * t
                er.location = body_point(arm, "spine_03", (-0.36 - 0.06 * math.sin(a), -0.08, 0.4 + 0.09 * math.sin(a)))
                el.location = body_point(arm, "spine_03", (0.36 - 0.06 * math.sin(a), -0.08, 0.4 - 0.09 * math.sin(a)))
            else:  # serve: left hand steadies a pot at waist height, right hand stirs a small circle
                a = 2 * math.pi * t
                er.location = body_point(arm, "spine_01", (-0.15 + 0.05 * math.cos(a), -0.34 + 0.05 * math.sin(a), 0.13))
                el.location = body_point(arm, "spine_01", (0.17, -0.3, 0.1))
            cr.influence = cl.influence = 1.0
            bpy.context.view_layer.update()
        yield i


def clip_yaw(arm, base):
    """Yaw (deg) of the body's facing in this clip relative to the rig's -Y (some idles stand turned)."""
    rot = tuple(arm.rotation_euler)
    arm.rotation_euler = (0, 0, 0)
    act = bpy.data.actions[base]
    set_action(arm, base, act.frame_range[0])
    bpy.context.view_layer.update()
    P = lambda b: arm.pose.bones[b].head
    across = (P("upperarm_l") - P("upperarm_r")) + (P("thigh_l") - P("thigh_r"))
    f = across.cross(Vector((0, 0, 1)))
    arm.rotation_euler = rot
    # facing(theta) = (sin t, -cos t)  ->  theta = atan2(f.x, -f.y)
    return math.degrees(math.atan2(f.x, -f.y))


def render_poses(name, sex, fn, jobs, tmp):
    bases = sorted({POSES[a][0] for a in jobs})
    arm, scene, look = prepare_variant(name, sex, fn, extra_actions=[b for b in bases if b not in bpy.data.actions] if False else
                                        [b for b in bases if b == "Sitting_Talking_Loop"])
    first = {}
    for action in jobs:
        base = POSES[action][0]
        yaw = clip_yaw(arm, base)
        print("CLIP", base, "body yaw", round(yaw, 1))
        for d, (sx, sy) in POSE_DIRS.items():
            arm.rotation_euler = (0, 0, math.radians(facing_angle(sx, sy) - yaw))
            sheet = np.zeros((FH, FW * NF, 4), dtype=np.float32)
            for i in pose_frames(arm, action, base):
                p = os.path.join(tmp, f"{action}-{name}-{d}-{i}.png")
                scene.render.filepath = p
                bpy.ops.render.render(write_still=True)
                a = read_png(p)
                if look == "toon":
                    a = downsample(a)
                sheet[:, i * FW:(i + 1) * FW] = a
                if i == 0:
                    first[(action, d)] = a
            write_png(sheet, os.path.join(OUT, f"{action}-{name}-{d}.png"))
            print("SHEET", action, name, d)
    clear_ik(arm)
    return first


def contact_sheet(cells, ncols, path):
    """cells: list of rows, each a list of RGBA frames (or None)."""
    rows = len(cells)
    cs = np.zeros((FH * rows, FW * ncols, 4), dtype=np.float32)
    cs[..., :3] = 0.9
    cs[..., 3] = 1
    for r, row in enumerate(reversed(cells)):  # numpy rows are bottom-up in Blender images
        for c, a in enumerate(row):
            y0, x0 = r * FH, c * FW
            if a is not None:
                al = a[..., 3:4]
                cs[y0:y0 + FH, x0:x0 + FW, :3] = a[..., :3] * al + cs[y0:y0 + FH, x0:x0 + FW, :3] * (1 - al)
            cs[y0 + FOOT_PX, x0:x0 + FW, :3] = (0.7, 0.4, 0.4)  # ground line marker
    write_png(cs, path)


if os.environ.get("POSE"):
    tmp = os.path.join(OUT, "_frames")
    os.makedirs(tmp, exist_ok=True)
    only_actions = set(os.environ["POSE"].split(",")) if os.environ["POSE"] not in ("1", "all") else set(POSES)
    got = {}
    for name, sex, fn in VARIANTS:
        if ONLY and name not in ONLY:
            continue
        jobs = [a for a in POSES if a in only_actions and name in POSES[a][1]]
        if jobs:
            got[name] = render_poses(name, sex, fn, jobs, tmp)
    # contact sheet: one row per action, columns = variant x (se, sw) for that action
    cells = []
    for action in POSES:
        row = []
        for name in POSES[action][1]:
            for d in POSE_DIRS:
                row.append(got.get(name, {}).get((action, d)))
        if any(x is not None for x in row):
            cells.append(row)
    ncols = max(len(r) for r in cells)
    cells = [r + [None] * (ncols - len(r)) for r in cells]
    contact_sheet(cells, ncols, os.path.join(OUT, "poses-contact.png"))
    print("DONE poses")
    sys.exit(0)


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
