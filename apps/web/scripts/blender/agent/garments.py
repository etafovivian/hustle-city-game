# Loose garments (agbada, kaftan, buba + wrapper, peplum gown) skinned to the body skeleton.
#   blender -b -P garments.py -- <body-Male.glb> <body-Female.glb> <outdir> [only_key ...]
# Method: put the body in a "build pose" (rest legs/spine, arms lowered as in Idle frame 1), sample
# the body's cross-sections (convex support per angle) to loft loose tubes around torso, legs and arms,
# weight them (torso: nearest body verts; skirts: pelvis/thigh blend by side and height; sleeves: one
# weight set per ring from the arm under it), then invert the skinning to get rest-pose coordinates.
# Writes garment-{man|woman}-{key}.glb (armature + one skinned mesh) and Workbench previews.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

SKIN = (0.25, 0.14, 0.08)


class Part:
    def __init__(self):
        self.v, self.f, self.w = [], [], []

    def add(self, verts, faces, weights):
        o = len(self.v)
        self.v += verts
        self.w += weights
        self.f += [tuple(i + o for i in f) for f in faces]


def grid(rings, closed=True, drop=None):
    """Quads between consecutive rings. drop(i, j, centre) -> True removes that face."""
    n = len(rings[0])
    verts = [p for r in rings for p in r]
    faces = []
    for i in range(len(rings) - 1):
        for j in range(n if closed else n - 1):
            j2 = (j + 1) % n
            q = (i * n + j, (i + 1) * n + j, (i + 1) * n + j2, i * n + j2)
            if drop and drop(i, j, sum((verts[k] for k in q), Vector()) / 4):
                continue
            faces.append(q)
    return verts, faces


def top_levels(F, zt, hem, step):
    """Dense rings over the neck/shoulder slope (so the body does not poke through between rings)."""
    return [zt] + levels(zt - 0.015, F.z_shoulder - 0.02, 0.017)[:-1] + levels(F.z_shoulder - 0.02, hem, step)


def levels(top, bottom, step):
    k = max(1, round((top - bottom) / step))
    return [top + (bottom - top) * i / k for i in range(k + 1)]


