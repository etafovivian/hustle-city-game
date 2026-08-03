# Builds low-poly hair pieces fitted to the Universal Animation Library mannequin head and exports each
# as its own .glb (rest-pose coordinates), plus a preview render per style.
#   blender -b -P hair.py -- ual.glb outdir
import bpy, bmesh, math, os, sys, random
from mathutils import Vector

src, out = sys.argv[-2], sys.argv[-1]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for a in bpy.data.objects:
    if a.type == "ARMATURE":
        a.data.pose_position = "REST"
bpy.context.view_layer.update()

# Head size from the mesh itself: vertices above the neck, near the centre line.
vs = [body.matrix_world @ v.co for v in body.data.vertices]
head = [v for v in vs if v.z > 1.62 and abs(v.x) < 0.2]
cx = sum(v.x for v in head) / len(head)
cy = (min(v.y for v in head) + max(v.y for v in head)) / 2
zmin, zmax = min(v.z for v in head), max(v.z for v in head)
rx = (max(v.x for v in head) - min(v.x for v in head)) / 2
ry = (max(v.y for v in head) - min(v.y for v in head)) / 2
rz = (zmax - 1.58) / 2
cz = zmax - rz
C = Vector((cx, cy, cz))
print(f"HEAD centre {tuple(round(c,3) for c in C)} radii {rx:.3f} {ry:.3f} {rz:.3f}")
# In Blender after glTF import the face looks towards -Y.

def mat(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)  # used by the workbench preview
    return m

HAIR = mat("hair", (0.02, 0.014, 0.01))
GOLD = mat("gele", (0.9, 0.55, 0.03), 0.5)
RED = mat("cap", (0.75, 0.08, 0.06), 0.6)

def obj_from_bm(bm, name, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o

def hairline(y):
    t = max(-1.0, min(1.0, (y - cy) / ry))  # -1 front, +1 back
    return cz + rz * (0.28 - 0.45 * (t + 1))  # forehead high, nape low

def shell(thick, keep, lump=0.0):
    """Hair that fits exactly: the head's own surface, pushed out along its normals by `thick` metres.
    `keep(v)` chooses which head vertices (world space) the hair covers."""
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.transform(bm, matrix=body.matrix_world, verts=bm.verts)
    head_zone = lambda v: v.co.z > 1.58 and abs(v.co.x) < 0.2 and abs(v.co.y - cy) < 0.2
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not (head_zone(v) and keep(v.co))], context="VERTS")
    bm.normal_update()
    rnd = random.Random(7)
    for v in bm.verts:
        v.co += v.normal * (thick + (lump * rnd.uniform(0, 1) if lump else 0))
    return bm

def cap(thick=0.008, lump=0.0, cut=True):
    return shell(thick, (lambda c: c.z > hairline(c.y)) if cut else (lambda c: True), lump)

def top_of(bm):
    return max(v.co.z for v in bm.verts)

def add_tube(bm, a, b, r, segs=6):
    """A capped cylinder from a to b (a braid or loc)."""
    d = b - a
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r * 0.8, depth=d.length)
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=rot, verts=res["verts"])
    bmesh.ops.translate(bm, vec=(a + b) / 2, verts=res["verts"])

