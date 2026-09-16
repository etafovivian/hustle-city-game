# Isometric walking sprite sheets rendered from the rigged bodies (+ garments from garments.py, hair).
#   blender -b -P sprites.py -- <hustle_dir> <garment_dir> <outdir> [variant ...]
# hustle_dir holds body-Male.glb, body-Female.glb, hair-Male/, hair-Female/. garment_dir holds the
# garment-*.glb files from garments.py (used for the traditional outfits; re-bound to the body skeleton).
# Output: walk-{variant}-{se|sw|ne|nw}.png (8 frames of 96x160 in a row = 768x160) + walk-contact.png.
# Staff in uniform (nurse, doctor, chef, waiter, bartender) are variants too. With POSE=<actions> it renders pose
# sheets instead (POSES), including the work poses (WORK_ACTIONS, see render_work), e.g.
#   LOOK=toon POSE=stand_idle,check_patient,write_chart blender -b -P sprites.py -- ~/hustle <garments> <out> nurse doctor
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
    head_cover(arm, body, os.path.join(HUSTLE, "hair-Female", "hair-braids.glb"))


def v_woman_gele(arm, body):
    paint_body(body, MEDIUM)
    bind_garment(arm, os.path.join(GDIR, "garment-woman-peplum_gown.glb"))
    region_paint(body, arm, lambda c, ds, L: "shoe" if shoes(c, ds, L, 0.0) else None, {"shoe": make_mat("shoe", (0.75, 0.55, 0.1))})
    head_cover(arm, body, os.path.join(HUSTLE, "hair-Female", "hair-gele.glb"))


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


# ------------------------------------------------------------------ the players' outfits (profile.ts AVATAR_OPTIONS)
# One variant per body and outfit, named "<body>-<outfit>", painted with the outfit colours from Avatar3D.tsx OUTFITS
# (sRGB hex). Loose garments come from the garment GLBs (recoloured); the woman's kaftan is built on her body here.
def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


# top, sleeve (0..1 of shoulder to wrist), bottom, bottom length ("ankle" or "knee": shorts), feet, garment
OUTFIT_LOOK = {
    "ankara_green": ("#00a859", 0.28, "#1b2238", "ankle", "#6b3b1f", None),
    "agbada_white": (None, 0, "#e4ddcb", "ankle", "#5a3a22", ("agbada", "#ece6d6")),
    "kaftan_gold": (None, 0, "#c9921a", "ankle", "#5a3a22", ("kaftan", "#d9a21f")),
    "jersey_red": ("#df382b", 0.28, "#151515", "knee", "#f2f2f2", None),
    "tee_blue": ("#1e2a5e", 0.28, "#3b5b8a", "ankle", "#f2f2f2", None),
    "hoodie_black": ("#25282b", 0.97, "#4a4f55", "ankle", "#f2f2f2", None),
    "buba_wrapper": (None, 0, None, "ankle", "#c9921a", ("buba_wrapper", "#0f7b6c")),
    "peplum_coral": (None, 0, None, "ankle", "#c9921a", ("peplum_gown", "#e4572e")),
}
OUTFIT_BODIES = {
    "man": ["agbada_white", "kaftan_gold", "ankara_green", "jersey_red", "tee_blue", "hoodie_black"],
    "woman": ["buba_wrapper", "peplum_coral", "ankara_green", "kaftan_gold", "tee_blue", "jersey_red", "hoodie_black"],
}


def recolour_new(before, rgb, name):
    """Give every mesh imported since `before` one plain material of colour `rgb`."""
    for o in bpy.data.objects:
        if o in before or o.type != "MESH":
            continue
        mat = make_mat(name, rgb)
        o.data.materials.clear()
        o.data.materials.append(mat)


def head_cover(arm, body, path):
    """Hair, or with HIJAB=1 (the salah sheets) a headscarf for the women's looks."""
    if os.environ.get("HIJAB") and "hair-Female" in path:
        return hijab(arm, body)
    return attach_hair(arm, path)


def outfit_variant(body_key, outfit):
    top, sleeve, bottom, length, feet, garment = OUTFIT_LOOK[outfit]

    def fn(arm, body):
        paint_body(body, DARK if body_key == "man" else MEDIUM)
        if garment:
            key, hexc = garment
            path = os.path.join(GDIR, f"garment-{body_key}-{key}.glb")
            if os.path.exists(path):
                before = set(bpy.data.objects)
                bind_garment(arm, path)
                recolour_new(before, hexrgb(hexc), key)
            else:  # no GLB for this body (the woman's kaftan): build it on this body
                F = G.Fit(arm, body)
                G.build_kaftan(F, make_mat(key, hexrgb(hexc)))
                arm.animation_data.action = None
                for pb in arm.pose.bones:
                    pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)

        def rule(c, ds, L):
            if shoes(c, ds, L, 0.04 if feet == "#f2f2f2" else 0.02):
                return "feet"
            if bottom and not is_arm(ds) and c.z < L["hip"] + 0.06:
                if length == "knee" and c.z < L["knee"] - 0.02:
                    return None
                return "bottom"
            if top and top_rule(c, ds, L, sleeve):
                return "top"
            return None
        mats = {"feet": make_mat("feet", hexrgb(feet))}
        if bottom:
            mats["bottom"] = make_mat("bottom", hexrgb(bottom))
        if top:
            mats["top"] = make_mat("top", hexrgb(top))
        region_paint(body, arm, rule, mats)
        hair = "gele" if outfit == "peplum_coral" else ("low_cut" if body_key == "man" else "braids")
        head_cover(arm, body, os.path.join(HUSTLE, "hair-Male" if body_key == "man" else "hair-Female", f"hair-{hair}.glb"))
    return fn


OUTFIT_VARIANTS = [(f"{b}-{o}", "Male" if b == "man" else "Female", outfit_variant(b, o)) for b, os_ in OUTFIT_BODIES.items() for o in os_]
OUTFIT_NAMES = [n for n, _, _ in OUTFIT_VARIANTS]


VARIANTS = [
    ("woman_buba", "Female", v_woman_buba),
    ("woman_gele", "Female", v_woman_gele),
    ("man_kaftan", "Male", v_man_kaftan),
    ("man_casual", "Male", v_man_casual),
    ("schoolgirl", "Female", v_schoolgirl),
    ("schoolboy", "Male", v_schoolboy),
] + OUTFIT_VARIANTS


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
    "sit_eat": ("Sitting_Idle_Loop", ["woman_buba", "man_kaftan", "man_casual", "woman_gele", "schoolgirl", "schoolboy"] + OUTFIT_NAMES),
    "sit_talk": ("Sitting_Talking_Loop", ["woman_buba", "man_kaftan", "man_casual", "woman_gele", "schoolgirl", "schoolboy"] + OUTFIT_NAMES),
    "stand_idle": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"] + OUTFIT_NAMES),
    "serve": (os.environ.get("SERVE_BASE", "Idle_Talking_Loop"), ["woman_buba", "man_casual"]),
    "dance": ("Dance_Loop", ["woman_gele", "man_kaftan", "woman_buba", "man_casual"] + OUTFIT_NAMES),
    # The library has no lying clip: the first Idle_Loop frame is held and laid flat on its back (see lie_down),
    # with the chest rising and falling once per loop.
    "sleep": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"] + OUTFIT_NAMES),
    # Prayer: posed bone by bone (see apply_pose); every adult look, so a player can pray in what they wear.
    "pray_salah": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    "pray_church": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    "kneel_pray": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    # Workouts: run is the library's jog; the rest are posed (see exercise_frames), with dumbbells, gloves or a rope.
    "run": ("Jog_Fwd_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    "lift_weights": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    "boxing": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    "pushups": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
    "skip_rope": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual"] + OUTFIT_NAMES),
}
# Lying sheets are wider than tall: 8 frames of 192x112, cropped so the middle of the body is the centre of the
# frame (it is anchored on the middle of the mattress). Directions: se = feet towards the bottom right (head up-left), sw = feet bottom left.
SLEEP_W, SLEEP_H = 192, 112
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
                bowl = body_point(arm, "spine_01", (0.0, -0.36, 0.12))
                mouth = body_point(arm, "Head", (-0.02, -0.13, 0.03))
                er.location = bowl.lerp(mouth, k)
                el.location = body_point(arm, "spine_01", (0.06, -0.36, 0.09))
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


def lie_down(arm, base, sx, sy):
    """Holds the first frame of `base` and lays the body flat on its back, feet towards screen direction (sx, sy),
    with the middle of the body over the origin and its back on the ground plane (the mattress)."""
    arm.location = (0, 0, 0)
    arm.rotation_euler = (0, 0, 0)
    act = bpy.data.actions[base]
    set_action(arm, base, act.frame_range[0])
    bpy.context.view_layer.update()
    yaw = clip_yaw(arm, base)
    set_action(arm, base, act.frame_range[0])
    bpy.context.view_layer.update()
    arm.animation_data.action = None  # keep the evaluated pose; breathing is set on the bones by hand
    # Legs straight and together (the idle stance is wide): back to the rest pose from the hips down.
    for b in ("pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r"):
        pb = arm.pose.bones.get(b)
        if pb:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.rotation_euler = (0, 0, 0)
            if b != "pelvis":
                pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    # Rz(-yaw): face -Y; Rx(-90): head +Y, face up; Rz(phi): head away from the feet direction.
    phi = math.radians(facing_angle(sx, sy))
    rot = Matrix.Rotation(phi, 4, "Z") @ Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Rotation(math.radians(-yaw), 4, "Z")
    arm.matrix_world = rot @ Matrix.Diagonal(arm.scale.to_4d())
    bpy.context.view_layer.update()
    lo, hi = body_bounds()
    arm.location = arm.location - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bpy.context.view_layer.update()