class Fit:
    def __init__(self, arm, body):
        self.arm = arm
        build_pose(arm)
        self.B = B = BodyData(arm, body)
        rh = B.rest_head
        self.z_neck = rh("neck_01").z
        self.z_hip = rh("thigh_l").z
        self.z_knee = rh("calf_l").z
        self.z_ankle = rh("foot_l").z
        self.z_waist = rh("spine_01").z + 0.03
        self.chain = {}
        for s in "lr":
            sh, el, wr = B.bone_head(f"upperarm_{s}"), B.bone_head(f"lowerarm_{s}"), B.bone_head(f"hand_{s}")
            self.chain[s] = [sh + (sh - el).normalized() * 0.05, sh, el, wr]
        self.z_wrist = (self.chain["l"][3].z + self.chain["r"][3].z) / 2
        self.z_shoulder = (self.chain["l"][1].z + self.chain["r"][1].z) / 2
        print("FIT neck %.3f shoulder %.3f waist %.3f hip %.3f knee %.3f ankle %.3f wrist %.3f" % (
            self.z_neck, self.z_shoulder, self.z_waist, self.z_hip, self.z_knee, self.z_ankle, self.z_wrist))

    # ---------- weights ----------
    def skirt_w(self, p, thigh_max=0.95):
        s = smoothstep(-0.12, 0.12, p.x)
        f = smoothstep(self.z_hip, self.z_knee, p.z)
        t = 0.4 + (thigh_max - 0.4) * f
        # below the knee part of the leg weight moves to the calves, so a long skirt follows the shins
        # (the back leg kicking up would otherwise poke through)
        c = 0.55 * smoothstep(self.z_knee, self.z_knee - 0.3, p.z)
        return norm_w({"pelvis": 1 - t, "thigh_l": t * (1 - c) * s, "thigh_r": t * (1 - c) * (1 - s),
                       "calf_l": t * c * s, "calf_r": t * c * (1 - s)})

    def body_w(self, p):
        top = self.B.weights_near(p, TORSO)
        k = smoothstep(self.z_hip + 0.08, self.z_hip - 0.10, p.z)
        if k <= 0:
            return top
        return mix_w((1 - k, top), (k, self.skirt_w(p)))

    def arm_point(self, p, s):
        """Closest point to p on the arm chain of side s, and its parameter 0..1 along the chain."""
        ch = self.chain[s]
        best, bt, acc = None, 0, 0
        L = sum((ch[i + 1] - ch[i]).length for i in range(3))
        for i in range(3):
            a, b = ch[i], ch[i + 1]
            d = b - a
            t = max(0, min(1, (p - a).dot(d) / d.length_squared))
            q = a + d * t
            if best is None or (p - q).length < (p - best).length:
                best, bt = q, (acc + t * d.length) / L
            acc += d.length
        return best, bt

    # ---------- geometry ----------
    def neck_ell(self, z, m):
        pts = [p for p in self.B.pts({"neck_01"}, z - 0.03, z + 0.03)] or self.B.pts(TORSO, z - 0.02, z + 0.02)
        cy = (max(p.y for p in pts) + min(p.y for p in pts)) / 2
        return max(abs(p.x) for p in pts) + m, (max(p.y for p in pts) - min(p.y for p in pts)) / 2 + m, cy

    def body_loft(self, zs, mask, n, margin, minell=None, dz=0.025, smooth=1, exact=None, shoulders=True):
        """Rings around the body at heights zs. margin(z, ang) -> extra radius; minell(z) -> (a, b)
        minimum ellipse half-widths (x, y) or None."""
        B = self.B
        rows, cents = [], []
        allp = B.pts(mask)
        # the tops of the shoulders (deltoids) belong to the body tube, so there is no gap at the sleeve seam
        delt = B.pts({"upperarm_l", "upperarm_r"}, self.z_shoulder - 0.02) if shoulders else []
        for z in zs:
            pts = [p for p in allp if abs(p.z - z) < dz] + [p for p in delt if abs(p.z - z) < dz]
            if not pts:
                rows.append(rows[-1] if rows else [0.05] * n)
                cents.append(cents[-1] if cents else Vector((0, 0)))
                continue
            c = Vector((0.0, (min(p.y for p in pts) + max(p.y for p in pts)) / 2))
            cents.append(c)
            rows.append(support([(p.x, p.y) for p in pts], n, (c.x, c.y)))
        rows = [[max(x, y) for x, y in zip(r0, r1)] for r0, r1 in zip(rows, smooth_rows(rows, smooth))]
        cy = smooth_rows([[c.y] for c in cents], 2)
        rings = []
        for z, r, c in zip(zs, rows, cy):
            r = smooth_ring(r, 1)
            ring = []
            ex = exact(z) if exact else None
            if ex:
                c = [ex[2]]
            for j in range(n):
                a = 2 * math.pi * j / n
                rr = r[j] + margin(z, a)
                if ex:
                    rr = ex[0] * ex[1] / math.sqrt((ex[1] * math.cos(a)) ** 2 + (ex[0] * math.sin(a)) ** 2)
                if minell:
                    e = minell(z)
                    if e:
                        ea, eb = e[0], e[1]
                        pw = e[2] if len(e) > 2 else 2.0
                        rr = max(rr, (abs(math.cos(a) / ea) ** pw + abs(math.sin(a) / eb) ** pw) ** (-1 / pw))
                ring.append(Vector((rr * math.cos(a), c[0] + rr * math.sin(a), z)))
            rings.append(ring)
        return rings

    def sleeve(self, part, s, t0, t1, nrings, n, margin, flat=1.0):
        """Tube along the arm chain from parameter t0 to t1 (0 = above shoulder, 1 = wrist).
        margin(t) -> extra radius. Each ring gets the weights of the arm right under its centre."""
        B, ch = self.B, self.chain[s]
        seg = [(ch[i], ch[i + 1]) for i in range(3)]
        L = sum((b - a).length for a, b in seg)
        mask = ARM[s]
        apts = B.pts(mask)

        def at(t):
            d = t * L
            for a, b in seg:
                l = (b - a).length
                if d <= l or (a, b) == seg[-1]:
                    return a + (b - a) * min(1, d / l), (b - a).normalized()
                d -= l
        rings, weights = [], []
        prev = None
        for i in range(nrings):
            t = t0 + (t1 - t0) * i / (nrings - 1)
            c, d = at(t)
            e1 = Vector((0, 1, 0))
            e1 = (e1 - d * e1.dot(d)).normalized()
            e2 = d.cross(e1)
            loc = [((p - c).dot(e1), (p - c).dot(e2)) for p in apts
                   if abs((p - c).dot(d)) < 0.03 and (p - c).length < 0.2]
            r = support(loc, n) if loc else prev
            if r is None:
                r = [0.05] * n
            prev = r
            r = smooth_ring(r, 2)
            m = margin(t)
            ring = []
            for j in range(n):
                a = 2 * math.pi * j / n
                rr = max(r[j], 0.03) + m
                # flat < 1 squashes sideways (towards the body) so wide sleeves hang like panels
                ring.append(c + e1 * (rr * math.cos(a)) + e2 * (rr * math.sin(a) * (flat if math.sin(a) * (1 if s == "l" else -1) < 0 else 1)))
            rings.append(ring)
            w = B.weights_near(c, mask | {f"clavicle_{s}"}, k=10)
            weights += [w] * n
        v, f = grid(rings)
        part.add(v, f, weights)

    def finish(self, part, name, mat):
        me = bpy.data.meshes.new(name)
        # drop unused verts
        used = sorted({i for f in part.f for i in f})
        remap = {o: i for i, o in enumerate(used)}
        me.from_pydata([part.v[i] for i in used], [], [tuple(remap[i] for i in f) for f in part.f])
        w = [part.w[i] for i in used]
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        me.materials.append(mat)
        for p in me.polygons:
            p.use_smooth = True
        skin_object(self.arm, o, w)
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        print("GARMENT", name, "verts", len(me.vertices), "tris", tris)
        return o