def add_ellipsoid(bm, centre, radii, segs=16):
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(8, segs // 2), radius=1.0)
    for v in res["verts"]:
        v.co = Vector((centre.x + v.co.x * radii[0], centre.y + v.co.y * radii[1], centre.z + v.co.z * radii[2]))

def strands(bm, n, r, length, back_only=False):
    for i in range(n):
        ang = math.pi * (0.15 + 0.7 * i / max(1, n - 1)) if back_only else 2 * math.pi * i / n
        # Around the head: x sideways, +y towards the back. Skip the face for all-round styles.
        dx, dy = math.cos(ang), math.sin(ang)
        if not back_only and dy < -0.35:
            continue
        top = Vector((cx + dx * rx * 0.95, cy + dy * ry * 0.95, hairline(cy + dy * ry) + 0.03))
        bottom = top + Vector((dx * 0.03, dy * 0.04, -length))
        add_tube(bm, top, bottom, r)

STYLES = {}
def style(name):
    def deco(fn):
        STYLES[name] = fn
        return fn
    return deco

@style("low_cut")
def _():
    return obj_from_bm(cap(0.007), "low_cut", HAIR)

@style("buzzcut")
def _():
    return obj_from_bm(cap(0.004), "buzzcut", HAIR)

@style("curly")
def _():
    return obj_from_bm(cap(0.018, lump=0.012), "curly", HAIR)

@style("high_top")
def _():
    bm = cap(0.012)
    t = top_of(bm)
    # The block starts down at the temples so it grows out of the hair, flat on top.
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=rx * 1.08, radius2=rx * 1.0, depth=0.13)
    bmesh.ops.scale(bm, vec=(1, ry / rx * 0.92, 1), verts=res["verts"])
    bmesh.ops.translate(bm, vec=Vector((cx, cy + 0.008, t - 0.015)), verts=res["verts"])
    return obj_from_bm(bm, "high_top", HAIR)

@style("puff")
def _():
    bm = cap(0.008)
    add_ellipsoid(bm, Vector((cx, cy + ry * 0.25, top_of(bm) + 0.005)), (0.08, 0.08, 0.072))
    return obj_from_bm(bm, "puff", HAIR)

@style("bob")
def _():
    # Covers the back and sides down to the jaw, leaving the face open, puffed out.
    face = lambda c: c.y < cy - ry * 0.2 and c.z < cz + rz * 0.35
    return obj_from_bm(shell(0.03, lambda c: c.z > cz - rz * 0.95 and not face(c)), "bob", HAIR)

@style("braids")
def _():
    bm = cap(0.007)
    strands(bm, 16, 0.011, 0.34)
    return obj_from_bm(bm, "braids", HAIR)

@style("locs")
def _():
    bm = cap(0.012)
    strands(bm, 14, 0.017, 0.22)
    return obj_from_bm(bm, "locs", HAIR)

@style("gele")
def _():
    # A wrapped headtie: a band over the forehead and crown, a raised top and pleated fans at the back.
    bm = shell(0.025, lambda c: c.z > cz - rz * 0.1)
    t = top_of(bm)
    add_ellipsoid(bm, Vector((cx, cy + 0.015, t - 0.035)), (rx * 1.15, ry * 1.08, 0.065))
    for i in range(5):
        a = math.radians(-60 + 30 * i)
        add_ellipsoid(bm, Vector((cx + math.sin(a) * 0.075, cy + ry * 0.7, t - 0.005 + math.cos(a) * 0.035)), (0.055, 0.016, 0.075), 12)
    return obj_from_bm(bm, "gele", GOLD)

@style("cap")
def _():
    bm = shell(0.012, lambda c: c.z > cz + rz * 0.05)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=rx * 0.9, radius2=rx * 0.9, depth=0.01)
    bmesh.ops.scale(bm, vec=(1, 0.8, 1), verts=res["verts"])
    bmesh.ops.translate(bm, vec=Vector((cx, cy - ry * 0.95, cz + rz * 0.12)), verts=res["verts"])
    return obj_from_bm(bm, "cap", RED)

# Preview: camera at three-quarter front, simple light, workbench render.
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x = scene.render.resolution_y = 360
scene.render.film_transparent = True
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
cam.location = (cx + 0.55, cy - 0.75, cz + 0.12)
cam.rotation_euler = (math.radians(84), 0, math.radians(36))
cam.data.lens = 85
scene.camera = cam

for name, build in STYLES.items():
    o = build()
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"hair-{name}.glb"), use_selection=True, export_apply=True, export_materials="EXPORT")
    scene.render.filepath = os.path.join(out, f"preview-{name}.png")
    bpy.ops.render.render(write_still=True)
    o.hide_render = True
    print("BUILT", name, len(o.data.polygons), "faces")