def body_bounds():
    dg = bpy.context.evaluated_depsgraph_get()
    lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    for o in bpy.data.objects:
        if o.type != "MESH" or o.hide_render:
            continue
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        mw = ev.matrix_world
        for v in m.vertices:
            w = mw @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    return lo, hi


def breathe(arm, t):
    """Chest up and down once per loop (the neck and arms keep their size)."""
    s = math.sin(2 * math.pi * t)
    for child in ("neck_01", "clavicle_l", "clavicle_r"):
        if child in arm.data.bones:
            arm.data.bones[child].inherit_scale = "NONE"
    if "spine_03" in arm.pose.bones:
        arm.pose.bones["spine_03"].scale = (1 + 0.03 * s, 1.0, 1 + 0.08 * s)
    if "spine_02" in arm.pose.bones:
        arm.pose.bones["spine_02"].scale = (1 + 0.01 * s, 1.0, 1 + 0.03 * s)
    bpy.context.view_layer.update()


def sleep_view(scene, on, keep={}):
    """Switches the camera and frame size to the lying sheets (on) and back (off)."""
    cam = scene.camera
    if on:
        keep.update(ortho=cam.data.ortho_scale, loc=cam.location.copy(), res=(scene.render.resolution_x, scene.render.resolution_y))
        to_cam, _, _ = cam_axes()
        # rendered twice as tall as the sheet frames, then cropped round the body (see render_sleep)
        cam.data.ortho_scale = 2 * SLEEP_H / PPM
        cam.location = to_cam * 20
        k = scene.render.resolution_x // FW
        scene.render.resolution_x, scene.render.resolution_y = SLEEP_W * k, 2 * SLEEP_H * k
    else:
        cam.data.ortho_scale = keep["ortho"]
        cam.location = keep["loc"]
        scene.render.resolution_x, scene.render.resolution_y = keep["res"]


def render_sleep(arm, scene, look, name, tmp, first):
    base = POSES["sleep"][0]
    sleep_view(scene, True)
    for d, (sx, sy) in POSE_DIRS.items():
        lie_down(arm, base, sx, sy)
        frames = []
        for i in range(NF):
            breathe(arm, i / NF)
            p = os.path.join(tmp, f"sleep-{name}-{d}-{i}.png")
            scene.render.filepath = p
            bpy.ops.render.render(write_still=True)
            a = read_png(p)
            if look == "toon":
                a = downsample(a)
            frames.append(a)
        # Crop every frame the same way: the body's visible middle (frame 0) becomes the frame centre, which is
        # where the sprite is anchored (the middle of the mattress).
        rows = np.where(frames[0][..., 3].max(axis=1) > 0.05)[0]
        mid = (rows.min() + rows.max()) // 2 if len(rows) else SLEEP_H
        y0 = int(min(max(mid - SLEEP_H // 2, 0), SLEEP_H))
        sheet = np.zeros((SLEEP_H, SLEEP_W * NF, 4), dtype=np.float32)
        for i, a in enumerate(frames):
            sheet[:, i * SLEEP_W:(i + 1) * SLEEP_W] = a[y0:y0 + SLEEP_H]
        first[("sleep", d)] = sheet[:, :SLEEP_W]
        write_png(sheet, os.path.join(OUT, f"sleep-{name}-{d}.png"))
        print("SHEET sleep", name, d)
    breathe(arm, 0.0)
    for pb in arm.pose.bones:
        pb.scale = (1, 1, 1)
    arm.location = (0, 0, 0)
    sleep_view(scene, False)


# ------------------------------------------------------------------ prayer (no library clip: posed bone by bone)
# A pose is a set of joint angles (degrees). They are applied from the rest (T) pose as turns about the armature's
# axes (x = the character's left, -y = forward, z = up), arms and head first, then the spine (which carries them),
# then the legs, so every angle reads in the body's own frame. Frames blend the angles between key poses.
PRAY_ADULTS = ["woman_buba", "woman_gele", "man_kaftan", "man_casual"]
PRAY_VARIANTS = PRAY_ADULTS + OUTFIT_NAMES if "OUTFIT_NAMES" in globals() else PRAY_ADULTS
# frame size per prayer sheet (salah reaches forward in prostration, so its frames are wider)
PRAY_FRAME = {"pray_salah": (144, 16), "pray_church": (96, 8), "kneel_pray": (96, 8)}
PRAY_DIRS = {"pray_salah": ["se", "sw", "nw"], "pray_church": ["se", "sw"], "kneel_pray": ["se", "sw"]}

STAND = dict(arm_down=82, arm_fwd=0, elbow=6, fore_in=0, arm_out=0, neck=0, head=0, sp1=0, sp2=0, sp3=0, side=0,
             hip=0, knee=0, ankle=0, toe=0)


def P(**kw):
    d = dict(STAND)
    d.update(kw)
    return d


SALAH_KEYS = {
    # qiyam: standing, right hand over left on the chest, eyes down
    "qiyam": P(arm_fwd=20, elbow=90, fore_in=70, head=14),
    # ruku: back flat, head in line, hands on the knees
    "ruku": P(sp1=80, sp2=12, sp3=0, neck=-30, head=-10, arm_fwd=62, elbow=4, hip=2),
    # i'tidal: standing upright, arms at the sides
    "itidal": P(head=6),
    # sujud: knees, toes, palms and forehead on the floor, elbows off it
    "sujud": P(sp1=64, sp2=50, sp3=38, neck=10, head=-18, arm_down=76, arm_fwd=146, elbow=84, hip=12, knee=102, ankle=-8, toe=-70),
    # jalsa / tashahhud: sitting back on the heels, hands on the thighs
    "jalsa": P(sp1=6, head=10, arm_fwd=15, elbow=45, hip=86, knee=158, ankle=58, toe=0),
}
# (key pose, hold frames) round the loop; the frame between two different poses is a blend
# qiyam, ruku, standing up, sujud, jalsa, sujud, then up to standing again (the loop starts over at qiyam)
SALAH_SEQ = ["qiyam", "qiyam", "qiyam", "ruku", "ruku", "itidal", "itidal", "sujud", "sujud", "jalsa", "jalsa",
             "sujud", "sujud", "jalsa", "itidal", "itidal"]
KNEEL = P(hip=0, knee=92, ankle=58, arm_fwd=30, elbow=104, fore_in=80, head=18, sp1=4)


def turn(arm, bone, axis, deg):
    if not deg or bone not in arm.pose.bones:
        return
    pb = arm.pose.bones[bone]
    bpy.context.view_layer.update()
    h = pb.head.copy()
    R = Matrix.Rotation(math.radians(deg), 4, axis)
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()


def apply_pose(arm, q, sway=0.0):
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
    bpy.context.view_layer.update()
    side = lambda k, s: q.get(f"{k}_{s}", q[k])  # a per-side value (e.g. elbow_l) overrides the shared one
    for s, sg in (("l", 1), ("r", -1)):
        turn(arm, f"upperarm_{s}", "Y", sg * side("arm_down", s))
        turn(arm, f"upperarm_{s}", "Z", -sg * side("arm_out", s))
        turn(arm, f"upperarm_{s}", "X", -side("arm_fwd", s))
        turn(arm, f"lowerarm_{s}", "X", -side("elbow", s))
        turn(arm, f"lowerarm_{s}", "Z", -sg * side("fore_in", s))
    turn(arm, "Head", "X", q["head"])
    turn(arm, "neck_01", "X", q["neck"])
    turn(arm, "spine_03", "X", q["sp3"])
    turn(arm, "spine_02", "X", q["sp2"])
    turn(arm, "spine_01", "X", q["sp1"])
    turn(arm, "spine_02", "Y", q["side"] + sway)
    turn(arm, "spine_02", "Z", q.get("twist", 0))
    # LEGS_TOGETHER=1 (the women's salah sheets): thighs turned in so the knees and feet stay together
    legs_in = float(os.environ.get("LEGS_TOGETHER_DEG", "6.5")) if os.environ.get("LEGS_TOGETHER") else 0.0
    for s, sg in (("l", 1), ("r", -1)):
        turn(arm, f"thigh_{s}", "Y", sg * legs_in)
    for s in "lr":
        turn(arm, f"thigh_{s}", "X", -side("hip", s))
        turn(arm, f"calf_{s}", "X", side("knee", s))
        turn(arm, f"foot_{s}", "X", side("ankle", s))
        turn(arm, f"ball_{s}", "X", q["toe"])


def blend(a, b, t):
    t = smoothstep(0.0, 1.0, t)
    return {k: a[k] + (b[k] - a[k]) * t for k in a}


def ground(arm):
    """Stand the posed body on the floor (lowest point at z = 0), feet point at the origin."""
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    lo, _ = body_bounds()
    arm.location = (0, 0, -lo.z)
    bpy.context.view_layer.update()


def prayer_frames(action, n):
    """Joint angles and sway for each frame of a prayer loop."""
    out = []
    if action == "pray_salah":
        for i in range(n):
            a, b = SALAH_SEQ[i], SALAH_SEQ[(i + 1) % n]
            prev = SALAH_SEQ[i - 1]
            # a pose held over several frames shows plainly; the first frame of a new pose is the move into it
            q = blend(SALAH_KEYS[prev], SALAH_KEYS[a], 0.6) if prev != a else SALAH_KEYS[a]
            out.append((q, 0.0))
    elif action == "pray_church":
        for i in range(n):
            ph = 2 * math.pi * i / n
            # both hands raised high and open, swaying side to side with the song
            q = P(arm_down=-30 + 6 * math.sin(ph), arm_fwd=25, elbow=24 + 6 * math.cos(ph), head=-14, sp3=-4)
            out.append((q, 5 * math.sin(ph)))
    else:  # kneel_pray: kneeling upright, hands together, a slow bow of the head
        for i in range(n):
            ph = 2 * math.pi * i / n
            out.append((dict(KNEEL, head=KNEEL["head"] + 8 * (0.5 - 0.5 * math.cos(ph)), sp1=KNEEL["sp1"] + 3 * (0.5 - 0.5 * math.cos(ph))), 0.0))
    return out


# ------------------------------------------------------------------ workouts (posed like the prayers, with props)
# frame size, frames, directions, and whether the sheet is centred on the body (horizontal poses, like sleep)
EX_FRAME = {"lift_weights": (96, 8), "boxing": (112, 8), "pushups": (192, 8), "skip_rope": (112, 8)}
EX_DIRS = {"lift_weights": ["se", "sw"], "boxing": ["se", "sw", "nw"], "pushups": ["se", "sw"], "skip_rope": ["se", "sw"]}
EX_CENTRED = {"pushups"}
GUARD = dict(arm_down=72, arm_fwd=62, elbow=128, fore_in=14, head=6, hip_l=14, hip_r=-12, knee=14, knee_l=18, twist=-14)


def exercise_frames(action, n):
    """(joint angles, extras) per frame. extras: tilt (whole body forward, deg), lift (jump, m), rope (angle, deg)."""
    out = []
    for i in range(n):
        t = i / n
        ph = 2 * math.pi * t
        if action == "lift_weights":
            # alternating dumbbell curls: one arm up while the other lowers
            cl = 0.5 - 0.5 * math.cos(ph)
            cr = 0.5 - 0.5 * math.cos(ph + math.pi)
            out.append((P(arm_down=84, arm_fwd=6, elbow_l=12 + 128 * cl, elbow_r=12 + 128 * cr, head=4, knee=4), {}))
        elif action == "boxing":
            # guard, jab (lead left), back to guard, cross (right, with a turn of the hips), guard, a little bounce
            q = P(**GUARD)
            seq = ["g", "jab", "jab", "g", "cross", "cross", "g", "g"]
            k = seq[i]
            if k == "jab":
                q.update(arm_fwd_l=88, elbow_l=12 if i == 2 else 50, arm_down_l=80, twist=-4)
            elif k == "cross":
                q.update(arm_fwd_r=88, elbow_r=12 if i == 5 else 50, arm_down_r=80, twist=-30, hip_r=-6)
            out.append((q, {"lift": 0.015 * (0.5 - 0.5 * math.cos(2 * ph))}))
        elif action == "pushups":
            # plank on hands and toes, hands under the shoulders; lowering, the upper arms swing back while the
            # forearms stay upright, so the body tilts nearer the floor (shoulder height from the arm's reach)
            d = 0.5 - 0.5 * math.cos(ph)
            back = 72 * d
            reach = 0.28 * math.cos(math.radians(back)) + 0.31
            tilt = math.degrees(math.acos(min(1.0, reach / 1.42)))
            q = P(arm_down=84, arm_fwd=tilt - back, elbow=back, head=-34, ankle=-12)
            out.append((q, {"tilt": tilt}))
        else:  # skip_rope: small jumps, hands at the hips turning the rope
            up = max(0.0, math.sin(ph))
            q = P(arm_down=80, arm_fwd=10, elbow=34, fore_in=-28, head=4, knee=10 + 14 * (1 - up), ankle=-6 * up)
            out.append((q, {"lift": 0.09 * up, "rope": (360 * t + 180) % 360}))
    return out


def toon_obj(o, rgb, name):
    mat = make_mat(name, rgb)
    try:
        mat = toon_material(mat, {}) if TOON_LIGHT is not None else mat
    except Exception:
        pass
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def hand_props(arm, action):
    """Dumbbells or gloves at the posed hands, built in world space for this frame (removed after it renders)."""
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    made = []
    for s_ in "lr":
        fa = mw @ arm.pose.bones[f"lowerarm_{s_}"].head
        hd = mw @ arm.pose.bones[f"hand_{s_}"].head
        tl = mw @ arm.pose.bones[f"hand_{s_}"].tail
        along = (tl - fa).normalized()
        grip = hd + (tl - hd) * 0.9 + along * 0.02
        bm = bmesh.new()
        if action == "lift_weights":
            ax = along.cross(Vector((0, 0, 1)))
            if ax.length < 1e-3:
                ax = along.cross(Vector((1, 0, 0)))
            ax.normalize()
            rot = Vector((0, 0, 1)).rotation_difference(ax).to_matrix().to_4x4()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.014, radius2=0.014, depth=0.2, matrix=Matrix.Translation(grip) @ rot)
            for off in (-0.085, 0.085):
                bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.05, radius2=0.05, depth=0.05,
                                      matrix=Matrix.Translation(grip + ax * off) @ rot)
            o = toon_obj(obj_from_bm(bm, f"dumbbell_{s_}", make_mat("x", (0, 0, 0))), (0.16, 0.17, 0.2), "dumbbell")
        else:  # boxing gloves round the fist
            bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=1.0)
            c = hd + (tl - hd) * 0.6
            for v in bm.verts:
                v.co = c + Vector((v.co.x * 0.07, v.co.y * 0.07, v.co.z * 0.065))
            o = toon_obj(obj_from_bm(bm, f"glove_{s_}", make_mat("x", (0, 0, 0))), (0.78, 0.08, 0.07), "glove")
        made.append(o)
    return made