# ---------------------------------------------------------------- garments
def kaftan_like(F, part, hem_z, n=24, m_top=0.035, m_hem=0.06, sleeve_m=(0.025, 0.035), sleeve_n=10, step=0.045):
    zt = F.z_neck + 0.03
    zs = top_levels(F, zt, hem_z, step)
    nk = F.neck_ell(zt, 0.028)
    hipr = None

    def margin(z, a):
        m = lerp(m_top, m_hem, smoothstep(F.z_neck, hem_z, z))
        return lerp(0.016, m, smoothstep(F.z_shoulder + 0.02, F.z_shoulder - 0.15, z))  # snug over the shoulders

    def minell(z):
        if z < F.z_hip:  # straight below the hip: at least as wide as the hips
            return hipe
        return None
    hips = F.B.pts(TORSO | UPPERLEGS, F.z_hip - 0.03, F.z_hip + 0.03)
    hipe = (max(abs(p.x) for p in hips) + m_top, (max(p.y for p in hips) - min(p.y for p in hips)) / 2 + m_top)
    rings = F.body_loft(zs, TORSO | UPPERLEGS | LEGS, n, margin, minell, exact=lambda z: nk if z == zt else None)
    v, f = grid(rings)
    part.add(v, f, [F.body_w(p) for p in v])
    for s in "lr":
        F.sleeve(part, s, 0.06, 1.0, sleeve_n, 12, lambda t: lerp(sleeve_m[0], sleeve_m[1], t) - 0.012 * (1 - smoothstep(0.06, 0.3, t)))


def build_kaftan(F, mat):
    p = Part()
    kaftan_like(F, p, F.z_knee - 0.09)
    return F.finish(p, "kaftan", mat)


