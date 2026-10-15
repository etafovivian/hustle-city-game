# Pet sprite sheets for Naija Hustle City, in the same isometric toon look as the people (sprites.py LOOK=toon).
#   blender -b -P pets.py -- <outdir> [kind ...]
# Each pet is built from simple shapes (ellipsoids and tapered limbs) on pivots, and animated by hand per frame:
# a trot for the dogs, a softer walk for the cats, hops for the parrot. Same camera (2:1 isometric, 76 px per metre)
# and cel-shaded colours with ink outlines as the people, so a pet stands to scale next to them.
# Output per kind: <kind>-walk-{se,sw,ne,nw}.png, <kind>-{sit,sleep,eat,play}-{se,sw}.png (parrot: walk = hop,
# sit = perched, fly-{se,sw,ne,nw}, no play), 8 frames each of FW x FH, ground FOOT_PX above the frame bottom.
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index("--") + 1:]
OUT = args[0]
ONLY = set(args[1:])
os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(OUT, "_frames")
os.makedirs(TMP, exist_ok=True)

FW, FH, NF = 128, 112, 8  # (room for a Boerboel side-on)
PPM = 76.0
FOOT_PX = 18
SS = 2
ELEV = math.degrees(math.atan(0.5))
CAM_AZ = -45.0
OUTLINE = (0x1b / 255, 0x14 / 255, 0x10 / 255)
DIRS = {"se": (1, 1), "sw": (-1, 1), "ne": (1, -1), "nw": (-1, -1)}


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


def cam_axes():
    az, el = math.radians(CAM_AZ), math.radians(ELEV)
    to_cam = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
    right = Vector((-math.sin(az), math.cos(az), 0))
    up = to_cam.cross(right).normalized()
    if up.z < 0:
        up = -up
    return to_cam, right, up


def facing_angle(sx, sy_down):
    """Z rotation (deg) making a model that faces -Y face that screen direction (as sprites.py)."""
    to_cam, right, _ = cam_axes()
    toward = Vector((to_cam.x, to_cam.y, 0)).normalized()
    g = right * sx + toward * sy_down
    return math.degrees(math.atan2(g.x, -g.y))


# ------------------------------------------------------------------ scene
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    to_cam, right, up = cam_axes()
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "VERTICAL"
    cam.data.ortho_scale = FH / PPM
    cam.location = up * ((FH / 2 - FOOT_PX) / PPM) + to_cam * 20
    cam.rotation_euler = (-to_cam).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 100
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 0
    scene.cycles.filter_width = 1.0
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x, scene.render.resolution_y = FW * SS, FH * SS
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.world = bpy.data.worlds.new("w")
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = "ABSOLUTE"
    vl = bpy.context.view_layer
    vl.use_freestyle = True
    ls = vl.freestyle_settings.linesets[0] if len(vl.freestyle_settings.linesets) else vl.freestyle_settings.linesets.new("ink")
    ls.select_by_visibility = True
    ls.select_by_edge_types = True
    ls.select_silhouette = ls.select_border = ls.select_external_contour = ls.select_material_boundary = True
    ls.select_contour = True
    ls.select_crease = False
    st = ls.linestyle or bpy.data.linestyles.new("ink")
    ls.linestyle = st
    st.color = tuple(srgb_to_lin(c) for c in OUTLINE)
    st.thickness = 3.4
    st.use_length_min = True
    st.length_min = 6.0 * SS
    global LIGHT
    LIGHT = tuple((-right * 0.55 + Vector((0, 0, 1)) * 0.75 + to_cam * 0.35).normalized())
    return scene


LIGHT = (0, 0, 1)
MATS = {}