def rope_obj(arm, angle):
    """A skipping rope from hand to hand, swung `angle` degrees round the line between the hands (0 = under the feet)."""
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    a = mw @ arm.pose.bones["hand_l"].tail
    b = mw @ arm.pose.bones["hand_r"].tail
    axis = (b - a).normalized()
    mid = (a + b) / 2
    down = Vector((0, 0, -1))
    down = (down - axis * down.dot(axis)).normalized()
    R = Matrix.Rotation(math.radians(angle), 3, axis)
    d = R @ down
    reach = mid.z + 0.03
    cu = bpy.data.curves.new("rope", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.006
    sp = cu.splines.new("POLY")
    n = 24
    sp.points.add(n)
    for i in range(n + 1):
        u = i / n
        p = a.lerp(b, u) + d * (reach * math.sin(math.pi * u))
        sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new("rope", cu)
    bpy.context.scene.collection.objects.link(o)
    cu.materials.append(make_mat("rope", (0.05, 0.05, 0.06)))
    return o


def render_exercise(arm, scene, look, name, action, tmp, first):
    W, n = EX_FRAME[action]
    centred = action in EX_CENTRED
    k = scene.render.resolution_x // FW
    keep = (scene.render.resolution_x, scene.render.resolution_y)
    cam = scene.camera
    keep_cam = (cam.data.ortho_scale, cam.location.copy())
    H = 112 if centred else FH
    if centred:  # rendered big round the body, then cropped to the body's middle
        to_cam, _, _ = cam_axes()
        cam.data.ortho_scale = 2 * FH / PPM
        cam.location = to_cam * 20
        scene.render.resolution_x, scene.render.resolution_y = 2 * W * k, 2 * FH * k
    else:
        scene.render.resolution_x = W * k
    clear_ik(arm)
    dirs = os.environ["PRAYDIRS"].split(",") if os.environ.get("PRAYDIRS") else EX_DIRS[action]
    for d in dirs:
        sx, sy = DIRS.get(d, (1, 0))
        frames = []
        for i, (q, ex) in enumerate(exercise_frames(action, n)):
            arm.rotation_euler = (0, 0, 0)
            apply_pose(arm, q)
            arm.rotation_euler = (math.radians(ex.get("tilt", 0)), 0, math.radians(facing_angle(sx, sy)))
            ground(arm)
            arm.location.z += ex.get("lift", 0.0)
            rope = rope_obj(arm, ex["rope"]) if "rope" in ex else None
            props = hand_props(arm, action) if action in ("lift_weights", "boxing") else []
            pth = os.path.join(tmp, f"{action}-{name}-{d}-{i}.png")
            scene.render.filepath = pth
            bpy.ops.render.render(write_still=True)
            if rope:
                bpy.data.objects.remove(rope)
            for o in props:
                bpy.data.objects.remove(o)
            a = read_png(pth)
            if look == "toon":
                a = downsample(a)
            frames.append(a)
        if centred:
            al = np.maximum.reduce([f[..., 3] for f in frames])
            rows = np.where(al.max(axis=1) > 0.05)[0]
            cols = np.where(al.max(axis=0) > 0.05)[0]
            cy = (rows.min() + rows.max()) // 2 if len(rows) else FH
            cx = (cols.min() + cols.max()) // 2 if len(cols) else W
            y0 = int(min(max(cy - H // 2, 0), al.shape[0] - H))
            x0 = int(min(max(cx - W // 2, 0), al.shape[1] - W))
            frames = [f[y0:y0 + H, x0:x0 + W] for f in frames]
        sheet = np.zeros((H, W * n, 4), dtype=np.float32)
        for i, a in enumerate(frames):
            sheet[:, i * W:(i + 1) * W] = a
            first[(action, d, i)] = a
        write_png(sheet, os.path.join(OUT, f"{action}-{name}-{d}.png"))
        print("SHEET", action, name, d)
    arm.location = (0, 0, 0)
    arm.rotation_euler = (0, 0, 0)
    cam.data.ortho_scale, cam.location = keep_cam
    scene.render.resolution_x, scene.render.resolution_y = keep


def render_prayer(arm, scene, look, name, action, tmp, first):
    W, n = PRAY_FRAME[action]
    k = scene.render.resolution_x // FW
    keep = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x = W * k
    clear_ik(arm)
    dirs = os.environ["PRAYDIRS"].split(",") if os.environ.get("PRAYDIRS") else PRAY_DIRS[action]
    for d in dirs:
        sx, sy = DIRS.get(d, (1, 0))  # "side": facing screen right, for checking poses in profile
        sheet = np.zeros((FH, W * n, 4), dtype=np.float32)
        for i, (q, sway) in enumerate(prayer_frames(action, n)):
            arm.rotation_euler = (0, 0, 0)
            apply_pose(arm, q, sway)
            if os.environ.get("PRAYDEBUG"):
                print("DBG", action, i, *[tuple(round(c, 2) for c in arm.pose.bones[b].tail) for b in ("hand_l", "hand_r", "lowerarm_l", "lowerarm_r")])
            arm.rotation_euler = (0, 0, math.radians(facing_angle(sx, sy)))
            ground(arm)
            pth = os.path.join(tmp, f"{action}-{name}-{d}-{i}.png")
            scene.render.filepath = pth
            bpy.ops.render.render(write_still=True)
            a = read_png(pth)
            if look == "toon":
                a = downsample(a)
            sheet[:, i * W:(i + 1) * W] = a
            first[(action, d, i)] = a
        write_png(sheet, os.path.join(OUT, f"{action}-{name}-{d}.png"))
        print("SHEET", action, name, d)
    arm.location = (0, 0, 0)
    scene.render.resolution_x, scene.render.resolution_y = keep


def hijab(arm, body, rgb=(0.48, 0.12, 0.24)):
    """A plain headscarf: a close cap round the head with the face open, falling over the neck and shoulders."""
    vs = [v.co for v in body.data.vertices if any(g.weight > 0.5 and body.vertex_groups[g.group].name == "Head" for g in v.groups)]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c = (lo + hi) / 2
    r = (hi - lo) / 2
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0)
    for v in bm.verts:
        v.co = Vector((c.x + v.co.x * r.x * 1.18, c.y + v.co.y * r.y * 1.15, c.z + 0.012 + v.co.z * r.z * 1.12))
    # the face stays open: front of the head between the hairline and the chin
    face = [v for v in bm.verts if v.co.y < c.y - r.y * 0.25 and c.z - r.z * 1.2 < v.co.z < c.z + r.z * 0.42 and abs(v.co.x - c.x) < r.x * 0.78]
    bmesh.ops.delete(bm, geom=face, context="VERTS")
    # drape: a cone from round the jaw to over the shoulders and upper chest
    top_z = c.z - r.z * 0.55
    bot_z = arm.data.bones["spine_03"].tail_local.z - 0.06
    cone = bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=0.2, radius2=r.x * 1.05, depth=top_z - bot_z)
    for v in cone["verts"]:
        v.co.z += (top_z + bot_z) / 2
        v.co.x += c.x
        v.co.y = v.co.y * 0.85 + c.y + 0.01
    o = obj_from_bm(bm, "hijab", make_mat("hijab", rgb))
    attach_rest(arm, o, "neck_01")
    return o


# ------------------------------------------------------------------ staff in uniform (nurse, doctor, chef, waiter, bartender)
# Walk sheets and work poses for the people who work inside places. Uniforms are painted on the body like the modern
# outfits; the lab coat and the aprons are lofted round the body (garments.py Fit) and skinned; caps, the chef's hat
# and the stethoscope are small meshes on the head or chest bones. These looks are for staff only (walkers.ts keeps
# them out of the street walkers).
def head_box(body):
    vs = [v.co for v in body.data.vertices if any(g.weight > 0.5 and body.vertex_groups[g.group].name == "Head" for g in v.groups)]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi


def reset_pose(arm):
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
    bpy.context.view_layer.update()


def nurse_cap(arm, body):
    """A small white nurse's cap perched on top of the head (over the hair), tipped back a little."""
    lo, hi = head_box(body)
    c, r = (lo + hi) / 2, (hi - lo) / 2
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(r.x * 1.75, r.y * 0.85, 0.05), verts=bm.verts)
    # wider at the top, like a folded cap
    for v in bm.verts:
        if v.co.z > 0:
            v.co.x *= 1.12
            v.co.y *= 1.25
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.008, segments=1, affect="EDGES")
    R = Matrix.Rotation(math.radians(-18), 4, "X")
    bmesh.ops.transform(bm, matrix=Matrix.Translation((c.x, c.y + r.y * 0.1, hi.z + 0.035)) @ R, verts=bm.verts)
    o = obj_from_bm(bm, "nurse_cap", make_mat("cap_white", (0.97, 0.97, 0.97)))
    attach_rest(arm, o, "Head")
    return o


def chef_hat(arm, body):
    """A tall white toque: a band round the head with a puffed top."""
    lo, hi = head_box(body)
    c, r = (lo + hi) / 2, (hi - lo) / 2
    rad = max(r.x, r.y) * 1.08
    bm = bmesh.new()
    z0 = hi.z - 0.05
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=rad, radius2=rad * 1.12, depth=0.13,
                          matrix=Matrix.Translation((c.x, c.y, z0 + 0.065)))
    puff = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=1.0)
    for v in puff["verts"]:
        v.co = Vector((c.x + v.co.x * rad * 1.3, c.y + v.co.y * rad * 1.3, z0 + 0.14 + v.co.z * 0.06))
    o = obj_from_bm(bm, "chef_hat", make_mat("hat_white", (0.97, 0.97, 0.96)))
    attach_rest(arm, o, "Head")
    return o


def stethoscope(arm, body):
    """Dark tubing round the back of the neck, both ends hanging down the front of the coat, a silver chest piece."""
    bones = arm.data.bones
    zn = bones["neck_01"].head_local.z
    ring = [v.co for v in body.data.vertices if abs(v.co.z - (zn - 0.02)) < 0.02 and abs(v.co.x) < 0.12]
    hw = max(abs(p.x) for p in ring) + 0.035
    fy, by = min(p.y for p in ring) - 0.03, max(p.y for p in ring) + 0.03
    zc = zn - 0.2
    chest = [v.co for v in body.data.vertices if abs(v.co.z - zc) < 0.02 and abs(v.co.x) < 0.1]
    cy = min(p.y for p in chest) - 0.045   # outside the coat
    pts = [(-0.05, cy, zc - 0.03), (-0.07, cy + 0.01, zc + 0.08), (-hw * 0.95, fy + 0.02, zn - 0.02), (-hw, (fy + by) / 2, zn + 0.01),
           (-hw * 0.6, by, zn + 0.02), (0, by + 0.01, zn + 0.02), (hw * 0.6, by, zn + 0.02), (hw, (fy + by) / 2, zn + 0.01),
           (hw * 0.95, fy + 0.02, zn - 0.02), (0.07, cy + 0.01, zc + 0.08), (0.04, cy, zc - 0.07)]
    # a smooth tube through the points (Catmull-Rom), as cylinders between samples
    P_ = [Vector(p) for p in pts]
    P_ = [P_[0]] + P_ + [P_[-1]]
    samp = []
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        for k in range(4):
            u = k / 4
            samp.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    samp.append(P_[-2])
    bm = bmesh.new()
    for a, b in zip(samp, samp[1:]):
        if (b - a).length > 1e-4:
            _cyl(bm, a, b, 0.011, seg=8)
    o = obj_from_bm(bm, "steth", make_mat("steth", (0.2, 0.24, 0.34)))
    attach_rest(arm, o, "spine_03")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=0.022, radius2=0.022, depth=0.012,
                          matrix=Matrix.Translation((0.04, cy - 0.005, zc - 0.085)) @ Matrix.Rotation(math.radians(90), 4, "X"))
    bell = obj_from_bm(bm, "steth_bell", make_mat("steel", (0.8, 0.82, 0.85)))
    attach_rest(arm, bell, "spine_03")
    return o