def build_agbada(F, mat):
    p = Part()
    # inner tunic (mostly hidden): long, a bit leaner
    kaftan_like(F, p, F.z_knee - 0.14, n=18, m_top=0.022, m_hem=0.045, sleeve_m=(0.018, 0.022), sleeve_n=7, step=0.07)
    # outer robe: boxy, very wide, over the arms (folded "wings" on the shoulders), open sides below the wrists
    hem = (F.z_knee + F.z_ankle) / 2
    zn, zs_ = F.z_neck, F.z_shoulder
    # boxy (superellipse) cross-sections: flat front/back panels, shoulders widened by the folded sleeves
    # (owner, 2026-10-12: the first cut was far too puffy; this drapes just past the arms)
    ell = [(zn - 0.01, 0.19, 0.13), (zn - 0.05, 0.25, 0.14), (zs_ - 0.03, 0.3, 0.155), (zs_ - 0.12, 0.32, 0.16),
           (F.z_wrist, 0.33, 0.16), (hem, 0.35, 0.165)]

    def minell(z):
        if z > ell[0][0] + 0.005:
            return None
        for (za, aa, ba), (zb, ab, bb) in zip(ell, ell[1:]):
            if zb <= z <= za + 1e-6:
                t = (za - z) / (za - zb)
                return lerp(aa, ab, t), lerp(ba, bb, t), 3.0
        return ell[-1][1], ell[-1][2], 3.0
    zt = zn + 0.03
    nk = F.neck_ell(zt, 0.05)
    zs = [zt, zn + 0.01] + [e[0] for e in ell[:4]] + levels(ell[3][0] - 0.06, hem, 0.06)
    n = 28
    mask = TORSO | LEGS | {"upperarm_l", "upperarm_r"}
    rings = F.body_loft(zs, mask, n, lambda z, a: 0.025, minell, exact=lambda z: nk if z == zt else None)
    wz = F.z_wrist + 0.06

    def drop(i, j, c):  # open side slits below the wrists
        return c.z < wz and abs(c.x) > 0.8 * max(abs(q.x) for q in rings[i])
    v, f = grid(rings, drop=drop)
    w = []
    for q in v:
        base = F.body_w(q)
        s = "l" if q.x > 0 else "r"
        ap, _ = F.arm_point(q, s)
        aw = F.B.weights_near(ap, ARM[s] | {f"clavicle_{s}"}, k=10)
        a = 0.7 * smoothstep(0.12, 0.32, abs(q.x)) * smoothstep(F.z_wrist - 0.35, F.z_wrist + 0.05, q.z)
        w.append(mix_w((1 - a, base), (a, aw)) if a > 0 else base)
    p.add(v, f, w)
    return F.finish(p, "agbada", mat)


def build_buba_wrapper(F, mat):
    p = Part()
    zt = F.z_neck + 0.025
    hem = F.z_hip - 0.13
    zs = top_levels(F, zt, hem, 0.045)
    nk = F.neck_ell(zt, 0.035)
    rings = F.body_loft(zs, TORSO | UPPERLEGS, 24,
                        lambda z, a: lerp(0.04, 0.075, smoothstep(F.z_neck, hem, z)), exact=lambda z: nk if z == zt else None)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    for s in "lr":  # wide 3/4 sleeves
        F.sleeve(p, s, 0.06, 0.72, 8, 14, lambda t: 0.028 + 0.075 * smoothstep(0.2, 0.72, t) ** 1.2)
    # wrapper skirt, waist to ankle: flared through the knee, a little narrower at the ankle
    zs = levels(F.z_waist, F.z_ankle + 0.02, 0.055)

    def m(z, a):
        if z > F.z_hip:
            return 0.03
        if z > F.z_knee:
            return lerp(0.04, 0.085, smoothstep(F.z_hip, F.z_knee, z))
        return lerp(0.085, 0.07, smoothstep(F.z_knee, F.z_ankle, z))
    rings = F.body_loft(zs, TORSO | LEGS, 24, m)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    return F.finish(p, "buba_wrapper", mat)