def toon(hexcol):
    if hexcol in MATS:
        return MATS[hexcol]
    base = tuple(srgb_to_lin(c) for c in hexrgb(hexcol))
    m = bpy.data.materials.new("toon_" + hexcol)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = LIGHT
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY_ADD"
    fac.inputs[1].default_value, fac.inputs[2].default_value = 0.5, 0.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    cr.elements[0].position, cr.elements[0].color = 0.0, (base[0] * 0.58, base[1] * 0.52, base[2] * 0.64, 1)
    cr.elements[1].position, cr.elements[1].color = 0.44, (*base, 1)
    e = cr.elements.new(0.8)
    e.color = (min(1, base[0] * 1.18), min(1, base[1] * 1.1), min(1, base[2] * 0.98), 1)
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], fac.inputs[0])
    nt.links.new(fac.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    MATS[hexcol] = m
    return m


def ellipsoid(name, c, r, col, parent=None, segs=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(8, segs // 2), radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(toon(col))
    for p in me.polygons:
        p.use_smooth = True
    o.parent = parent
    o.location = c
    return o


def limb(name, length, r0, r1, col, parent, at):
    """A tapered limb hanging down from a pivot at `at` (in the parent's space); returns the pivot."""
    piv = bpy.data.objects.new(name + "_pivot", None)
    bpy.context.scene.collection.objects.link(piv)
    piv.parent = parent
    piv.location = at
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r1, radius2=r0, depth=length,
                          matrix=Matrix.Translation((0, 0, -length / 2)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(toon(col))
    for p in me.polygons:
        p.use_smooth = True
    o.parent = piv
    return piv


# ------------------------------------------------------------------ the pets
# (height of the back in m, body length, coat colour, belly/muzzle colour, paws, tail kind, ears, extras)
DOGS = {
    "dog_local": dict(back=0.5, length=0.62, coat="#c08a52", light="#e2bf8f", dark="#5a3a22", fluff=1.0, ears="up", tail="curl"),
    "lhasa": dict(back=0.27, length=0.4, coat="#efe3c8", light="#f7f0df", dark="#3a2a1a", fluff=1.35, ears="drop", tail="plume"),
    "boerboel": dict(back=0.64, length=0.78, coat="#c9a067", light="#d9b27c", dark="#3a2a1e", fluff=0.95, ears="drop", tail="straight", bulk=1.25),
    "shepherd": dict(back=0.6, length=0.78, coat="#a8692e", light="#c98a45", dark="#1d1712", fluff=1.0, ears="up", tail="brush", saddle="#1d1712"),
    "cat_tabby": dict(back=0.24, length=0.42, coat="#8a6a48", light="#b89a76", dark="#3a2a1e", fluff=0.9, ears="cat", tail="cat", cat=True, stripes="#4a3624"),
    "cat_black": dict(back=0.24, length=0.42, coat="#26232a", light="#3a3640", dark="#141216", fluff=0.9, ears="cat", tail="cat", cat=True, eyes="#e6c62e"),
}
KINDS = list(DOGS) + ["parrot"]


class Quad:
    """A four-legged pet: body, head, ears, tail and four legs on pivots. Faces -Y, feet at z=0."""

    def __init__(self, kind):
        d = DOGS[kind]
        self.d = d
        self.root = bpy.data.objects.new("pet", None)
        bpy.context.scene.collection.objects.link(self.root)
        L, H = d["length"], d["back"]
        bulk = d.get("bulk", 1.0)
        leg = H * 0.48
        self.leg = leg
        bw = L * 0.25 * bulk * d["fluff"]
        bh = H * 0.33 * bulk * d["fluff"]
        self.body = bpy.data.objects.new("body_piv", None)
        bpy.context.scene.collection.objects.link(self.body)
        self.body.parent = self.root
        self.body.location = (0, 0, leg + bh * 0.6)
        ellipsoid("body", (0, 0, 0), (bw, L * 0.5, bh), d["coat"], self.body)
        ellipsoid("belly", (0, 0, -bh * 0.35), (bw * 0.8, L * 0.42, bh * 0.6), d["light"], self.body)
        if d.get("saddle"):
            ellipsoid("saddle", (0, L * 0.06, bh * 0.35), (bw * 1.02, L * 0.34, bh * 0.7), d["saddle"], self.body)
        if d.get("stripes"):
            for k in range(4):
                ellipsoid(f"stripe{k}", (0, -L * 0.25 + k * L * 0.15, bh * 0.55), (bw * 1.03, L * 0.035, bh * 0.5), d["stripes"], self.body, 10)
        # head on a neck pivot at the front
        self.neck = bpy.data.objects.new("neck_piv", None)
        bpy.context.scene.collection.objects.link(self.neck)
        self.neck.parent = self.body
        self.neck.location = (0, -L * 0.45, bh * 0.55)
        hs = (L * 0.2 if not d.get("cat") else L * 0.22) * d["fluff"] ** 0.5
        ellipsoid("head", (0, -hs * 0.4, hs * 0.55), (hs, hs * 1.05, hs * 0.95), d["coat"], self.neck)
        if not d.get("cat"):
            ellipsoid("muzzle", (0, -hs * 1.35, hs * 0.3), (hs * 0.55, hs * 0.8, hs * 0.5), d["light"] if kind != "boerboel" else d["dark"], self.neck)
            ellipsoid("nose", (0, -hs * 2.05, hs * 0.42), (hs * 0.18, hs * 0.14, hs * 0.14), "#141012", self.neck, 10)
        else:
            ellipsoid("muzzle", (0, -hs * 1.15, hs * 0.35), (hs * 0.45, hs * 0.35, hs * 0.32), d["light"], self.neck)
            ellipsoid("nose", (0, -hs * 1.45, hs * 0.5), (hs * 0.1, hs * 0.07, hs * 0.07), "#d07a7a", self.neck, 8)
        for s in (-1, 1):
            ellipsoid(f"eye{s}", (s * hs * 0.45, -hs * 1.2, hs * 0.8), (hs * 0.13, hs * 0.08, hs * 0.13), d.get("eyes", "#141012"), self.neck, 8)
            if d["ears"] == "up":
                ellipsoid(f"ear{s}", (s * hs * 0.55, -hs * 0.3, hs * 1.5), (hs * 0.22, hs * 0.12, hs * 0.5), d["coat"], self.neck, 10)
            elif d["ears"] == "cat":
                ellipsoid(f"ear{s}", (s * hs * 0.55, -hs * 0.35, hs * 1.4), (hs * 0.25, hs * 0.1, hs * 0.38), d["coat"], self.neck, 8)
            else:
                ellipsoid(f"ear{s}", (s * hs * 0.95, -hs * 0.35, hs * 0.55), (hs * 0.2, hs * 0.32, hs * 0.6 * d["fluff"]), d["coat"] if kind != "boerboel" else d["dark"], self.neck, 10)
        # tail on a pivot at the back
        self.tail = bpy.data.objects.new("tail_piv", None)
        bpy.context.scene.collection.objects.link(self.tail)
        self.tail.parent = self.body
        self.tail.location = (0, L * 0.48, bh * 0.3)
        tk = d["tail"]
        if tk == "curl":
            ellipsoid("tail", (0, L * 0.04, bh * 0.45), (bh * 0.22, L * 0.1, bh * 0.5), d["coat"], self.tail, 10)
        elif tk == "plume":
            ellipsoid("tail", (0, L * 0.04, bh * 0.5), (bh * 0.42, L * 0.16, bh * 0.5), d["coat"], self.tail, 12)
        elif tk == "brush":
            ellipsoid("tail", (0, L * 0.18, -bh * 0.4), (bh * 0.22, L * 0.22, bh * 0.28), d["dark"], self.tail, 10)
        elif tk == "cat":
            ellipsoid("tail", (0, L * 0.12, bh * 0.75), (bh * 0.12, L * 0.08, bh * 0.95), d["coat"], self.tail, 10)
        else:
            ellipsoid("tail", (0, L * 0.18, -bh * 0.1), (bh * 0.14, L * 0.2, bh * 0.16), d["coat"], self.tail, 10)
        # legs
        lr = bw * 0.32
        self.legs = {}
        for side, s in (("l", 1), ("r", -1)):
            for end, y in (("f", -L * 0.36), ("b", L * 0.36)):
                piv = limb(f"leg_{end}{side}", leg + bh * 0.3, lr, lr * 0.75, d["coat"], self.root, (s * bw * 0.55, y, leg + bh * 0.25))
                paw = ellipsoid(f"paw_{end}{side}", (0, -lr * 0.3, -(leg + bh * 0.3)), (lr * 0.95, lr * 1.25, lr * 0.55), d["light"] if not d.get("cat") or kind == "cat_tabby" else d["coat"], piv, 10)
                self.legs[end + side] = piv
        self.bh = bh
        self.L = L

    def pose(self, action, t, frame):
        """Sets the pose for frame `frame` of an 8-frame loop (t = frame / 8)."""
        ph = 2 * math.pi * t
        d, L, leg, bh = self.d, self.L, self.leg, self.bh
        for k, p in self.legs.items():
            p.rotation_euler = (0, 0, 0)
            p.location.y = -L * 0.36 if k[0] == "f" else L * 0.36  # (the standing positions)
            p.location.z = leg + bh * 0.25
        self.body.rotation_euler = (0, 0, 0)
        self.body.location.y = 0
        self.neck.rotation_euler = (0, 0, 0)
        self.tail.rotation_euler = (0, 0, 0)
        self.body.location.z = leg + bh * 0.6
        self.root.location = (0, 0, 0)
        cat = d.get("cat")
        if action == "walk":
            sw = math.radians(28 if not cat else 22)
            # a trot: diagonal pairs together
            for k, p in self.legs.items():
                off = 0 if k in ("fl", "br") else math.pi
                p.rotation_euler = (sw * math.sin(ph + off), 0, 0)
            self.body.location.z += 0.012 * abs(math.sin(2 * ph))
            self.tail.rotation_euler = (0, 0.35 * math.sin(2 * ph), 0)
            self.neck.rotation_euler = (math.radians(4 * math.sin(2 * ph)), 0, 0)
        elif action == "sit":
            # sitting on the haunches, front legs straight, head up, tail curled round
            tilt = math.radians(38)
            self.body.rotation_euler = (-tilt, 0, 0)
            self.body.location.z = leg * 0.45 + bh * 1.2
            self.body.location.y = L * 0.18
            for k in ("bl", "br"):  # haunches: hind legs folded forward under the body
                self.legs[k].rotation_euler = (math.radians(85), 0, 0)
                self.legs[k].location.z = bh * 0.55
                self.legs[k].location.y = L * 0.3
            for k in ("fl", "fr"):
                self.legs[k].rotation_euler = (math.radians(8), 0, 0)
                self.legs[k].location.z = leg + bh * 0.25
                self.legs[k].location.y = -L * 0.12
            self.neck.rotation_euler = (math.radians(28 + 3 * math.sin(ph)), 0, 0)
            self.tail.rotation_euler = (math.radians(70), 0.25 * math.sin(ph), 0)
            return
        elif action == "sleep":
            # curled up asleep on its side, breathing
            # lying down: chest on the floor, front legs stretched out, head resting on the paws, breathing
            self.body.location.z = bh * 0.95 * (1 + 0.03 * math.sin(ph))
            for k, p in self.legs.items():
                p.rotation_euler = (math.radians(-88 if k[0] == "f" else 88), 0, 0)
                p.location.z = bh * 0.35
            self.neck.rotation_euler = (math.radians(-38), 0, math.radians(12))
            self.tail.rotation_euler = (math.radians(-60), 0, math.radians(35))
            return
        elif action == "eat":
            # head down in the bowl, tail wagging
            self.neck.rotation_euler = (math.radians(-55 - 6 * math.sin(2 * ph)), 0, 0)
            self.tail.rotation_euler = (0, 0.45 * math.sin(2 * ph), 0)
        elif action == "play":
            # a play bow: front down, rear up, tail going, a little bounce
            b = 0.5 - 0.5 * math.cos(2 * ph)
            self.body.rotation_euler = (math.radians(14 + 6 * b), 0, 0)
            for k in ("fl", "fr"):
                self.legs[k].rotation_euler = (math.radians(-50), 0, 0)
            self.body.location.z = leg * (0.8 + 0.1 * b) + bh * 0.6
            self.tail.rotation_euler = (math.radians(-30), 0.6 * math.sin(2 * ph), 0)
            self.neck.rotation_euler = (math.radians(10), 0, math.radians(8 * math.sin(ph)))
        for k in self.legs.values():
            k.location.z = leg + bh * 0.25

    def props(self, action, t):
        """Bowl, ball or string for this frame (removed after the render)."""
        made = []
        L = self.L
        if action == "eat":
            made.append(ellipsoid("bowl", (0, -L * 0.75, 0.035), (L * 0.17, L * 0.17, 0.035), "#c8321e", self.root))
            made.append(ellipsoid("food", (0, -L * 0.75, 0.06), (L * 0.13, L * 0.13, 0.015), "#8a5a2a", self.root))
        if action == "play":
            ph = 2 * math.pi * t
            if self.d.get("cat"):
                # a ball of yarn on a string, batted between the paws
                made.append(ellipsoid("yarn", (0.05 * math.sin(ph), -L * 0.75, 0.04 + 0.03 * abs(math.sin(ph))), (0.045, 0.045, 0.045), "#d94f7a", self.root, 12))
            else:
                b = abs(math.sin(ph))
                made.append(ellipsoid("ball", (0.06 * math.sin(ph), -L * 0.85, 0.05 + 0.1 * b), (0.05, 0.05, 0.05), "#e8d21f", self.root, 12))
        return made


class Parrot:
    """An African grey: grey body, scalloped lighter head, red tail, black beak; walks by hopping, flies with
    flapping wings. Faces -Y, feet at z=0."""

    def __init__(self):
        self.root = bpy.data.objects.new("pet", None)
        bpy.context.scene.collection.objects.link(self.root)
        self.root.scale = (1.5, 1.5, 1.5)  # (a touch over life size, so it reads next to people)
        self.body = bpy.data.objects.new("body_piv", None)
        bpy.context.scene.collection.objects.link(self.body)
        self.body.parent = self.root
        self.body.location = (0, 0, 0.13)
        ellipsoid("body", (0, 0, 0), (0.06, 0.07, 0.1), "#8f949a", self.body)
        ellipsoid("chest", (0, -0.025, -0.01), (0.05, 0.05, 0.08), "#a7acb2", self.body)
        ellipsoid("head", (0, -0.03, 0.115), (0.05, 0.055, 0.05), "#b2b7bd", self.body)
        ellipsoid("face", (0, -0.065, 0.11), (0.03, 0.02, 0.03), "#e8eaec", self.body, 10)
        ellipsoid("beak", (0, -0.095, 0.1), (0.016, 0.022, 0.02), "#141012", self.body, 10)
        for s in (-1, 1):
            ellipsoid(f"eye{s}", (s * 0.03, -0.07, 0.125), (0.009, 0.006, 0.009), "#141012", self.body, 8)
        self.tail = bpy.data.objects.new("tail_piv", None)
        bpy.context.scene.collection.objects.link(self.tail)
        self.tail.parent = self.body
        self.tail.location = (0, 0.06, -0.07)
        ellipsoid("tail", (0, 0.04, -0.03), (0.035, 0.05, 0.035), "#c8211e", self.tail, 10)
        self.wings = []
        for s in (-1, 1):
            piv = bpy.data.objects.new(f"wing{s}", None)
            bpy.context.scene.collection.objects.link(piv)
            piv.parent = self.body
            piv.location = (s * 0.055, 0.0, 0.04)
            ellipsoid(f"wingm{s}", (s * 0.01, 0.015, -0.04), (0.018, 0.06, 0.08), "#7b8086", piv, 12)
            self.wings.append((piv, s))
        for s in (-1, 1):
            ellipsoid(f"foot{s}", (s * 0.025, -0.01, -0.12), (0.014, 0.02, 0.012), "#5a5a5e", self.body, 8)

    def pose(self, action, t, frame):
        ph = 2 * math.pi * t
        self.root.location = (0, 0, 0)
        self.body.rotation_euler = (0, 0, 0)
        self.body.location.z = 0.13
        for piv, s in self.wings:
            piv.rotation_euler = (0, 0, 0)
        self.tail.rotation_euler = (0, 0, 0)
        if action == "walk":  # hop, hop
            hop = max(0.0, math.sin(2 * ph))
            self.body.location.z += 0.05 * hop
            self.body.rotation_euler = (math.radians(-8 * hop), 0, 0)
            self.tail.rotation_euler = (math.radians(10 * hop), 0, 0)
        elif action == "sit":  # perched, preening now and then
            self.body.rotation_euler = (0, 0, math.radians(10 * math.sin(ph)))
            self.tail.rotation_euler = (math.radians(4 * math.sin(2 * ph)), 0, 0)
        elif action == "sleep":  # fluffed up, head tucked
            self.body.rotation_euler = (math.radians(12), 0, math.radians(30))
            self.body.location.z = 0.12 + 0.004 * math.sin(ph)
        elif action == "eat":
            self.body.rotation_euler = (math.radians(-35 - 8 * math.sin(2 * ph)), 0, 0)
        elif action == "fly":  # in the air, wings flapping
            self.body.location.z = 0.55 + 0.03 * math.sin(ph)
            self.body.rotation_euler = (math.radians(-35), 0, 0)
            for piv, s in self.wings:
                piv.rotation_euler = (0, math.radians(s * (70 * math.sin(2 * ph) + 15)), 0)

    def props(self, action, t):
        if action == "eat":
            return [ellipsoid("bowl", (0, -0.14, 0.025), (0.07, 0.07, 0.025), "#2f5fb3", self.root),
                    ellipsoid("seeds", (0, -0.14, 0.045), (0.055, 0.055, 0.01), "#d8b45a", self.root, 10)]
        return []


# ------------------------------------------------------------------ render
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


def downsample(a):
    h, w = a.shape[0] // SS, a.shape[1] // SS
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4]
    pm = pm.reshape(h, SS, w, SS, 4).mean(axis=(1, 3))
    al = pm[..., 3:4]
    pm[..., :3] = np.where(al > 1e-4, pm[..., :3] / np.maximum(al, 1e-4), 0)
    return pm


def render_kind(kind):
    scene = reset_scene()
    MATS.clear()
    pet = Parrot() if kind == "parrot" else Quad(kind)
    acts = {"walk": list(DIRS), "sit": ["se", "sw"], "sleep": ["se", "sw"], "eat": ["se", "sw"]}
    if kind == "parrot":
        acts["fly"] = list(DIRS)
    else:
        acts["play"] = ["se", "sw"]
    for action, dirs in acts.items():
        for d in dirs:
            sx, sy = DIRS[d]
            sheet = np.zeros((FH, FW * NF, 4), dtype=np.float32)
            for i in range(NF):
                pet.pose(action, i / NF, i)
                pet.root.rotation_euler = (0, 0, math.radians(facing_angle(sx, sy)))
                bpy.context.view_layer.update()
                props = pet.props(action, i / NF)
                p = os.path.join(TMP, f"{kind}-{action}-{d}-{i}.png")
                scene.render.filepath = p
                bpy.ops.render.render(write_still=True)
                for o in props:
                    bpy.data.objects.remove(o)
                sheet[:, i * FW:(i + 1) * FW] = downsample(read_png(p))
            write_png(sheet, os.path.join(OUT, f"{kind}-{action}-{d}.png"))
            print("SHEET", kind, action, d)


for k in KINDS:
    if ONLY and k not in ONLY:
        continue
    render_kind(k)
print("DONE pets")