def front_apron(arm, body, rgb, top, hem, name="apron", wrap=0.25):
    """An apron over the front of the body from `top` to `hem` (heights in rest pose), skinned like a skirt."""
    F = G.Fit(arm, body)
    p = G.Part()
    zs = G.levels(top(F), hem(F), 0.045)
    n = 24
    rings = F.body_loft(zs, TORSO | UPPERLEGS | LEGS, n, lambda z, a: lerp(0.03, 0.075, smoothstep(top(F), hem(F), z)), shoulders=False)

    def drop(i, j, c):
        a = 2 * math.pi * (j + 0.5) / n
        return math.sin(a) > -wrap   # keep the front (sin < 0: towards -y, the way the body faces)
    v, f = G.grid(rings, closed=True, drop=drop)
    p.add(v, f, [F.body_w(q) for q in v])
    o = F.finish(p, name, make_mat(name, rgb))
    reset_pose(arm)
    return o


def labcoat(arm, body, rgb):
    """A knee-length white coat, open down the front (the shirt and tie show in the V), long sleeves."""
    F = G.Fit(arm, body)
    p = G.Part()
    G.kaftan_like(F, p, F.z_knee + 0.02, n=24, m_top=0.03, m_hem=0.06, sleeve_m=(0.024, 0.03), sleeve_n=10)
    zt = F.z_neck + 0.03

    def opening(c):
        if c.y > -0.03 or c.z > zt + 0.005:
            return False
        w = 0.022 + 0.07 * smoothstep(F.z_shoulder - 0.24, zt, c.z)
        return abs(c.x) < w
    keep = []
    for f in p.f:
        c = sum((p.v[k] for k in f), Vector()) / len(f)
        if not opening(c):
            keep.append(f)
    p.f = keep
    o = F.finish(p, "labcoat", make_mat("labcoat", rgb))
    reset_pose(arm)
    return o