def build_peplum(F, mat):
    p = Part()
    zt = F.z_neck + 0.01
    zs = top_levels(F, zt, F.z_waist - 0.02, 0.04)
    nk = F.neck_ell(zt, 0.055)
    rings = F.body_loft(zs, TORSO, 24, lambda z, a: 0.016, exact=lambda z: nk if z == zt else None)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    for s in "lr":  # short cap sleeves
        F.sleeve(p, s, 0.06, 0.3, 4, 12, lambda t: 0.016 + 0.02 * t)
    # peplum: flared frill from the waist
    zs = levels(F.z_waist + 0.01, F.z_waist - 0.15, 0.045)
    rings = F.body_loft(zs, TORSO | UPPERLEGS, 28, lambda z, a: lerp(0.02, 0.075, smoothstep(F.z_waist + 0.01, F.z_waist - 0.15, z) ** 1.3))
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    # long mermaid skirt: fitted to the knee, then flaring to the ankle
    zs = levels(F.z_waist, F.z_ankle + 0.01, 0.05)
    flare_from = F.z_knee + 0.02

    def m(z, a):
        if z > flare_from:
            return lerp(0.02, 0.05, smoothstep(F.z_waist, flare_from, z))
        return lerp(0.05, 0.1, smoothstep(flare_from, F.z_ankle, z) ** 1.3)
    rings = F.body_loft(zs, TORSO | LEGS, 24, m)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    return F.finish(p, "peplum_gown", mat)


GARMENTS = [
    ("man", "Male", "agbada", (0.93, 0.9, 0.84), build_agbada),
    ("man", "Male", "kaftan", (0.12, 0.16, 0.37), build_kaftan),
    ("woman", "Female", "buba_wrapper", (0.06, 0.48, 0.42), build_buba_wrapper),
    ("woman", "Female", "peplum_gown", (0.89, 0.34, 0.18), build_peplum),
]


def preview(arm, path_prefix):
    scene = bpy.context.scene
    workbench(scene, 400, 640, outline=True)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.15
    tgt = Vector((0, 0, 0.95))
    cam.location = tgt + Vector((2.6, -4.5, 1.2))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    if os.environ.get("DEBUG_CLOSE"):
        cam.data.ortho_scale = 0.9
        cam.location = Vector((0, 0, 1.35)) + Vector((2.6, -4.5, 1.2))
        build_pose(arm)
        scene.render.filepath = f"{path_prefix}-build.png"
        bpy.ops.render.render(write_still=True)
    for tag, act, fr in (("idle", "Idle_Loop", 1), ("walk", "Walk_Loop", 17), ("walk2", "Walk_Loop", 9)):
        set_action(arm, act, fr)
        scene.render.filepath = f"{path_prefix}-{tag}.png"
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    srcs = {"Male": args[0], "Female": args[1]}
    out, only = args[2], set(args[3:])
    os.makedirs(out, exist_ok=True)
    for who, sex, key, rgb, fn in GARMENTS:
        if only and key not in only:
            continue
        build_one(srcs[sex], who, key, rgb, fn, out)


def build_one(src, who, key, rgb, fn, OUT):
    if True:
        arm, body, others = load_body(src)
        paint_body(body, SKIN)
        F = Fit(arm, body)
        g = fn(F, make_mat(key, rgb))
        preview(arm, os.path.join(OUT, f"preview-garment-{who}-{key}"))
        # export: armature (rest) + garment only
        arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
        # the glTF importer gives bones an Icosphere display shape: drop it so it is not exported
        for pb in arm.pose.bones:
            pb.custom_shape = None
        for o in list(bpy.data.objects):
            if o.type == "MESH" and o.name.startswith("Icosphere"):
                bpy.data.objects.remove(o)
        bpy.context.view_layer.update()
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        g.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"garment-{who}-{key}.glb"), export_format="GLB", use_selection=True,
                                  export_animations=False, export_skins=True, export_morph=False, export_materials="EXPORT")
        print("EXPORTED", who, key)


if __name__ == "__main__":
    main()