def uniform_rule(top=None, sleeve=0.28, bottom=None, feet=None, vest=None, tie=None, cuff=None, length="ankle"):
    """Region rule for a painted uniform. vest: waistcoat over the torso with a V at the front showing the top."""
    def rule(c, ds, L):
        if feet and shoes(c, ds, L, 0.03):
            return "feet"
        if bottom and not is_arm(ds) and c.z < L["hip"] + 0.06:
            return "bottom"
        if top and top_rule(c, ds, L, sleeve):
            arm_part = is_arm(ds) and not (ds & TORSO)
            if cuff and arm_part:
                f = (abs(c.x) - L["sh_x"]) / (L["wrist_x"] - L["sh_x"])
                if f > sleeve - 0.07:
                    return "cuff"
            if tie and not arm_part and c.y < -0.02 and abs(c.x) < 0.022 and L["waist"] < c.z < L["neck"] - 0.02:
                return "tie"
            if vest and not arm_part:
                if c.y < 0 and abs(c.x) < 0.075 * smoothstep(L["waist"] + 0.12, L["neck"], c.z):
                    return "top"
                if c.z < L["neck"] - 0.03 or (ds & {"clavicle_l", "clavicle_r"}):
                    return "vest"
            return "top"
        return None
    return rule


def paint_uniform(arm, body, rule, colours):
    region_paint(body, arm, rule, {k: make_mat(k, hexrgb(h)) for k, h in colours.items()})


def v_nurse(arm, body):
    paint_body(body, MEDIUM)
    paint_uniform(arm, body, uniform_rule(top=True, sleeve=0.28, bottom=True, feet=True),
                  {"feet": "#f4f4f4", "bottom": "#7fb6e0", "top": "#8cc3ea"})
    attach_hair(arm, os.path.join(HUSTLE, "hair-Female", "hair-bob.glb"))
    nurse_cap(arm, body)


def v_doctor(arm, body):
    paint_body(body, DARK)
    paint_uniform(arm, body, uniform_rule(top=True, sleeve=0.97, bottom=True, feet=True, tie=True),
                  {"feet": "#1a1410", "bottom": "#353b45", "top": "#a9c9ec", "tie": "#8a1c2b"})
    labcoat(arm, body, (0.96, 0.96, 0.95))
    stethoscope(arm, body)
    attach_hair(arm, os.path.join(HUSTLE, "hair-Male", "hair-low_cut.glb"))


def v_chef(arm, body):
    paint_body(body, DARK)
    paint_uniform(arm, body, uniform_rule(top=True, sleeve=0.97, bottom=True, feet=True, cuff=True),
                  {"feet": "#1a1410", "bottom": "#2c2c30", "top": "#f5f4ee", "cuff": "#e8e6dc"})
    front_apron(arm, body, (0.93, 0.93, 0.9), lambda F: F.z_waist, lambda F: F.z_knee - 0.05, "chef_apron")
    attach_hair(arm, os.path.join(HUSTLE, "hair-Female", "hair-low_cut.glb"))
    chef_hat(arm, body)


def v_waiter(arm, body):
    paint_body(body, MEDIUM)
    paint_uniform(arm, body, uniform_rule(top=True, sleeve=0.97, bottom=True, feet=True, vest=True),
                  {"feet": "#141414", "bottom": "#1c1c1f", "top": "#f6f6f2", "vest": "#18181b"})
    front_apron(arm, body, (0.95, 0.95, 0.93), lambda F: F.z_waist - 0.02, lambda F: F.z_knee - 0.16, "waiter_apron", wrap=0.35)
    attach_hair(arm, os.path.join(HUSTLE, "hair-Female", "hair-braids.glb"))


def v_bartender(arm, body):
    paint_body(body, MEDIUM)
    paint_uniform(arm, body, uniform_rule(top=True, sleeve=0.6, bottom=True, feet=True, cuff=True),
                  {"feet": "#3a2414", "bottom": "#151517", "top": "#2a3340", "cuff": "#3c4757"})
    front_apron(arm, body, (0.42, 0.24, 0.12), lambda F: F.z_waist + 0.02, lambda F: F.z_knee + 0.02, "bar_apron")
    attach_hair(arm, os.path.join(HUSTLE, "hair-Male", "hair-high_top.glb"))


STAFF_VARIANTS = [
    ("nurse", "Female", v_nurse),
    ("doctor", "Male", v_doctor),
    ("chef", "Female", v_chef),
    ("waiter", "Female", v_waiter),
    ("bartender", "Male", v_bartender),
]
STAFF_NAMES = [n for n, _, _ in STAFF_VARIANTS]
VARIANTS += STAFF_VARIANTS


# ------------------------------------------------------------------ work poses (posed bone by bone, IK hands, props)
# Each frame: joint angles (apply_pose), hand targets for the arm IK (armature space: x = the character's left,
# -y = forward, z = up, feet at the origin), and props built at the posed hands. carry_tray is a walk sheet instead
# (the library's Walk_Loop with the right hand up under a tray). All 8 frames of 96x160, feet 16 px up.
ALL_DIRS = ["se", "sw", "ne", "nw"]
GENERIC_DIRS = {"run": ["se", "sw", "nw"], "sit_eat": ALL_DIRS, "sit_talk": ALL_DIRS, "stand_talk": ALL_DIRS}
# props on the library-clip poses: a plate of food on the lap and a spoon when eating
GENERIC_PROPS = {"sit_eat": [("plate_lap", "l"), ("spoon", "r")]}
REACH = 0.43  # m from the shoulder
WORK_DIRS = {"sick_sit": ["se", "sw"]}
WORK_FPS = {}
WORK_ACTIONS = ["sit_table", "eat_table", "cook_hob", "cut_hair", "sew", "sit_desk", "check_patient", "write_chart", "pour_drink", "carry_tray", "serve_tray", "cook_stir", "wipe_counter", "sick_sit", "take_order"]
LEGACY_ADULTS = ["woman_buba", "woman_gele", "man_kaftan", "man_casual"]
POSES.update({
    "stand_idle": (POSES["stand_idle"][0], POSES["stand_idle"][1] + STAFF_NAMES),
    "check_patient": ("Idle_Loop", ["nurse", "doctor"]),
    "write_chart": ("Idle_Loop", ["nurse", "doctor"]),
    "pour_drink": ("Idle_Loop", ["bartender", "man_casual"]),
    "carry_tray": ("Walk_Loop", ["waiter", "chef", "man_casual"]),
    "serve_tray": ("Idle_Loop", ["waiter", "chef", "man_casual"]),
    "cook_stir": ("Idle_Loop", ["chef", "woman_buba"]),
    "wipe_counter": ("Idle_Loop", ["bartender", "waiter", "chef", "woman_buba"]),
    "sick_sit": ("Idle_Loop", LEGACY_ADULTS),
    "take_order": ("Idle_Loop", ["waiter", "bartender"]),
    # standing and chatting (visitors at a bedside, customers at a counter, a pastor or teacher): the library clip
    "stand_talk": ("Idle_Talking_Loop", LEGACY_ADULTS + OUTFIT_NAMES + STAFF_NAMES),
    "cook_hob": ("Idle_Loop", ["woman_buba", "woman_gele", "chef", "man_casual"]),
    # seated at a table with the plate on the table in front: spoon from the plate to the mouth (every everyday look,
    # so the player can eat at a table in whatever they wear)
    "sit_table": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"] + OUTFIT_NAMES),
    "eat_table": ("Idle_Loop", ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"] + OUTFIT_NAMES),
    "cut_hair": ("Idle_Loop", ["man_casual", "woman_buba", "woman_gele"]),
    "sew": ("Idle_Loop", ["woman_buba", "man_kaftan"]),
    "sit_desk": ("Idle_Loop", ["man_casual", "woman_buba", "man_kaftan", "woman_gele"]),
})


def bp(bone, off):
    return lambda arm: body_point(arm, bone, off)


FLOOR = [0.0]  # armature-space height of the floor this frame (seated poses: the body is lowered onto the seat after)


def ab(x, y, z):
    """A target fixed in the room: x, y from the feet, z above the floor."""
    v = Vector((x, y, z))
    return lambda arm: v + Vector((0, 0, FLOOR[0]))


def work_frame(action, i, n):
    """dict(q=joint angles, l/r=hand target fns, props=[(kind, args)], sit=bool) for frame i."""
    t = i / n
    ph = 2 * math.pi * t
    k = 0.5 - 0.5 * math.cos(ph)
    if action == "check_patient":
        # bent over the bed: one hand on the patient's arm, the other giving an injection (pushing in, easing out)
        q = P(sp1=16 + 3 * k, sp2=6, sp3=4, neck=10, head=16, knee=6, hip=2)
        return dict(q=q, l=ab(0.07, -0.44, 1.0), r=ab(-0.07, -0.4 - 0.04 * k, 1.12 - 0.07 * k), props=[("syringe", "r", "l")])
    if action == "write_chart":
        q = P(head=24, neck=10, sp3=4)
        dx = 0.035 * math.sin(2 * ph)
        return dict(q=q, l=bp("spine_03", (0.07, -0.3, -0.03)), r=bp("spine_03", (-0.03 + dx, -0.32, 0.02 - 0.05 * t)),
                    props=[("clipboard", "l"), ("pen", "r")])
    if action == "take_order":
        look = i >= 5  # writes, then looks up at the customer
        q = P(head=-2 if look else 22, neck=0 if look else 8, sp3=2)
        dx = 0.025 * math.sin(2 * ph)
        return dict(q=q, l=bp("spine_03", (0.06, -0.28, 0.05)), r=bp("spine_03", (-0.02 + dx, -0.3, 0.07 - 0.03 * min(t, 0.6))),
                    props=[("notepad", "l"), ("pen", "r")])
    if action == "pour_drink":
        if i < 4:  # shaking the shaker over the right shoulder
            dz = 0.07 if i % 2 else -0.05
            return dict(q=P(head=4, sp3=-2, twist=6), r=bp("spine_03", (-0.14, -0.24, 0.12 + dz)), l=bp("spine_03", (-0.08, -0.26, 0.3 + dz)),
                        props=[("shaker", "r", "l")])
        # pouring into a glass held low in the left hand
        tilt = [70, 110, 120, 90][i - 4]
        return dict(q=P(head=20, neck=6, sp1=6), l=bp("spine_01", (0.04, -0.36, 0.08)), r=bp("spine_01", (-0.06, -0.36, 0.3)),
                    props=[("glass", "l"), ("shaker_pour", "r", tilt, i in (5, 6))])
    if action == "serve_tray":
        # tray up on the left hand; the right hand lifts a plate off it and sets it down on the table, then back
        q = P(head=10 + 10 * k, sp1=6 + 10 * k, knee=4 * k)
        tray = bp("spine_03", (0.24, -0.16, 0.16))
        top = Vector((0.08, -0.28, 1.42))
        table = Vector((-0.06, -0.5, 0.82))
        hand = top.lerp(table, smoothstep(0.0, 1.0, k))
        return dict(q=q, l=tray, r=ab(*hand), props=[("tray", "l", False), ("plate", "r")])
    if action == "cook_stir":
        # a big pot on a low stove in front of her: bent over it, working the ladle round the pot
        q = P(sp1=22, sp2=6, head=18, neck=6, knee=6, arm_fwd_l=14, elbow_l=30)
        return dict(q=q, r=ab(-0.04 + 0.05 * math.cos(ph), -0.3 + 0.04 * math.sin(ph), 0.9), props=[("pot",), ("ladle", "r")])
    if action == "wipe_counter":
        q = P(sp1=20, sp2=4, head=8, knee=4)
        return dict(q=q, r=ab(-0.06 + 0.1 * math.cos(ph), -0.4 + 0.05 * math.sin(ph), 1.03), l=ab(0.18, -0.36, 1.03), props=[("cloth", "r")])
    if action == "sick_sit":
        # sitting on the edge of the bed, bent over: one hand on the stomach, the other on the forehead, rocking
        q = P(hip=88, knee=88, ankle=0, sp1=14 + 6 * k, sp2=6, sp3=4, head=16 + 6 * k, neck=6)
        return dict(q=q, l=bp("spine_01", (0.03, -0.16, 0.04)), r=bp("Head", (-0.03, -0.12, 0.1)), props=[], sit=True)
    if action == "sit_table":
        # seated at a table, chatting: forearms on the table, one hand moving as they talk, the head nodding
        q = P(hip=88, knee=88, ankle=0, sp1=6, head=4 + 6 * math.sin(ph), neck=2, side=2 * math.sin(ph))
        return dict(q=q, r=ab(-0.12 + 0.05 * math.sin(ph), -0.4, 0.8 + 0.06 * max(0.0, math.sin(ph))), l=ab(0.14, -0.36, 0.77),
                    props=[("table_holdout",)], sit=True)
    if action == "eat_table":
        k2 = smoothstep(0.0, 1.0, 0.5 - 0.5 * math.cos(ph))
        q = P(hip=88, knee=88, ankle=0, sp1=10 + 6 * (1 - k2), head=14 * (1 - k2) + 2, neck=4)
        plate = Vector((0.0, -0.42, 0.8))

        def r(arm):
            mouth = body_point(arm, "Head", (-0.02, -0.12, 0.02))
            return (plate + Vector((0, 0, FLOOR[0]))).lerp(mouth, k2)
        return dict(q=q, r=r, l=ab(0.17, -0.36, 0.79), props=[("table_holdout",), ("plate_at", (0.0, -0.42, 0.75)), ("spoon", "r")], sit=True)
    if action == "cook_hob":
        # at a cooker: stirring a pot on the hob (the pot is in the sheet, at hob height), the other hand on its handle
        q = P(sp1=8, sp2=2, head=18, neck=6)
        return dict(q=q, r=ab(-0.06 + 0.05 * math.cos(ph), -0.34 + 0.04 * math.sin(ph), 1.12), l=ab(0.2, -0.32, 1.02),
                    props=[("pot_hob",), ("ladle", "r")])
    if action == "cut_hair":
        # behind a seated client: clippers (or a comb) working round their head, the other hand steadying it
        q = P(sp1=6, head=14, neck=4)
        return dict(q=q, r=ab(-0.06 + 0.05 * math.cos(ph), -0.36 + 0.03 * math.sin(ph), 1.22 + 0.04 * math.sin(2 * ph)),
                    l=ab(0.1, -0.36, 1.26), props=[("clipper", "r")])
    if action == "sew":
        # seated at a sewing machine (the machine is in the room art): feeding the cloth through with both hands
        q = P(hip=88, knee=88, ankle=0, sp1=12, head=22, neck=8)
        dy = 0.03 * math.sin(ph)
        return dict(q=q, r=ab(-0.1, -0.42 + dy, 0.74), l=ab(0.1, -0.4 + dy, 0.74), props=[("fabric", "r", "l")], sit=True)
    if action == "sit_desk":
        # seated at a desk or counter: typing, writing, turning a page
        q = P(hip=88, knee=88, ankle=0, sp1=8, head=16 if i < 6 else 4, neck=6)
        tap = 0.015 * (1 if i % 2 else -1)
        return dict(q=q, r=ab(-0.1, -0.4, 0.76 + tap), l=ab(0.1, -0.4, 0.76 - tap), props=[("table_holdout",), ("papers",)], sit=True)
    if action == "carry_tray":
        return dict(walk=True, r=bp("spine_03", (-0.27, -0.12, 0.15)), props=[("tray", "r", True)])
    raise KeyError(action)


def _cyl(bm, p0, p1, r0, r1=None, seg=10):
    d = p1 - p0
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1 if r1 is not None else r0, depth=d.length,
                          matrix=Matrix.Translation((p0 + p1) / 2) @ rot)


def _box(bm, c, ax, size):
    """Box centred at c with axes ax = (u, v, w) (unit vectors) and full sizes."""
    res = bmesh.ops.create_cube(bm, size=1.0)
    M = Matrix((ax[0] * size[0], ax[1] * size[1], ax[2] * size[2])).transposed()
    for v in res["verts"]:
        v.co = c + M @ v.co


def _prop(name, rgb, build):
    bm = bmesh.new()
    build(bm)
    o = obj_from_bm(bm, name, make_mat(name, rgb))
    return toon_obj(o, rgb, name)


POT = [None]


def NOLINE():
    """A collection Freestyle leaves out (invisible helper geometry such as the table holdout)."""
    col = bpy.data.collections.get("noline")
    if col is None:
        col = bpy.data.collections.new("noline")
        bpy.context.scene.collection.children.link(col)
        for ls in bpy.context.view_layer.freestyle_settings.linesets:
            ls.select_by_collection = True
            ls.collection = col
            ls.collection_negation = "EXCLUSIVE"
    return col


def build_props(arm, specs):
    """Props in world space at the posed hands (removed after the frame renders)."""
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    R = mw.to_3x3()
    fwd = (R @ Vector((0, -1, 0))).normalized()
    left = (R @ Vector((1, 0, 0))).normalized()
    up = Vector((0, 0, 1))
    H = {}
    for s in "lr":
        hd = mw @ arm.pose.bones[f"hand_{s}"].head
        tl = mw @ arm.pose.bones[f"hand_{s}"].tail
        H[s] = hd + (tl - hd) * 0.8 + (tl - hd).normalized() * 0.02   # the grip, in the fingers
    made = []
    POT[0] = None
    for sp in specs:
        kind = sp[0]
        if kind == "syringe":
            g, aim = H[sp[1]], H[sp[2]]
            d = (aim - g).normalized()
            made.append(_prop("syringe", (0.86, 0.92, 0.98), lambda bm: _cyl(bm, g - d * 0.03, g + d * 0.08, 0.011)))
            made.append(_prop("plunger", (0.2, 0.45, 0.85), lambda bm: _cyl(bm, g - d * 0.06, g - d * 0.03, 0.006)))
            made.append(_prop("needle", (0.75, 0.75, 0.78), lambda bm: _cyl(bm, g + d * 0.08, g + d * 0.12, 0.0025, seg=6)))
        elif kind in ("clipboard", "notepad"):
            g = H[sp[1]]
            tilt = math.radians(62 if kind == "clipboard" else 55)
            u = left
            v = (up * math.cos(tilt) + fwd * math.sin(tilt)).normalized()
            w = u.cross(v)   # towards the face
            if w.dot(fwd) > 0:
                w = -w
            if kind == "clipboard":
                c = g - left * 0.07 + v * 0.05
                made.append(_prop("board", (0.74, 0.54, 0.3), lambda bm: _box(bm, c, (u, v, w), (0.2, 0.27, 0.012))))
                made.append(_prop("paper", (0.98, 0.98, 0.96), lambda bm: _box(bm, c + w * 0.008 - v * 0.012, (u, v, w), (0.17, 0.22, 0.004))))
                made.append(_prop("clip", (0.75, 0.76, 0.8), lambda bm: _box(bm, c + w * 0.01 + v * 0.12, (u, v, w), (0.08, 0.03, 0.012))))
            else:
                c = g - left * 0.04 + v * 0.03
                made.append(_prop("pad", (0.99, 0.98, 0.9), lambda bm: _box(bm, c, (u, v, w), (0.1, 0.14, 0.012))))
                made.append(_prop("padtop", (0.75, 0.15, 0.12), lambda bm: _box(bm, c + v * 0.065 + w * 0.002, (u, v, w), (0.105, 0.02, 0.016))))
        elif kind == "pen":
            g = H[sp[1]]
            d = (fwd * 0.4 - up + left * 0.3).normalized()
            made.append(_prop("pen", (0.1, 0.15, 0.45), lambda bm: _cyl(bm, g - d * 0.07, g + d * 0.05, 0.006, seg=6)))
        elif kind == "shaker":
            a, b = H[sp[1]], H[sp[2]]
            d = (b - a).normalized()
            made.append(_prop("shaker", (0.78, 0.8, 0.84), lambda bm: _cyl(bm, a - d * 0.05, b + d * 0.03, 0.038, 0.03, seg=14)))
        elif kind == "shaker_pour":
            g, tilt, stream = H[sp[1]], sp[2], sp[3]
            d = (up * math.cos(math.radians(tilt)) + left * math.sin(math.radians(tilt))).normalized()  # bottom -> mouth
            made.append(_prop("shaker", (0.78, 0.8, 0.84), lambda bm: _cyl(bm, g - d * 0.07, g + d * 0.11, 0.036, 0.028, seg=14)))
            if stream:
                m = g + d * 0.11
                gl = H["l"] + up * 0.1
                made.append(_prop("drink", (0.85, 0.45, 0.08), lambda bm: _cyl(bm, m, gl, 0.006, seg=6)))
        elif kind == "glass":
            g = H[sp[1]]
            made.append(_prop("glass", (0.72, 0.9, 0.95), lambda bm: _cyl(bm, g - up * 0.02, g + up * 0.1, 0.032, 0.038, seg=12)))
            made.append(_prop("drink", (0.85, 0.45, 0.08), lambda bm: _cyl(bm, g - up * 0.015, g + up * 0.05, 0.03, 0.033, seg=12)))
        elif kind == "tray":
            g = H[sp[1]] + up * 0.035
            side = left if sp[1] == "l" else -left
            c = g + side * 0.04 + fwd * 0.04
            made.append(_prop("tray", (0.62, 0.64, 0.68), lambda bm: _cyl(bm, c - up * 0.008, c + up * 0.008, 0.17, seg=24)))
            # a plate of jollof, a bottle and a glass on the tray
            pc = c - side * 0.06 + fwd * 0.04
            made.append(_prop("plate", (0.98, 0.98, 0.96), lambda bm: _cyl(bm, pc, pc + up * 0.012, 0.075, 0.085, seg=18)))
            made.append(_prop("jollof", (0.88, 0.32, 0.08), lambda bm: _cyl(bm, pc + up * 0.012, pc + up * 0.04, 0.055, 0.02, seg=14)))
            bc = c + side * 0.07 - fwd * 0.03
            made.append(_prop("bottle", (0.12, 0.42, 0.18), lambda bm: (_cyl(bm, bc, bc + up * 0.14, 0.026, seg=10), _cyl(bm, bc + up * 0.14, bc + up * 0.2, 0.024, 0.01, seg=10))))
            gc = c + fwd * 0.1 + side * 0.02
            made.append(_prop("glass", (0.72, 0.9, 0.95), lambda bm: _cyl(bm, gc, gc + up * 0.1, 0.028, 0.034, seg=10)))
        elif kind == "plate":
            g = H[sp[1]] - up * 0.03
            made.append(_prop("plate", (0.98, 0.98, 0.96), lambda bm: _cyl(bm, g, g + up * 0.012, 0.075, 0.085, seg=18)))
            made.append(_prop("jollof", (0.88, 0.32, 0.08), lambda bm: _cyl(bm, g + up * 0.012, g + up * 0.04, 0.055, 0.02, seg=14)))
        elif kind == "pot_hob":
            base = Vector((mw.translation.x, mw.translation.y, 0.92)) + fwd * 0.38
            made.append(_prop("pot", (0.72, 0.74, 0.78), lambda bm: _cyl(bm, base, base + up * 0.2, 0.13, 0.14, seg=20)))
            made.append(_prop("stew", (0.82, 0.24, 0.06), lambda bm: _cyl(bm, base + up * 0.185, base + up * 0.197, 0.13, seg=20)))
            POT[0] = base + up * 0.1
        elif kind == "clipper":
            g = H[sp[1]]
            made.append(_prop("clipper", (0.12, 0.12, 0.14), lambda bm: _box(bm, g + fwd * 0.03, (left, fwd, up), (0.04, 0.1, 0.035))))
        elif kind == "fabric":
            a, b = H[sp[1]], H[sp[2]]
            c = (a + b) / 2 - up * 0.02
            made.append(_prop("fabric", (0.85, 0.35, 0.1), lambda bm: _box(bm, c + fwd * 0.05, (left, fwd, up), (0.42, 0.3, 0.008))))
        elif kind == "papers":
            base = Vector((mw.translation.x, mw.translation.y, 0.0))
            # (the anchor is the feet; the desk top is in the room art) a sheet of paper under the hands
            c = (H["l"] + H["r"]) / 2 - up * 0.025
            made.append(_prop("paper", (0.98, 0.98, 0.96), lambda bm: _box(bm, c, (left, fwd, up), (0.21, 0.28, 0.004))))
        elif kind == "table_holdout":
            # an invisible table: holds out (cuts away) the legs under the table top and behind its front, so the
            # sprite shows the body above the table and what is on it; the room art draws the table itself
            o = _prop("holdout", (0, 0, 0), lambda bm: None)
            bm = bmesh.new()
            c = mw @ Vector((0.0, -0.6, 0.0))
            c.z = 0.37
            _box(bm, c, (left, fwd, up), (1.1, 0.62, 0.74))
            bm.to_mesh(o.data)
            bm.free()
            hm = bpy.data.materials.new("holdout")
            hm.use_nodes = True
            nt = hm.node_tree
            nt.nodes.clear()
            out = nt.nodes.new("ShaderNodeOutputMaterial")
            ho = nt.nodes.new("ShaderNodeHoldout")
            nt.links.new(ho.outputs[0], out.inputs["Surface"])
            o.data.materials.clear()
            o.data.materials.append(hm)
            for col in o.users_collection:
                col.objects.unlink(o)
            NOLINE().objects.link(o)
            made.append(o)
        elif kind == "plate_at":
            g = mw @ Vector((sp[1][0], sp[1][1], 0.0))
            g.z = sp[1][2]
            made.append(_prop("plate", (0.98, 0.98, 0.96), lambda bm: _cyl(bm, g, g + up * 0.014, 0.11, 0.125, seg=20)))
            made.append(_prop("jollof", (0.9, 0.34, 0.08), lambda bm: _cyl(bm, g + up * 0.014, g + up * 0.05, 0.085, 0.03, seg=16)))
            made.append(_prop("meat", (0.45, 0.22, 0.1), lambda bm: _box(bm, g + up * 0.045 + fwd * 0.05 + left * 0.03, (left, fwd, up), (0.05, 0.04, 0.03))))
            gl = g + left * 0.2 - fwd * 0.02
            made.append(_prop("glass", (0.72, 0.9, 0.95), lambda bm: _cyl(bm, gl, gl + up * 0.11, 0.03, 0.036, seg=10)))
            made.append(_prop("drink", (0.85, 0.45, 0.08), lambda bm: _cyl(bm, gl + up * 0.005, gl + up * 0.07, 0.028, 0.032, seg=10)))
        elif kind == "plate_lap":
            g = H[sp[1]] + up * 0.012 + fwd * 0.02 - left * 0.04
            made.append(_prop("plate", (0.98, 0.98, 0.96), lambda bm: _cyl(bm, g, g + up * 0.014, 0.1, 0.115, seg=20)))
            made.append(_prop("jollof", (0.9, 0.34, 0.08), lambda bm: _cyl(bm, g + up * 0.014, g + up * 0.045, 0.075, 0.03, seg=16)))
            made.append(_prop("meat", (0.45, 0.22, 0.1), lambda bm: _box(bm, g + up * 0.04 + fwd * 0.05, (left, fwd, up), (0.05, 0.04, 0.03))))
        elif kind == "spoon":
            g = H[sp[1]]
            d = (fwd * 0.7 + up * 0.3 - left * 0.3).normalized()
            made.append(_prop("spoon", (0.75, 0.76, 0.8), lambda bm: _cyl(bm, g - d * 0.03, g + d * 0.09, 0.006, seg=6)))
        elif kind == "pot":
            base = Vector((mw.translation.x, mw.translation.y, 0.0)) + fwd * 0.4
            made.append(_prop("stove", (0.16, 0.16, 0.18), lambda bm: _cyl(bm, base, base + up * 0.18, 0.13, 0.15, seg=16)))
            made.append(_prop("pot", (0.72, 0.74, 0.78), lambda bm: _cyl(bm, base + up * 0.18, base + up * 0.46, 0.16, 0.175, seg=20)))
            made.append(_prop("stew", (0.82, 0.24, 0.06), lambda bm: _cyl(bm, base + up * 0.445, base + up * 0.458, 0.16, seg=20)))
            POT[0] = base + up * 0.36
        elif kind == "ladle":
            g = H[sp[1]]
            aim = POT[0] if POT[0] is not None else g - up * 0.4 + fwd * 0.15
            d = (aim - g).normalized()
            tip = g + d * min(0.5, (aim - g).length)
            made.append(_prop("ladle", (0.55, 0.57, 0.6), lambda bm: _cyl(bm, g - d * 0.06, tip, 0.009, seg=8)))
            made.append(_prop("ladle_bowl", (0.55, 0.57, 0.6), lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.045, matrix=Matrix.Translation(tip))))
        elif kind == "cloth":
            g = H[sp[1]] - up * 0.035
            made.append(_prop("cloth", (0.96, 0.78, 0.2), lambda bm: _box(bm, g, (left, fwd, up), (0.15, 0.12, 0.018))))
    return made


def render_work(arm, scene, look, name, action, tmp, first):
    n = NF
    clear_ik(arm)
    er, cr = ik_hand(arm, "r")
    el, cl = ik_hand(arm, "l")
    dirs = os.environ["PRAYDIRS"].split(",") if os.environ.get("PRAYDIRS") else WORK_DIRS.get(action, ALL_DIRS)
    for d in dirs:
        sx, sy = DIRS[d]
        sheet = np.zeros((FH, FW * n, 4), dtype=np.float32)
        for i in range(n):
            spec = work_frame(action, i, n)
            cr.influence = cl.influence = 0.0
            arm.location = (0, 0, 0)
            arm.rotation_euler = (0, 0, 0)
            if spec.get("walk"):
                set_action(arm, "Walk_Loop", 1.0 + 32.0 * i / n)
            else:
                apply_pose(arm, spec["q"])
            bpy.context.view_layer.update()
            FLOOR[0] = body_bounds()[0].z if spec.get("sit") else 0.0
            for side, e, c in (("r", er, cr), ("l", el, cl)):
                if side in spec:
                    tg = spec[side](arm)
                    sh = arm.pose.bones[f"upperarm_{side}"].head
                    if (tg - sh).length > REACH:  # keep a bend in the elbow (a straight arm reads as stiff)
                        tg = sh + (tg - sh).normalized() * REACH
                    e.location = tg
            bpy.context.view_layer.update()
            cr.influence = 1.0 if "r" in spec else 0.0
            cl.influence = 1.0 if "l" in spec else 0.0
            bpy.context.view_layer.update()
            arm.rotation_euler = (0, 0, math.radians(facing_angle(sx, sy)))
            if not spec.get("walk"):
                ground(arm)
            if spec.get("sit"):
                # the anchor is the feet (the seat is behind them), as in the library's seated sheets
                bpy.context.view_layer.update()
                mw = arm.matrix_world
                fm = (mw @ arm.pose.bones["ball_l"].head + mw @ arm.pose.bones["ball_r"].head) / 2
                arm.location.x -= fm.x
                arm.location.y -= fm.y
            props = build_props(arm, spec.get("props", []))
            pth = os.path.join(tmp, f"{action}-{name}-{d}-{i}.png")
            scene.render.filepath = pth
            bpy.ops.render.render(write_still=True)
            for o in props:
                bpy.data.objects.remove(o)
            a = read_png(pth)
            if look == "toon":
                a = downsample(a)
            sheet[:, i * FW:(i + 1) * FW] = a
            first[(action, d, i)] = a
        write_png(sheet, os.path.join(OUT, f"{action}-{name}-{d}.png"))
        print("SHEET", action, name, d)
    clear_ik(arm)
    arm.location = (0, 0, 0)
    arm.rotation_euler = (0, 0, 0)


def render_poses(name, sex, fn, jobs, tmp):
    bases = sorted({POSES[a][0] for a in jobs})
    arm, scene, look = prepare_variant(name, sex, fn, extra_actions=[b for b in bases if b not in bpy.data.actions] if False else
                                        [b for b in bases if b == "Sitting_Talking_Loop"])
    first = {}
    if "sleep" in jobs:
        render_sleep(arm, scene, look, name, tmp, first)
    for action in jobs:
        if action in PRAY_FRAME:
            render_prayer(arm, scene, look, name, action, tmp, first)
            continue
        if action in EX_FRAME:
            render_exercise(arm, scene, look, name, action, tmp, first)
            continue
        if action in WORK_ACTIONS:
            render_work(arm, scene, look, name, action, tmp, first)
            continue
        if action == "sleep":
            continue
        base = POSES[action][0]
        yaw = clip_yaw(arm, base)
        print("CLIP", base, "body yaw", round(yaw, 1))
        # runners also face nw (on a treadmill, towards its console)
        # seated and talking people also face ne/nw (sofas facing a TV, the far side of a table)
        dl = os.environ["PRAYDIRS"].split(",") if os.environ.get("PRAYDIRS") else GENERIC_DIRS.get(action, ["se", "sw"])
        for d in dl:
            sx, sy = DIRS[d]
            arm.rotation_euler = (0, 0, math.radians(facing_angle(sx, sy) - yaw))
            sheet = np.zeros((FH, FW * NF, 4), dtype=np.float32)
            for i in pose_frames(arm, action, base):
                p = os.path.join(tmp, f"{action}-{name}-{d}-{i}.png")
                scene.render.filepath = p
                props = build_props(arm, GENERIC_PROPS.get(action, []))
                bpy.ops.render.render(write_still=True)
                for o in props:
                    bpy.data.objects.remove(o)
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
    sleepers = [n for n in POSES["sleep"][1] if ("sleep", "se") in got.get(n, {})]
    if sleepers:
        # lying sheets have their own frame size: one row per variant, se then sw
        cs = np.zeros((SLEEP_H * len(sleepers), SLEEP_W * 2, 4), dtype=np.float32)
        cs[..., :3], cs[..., 3] = 0.9, 1
        for r, n in enumerate(reversed(sleepers)):
            for c, d in enumerate(POSE_DIRS):
                a = got[n][("sleep", d)]
                y0, x0 = r * SLEEP_H, c * SLEEP_W
                al = a[..., 3:4]
                cs[y0:y0 + SLEEP_H, x0:x0 + SLEEP_W, :3] = a[..., :3] * al + cs[y0:y0 + SLEEP_H, x0:x0 + SLEEP_W, :3] * (1 - al)
                cs[y0 + SLEEP_H // 2, x0 + SLEEP_W // 2 - 3:x0 + SLEEP_W // 2 + 4, :3] = (0.8, 0.2, 0.2)  # anchor
        write_png(cs, os.path.join(OUT, "sleep-contact.png"))
    for action in ("pray_salah", "pray_church", "kneel_pray", "lift_weights", "boxing", "pushups", "skip_rope", *WORK_ACTIONS):
        rows = [n for n in POSES[action][1] if any(len(k) == 3 and k[0] == action for k in got.get(n, {}))]
        if not rows:
            continue
        W, n = PRAY_FRAME.get(action) or EX_FRAME.get(action) or (FW, NF)
        dirs = [d for d in (PRAY_DIRS.get(action) or EX_DIRS.get(action) or WORK_DIRS.get(action, ALL_DIRS)) if any((action, d, 0) in got[nm] for nm in rows)] or sorted({k[1] for nm in rows for k in got[nm] if k[0] == action})
        FHc = 112 if action in EX_CENTRED else FH
        cs = np.zeros((FHc * len(rows) * len(dirs), W * n, 4), dtype=np.float32)
        cs[..., :3], cs[..., 3] = 0.9, 1
        r = 0
        for nm in reversed(rows):
            for d in reversed(dirs):
                for i in range(n):
                    a = got[nm].get((action, d, i))
                    if a is None:
                        continue
                    y0, x0 = r * FHc, i * W
                    al = a[..., 3:4]
                    cs[y0:y0 + FHc, x0:x0 + W, :3] = a[..., :3] * al + cs[y0:y0 + FHc, x0:x0 + W, :3] * (1 - al)
                    cs[y0 + FOOT_PX, x0:x0 + W, :3] = (0.7, 0.4, 0.4)
                r += 1
        write_png(cs, os.path.join(OUT, f"{action}-contact.png"))
    cells = []
    for action in POSES:
        if action in ("sleep", "pray_salah", "pray_church", "kneel_pray", "lift_weights", "boxing", "pushups", "skip_rope", *WORK_ACTIONS):
            continue
        row = []
        for name in POSES[action][1]:
            for d in POSE_DIRS:
                row.append(got.get(name, {}).get((action, d)))
        if any(x is not None for x in row):
            cells.append(row)
    if not cells:
        print("DONE poses")
        sys.exit(0)
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
