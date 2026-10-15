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
    """Vertices, faces, per-vertex bone weights and a material slot per face (0 unless a builder says otherwise)."""

    def __init__(self):
        self.v, self.f, self.w, self.m = [], [], [], []

    def add(self, verts, faces, weights, mat=0):
        o = len(self.v)
        self.v += verts
        self.w += weights
        self.f += [tuple(i + o for i in f) for f in faces]
        self.m += [mat(f, verts) if callable(mat) else mat for f in faces]


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

    def sleeve(self, part, s, t0, t1, nrings, n, margin, flat=1.0, mat=0):
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
        part.add(v, f, weights, mat)

    def finish(self, part, name, mat):
        """mat: one material, or a list indexed by the part's per-face material slots."""
        me = bpy.data.meshes.new(name)
        # drop unused verts
        used = sorted({i for f in part.f for i in f})
        remap = {o: i for i, o in enumerate(used)}
        me.from_pydata([part.v[i] for i in used], [], [tuple(remap[i] for i in f) for f in part.f])
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        w = [part.w[i] for i in used]
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        for m in mats:
            me.materials.append(m)
        for p, k in zip(me.polygons, part.m):
            p.use_smooth = True
            p.material_index = min(k, len(mats) - 1)
        skin_object(self.arm, o, w)
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        print("GARMENT", name, "verts", len(me.vertices), "tris", tris)
        return o


# ---------------------------------------------------------------- garments
def kaftan_like(F, part, hem_z, n=24, m_top=0.035, m_hem=0.06, sleeve_m=(0.025, 0.035), sleeve_n=10, step=0.045,
                sleeve_end=1.0, drop=None, mat=0, sleeves="lr"):
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
    v, f = grid(rings, drop=drop)
    part.add(v, f, [F.body_w(p) for p in v], mat)
    for s in sleeves:
        F.sleeve(part, s, 0.06, sleeve_end, sleeve_n, 12, lambda t: lerp(sleeve_m[0], sleeve_m[1], t / max(sleeve_end, 0.1)) - 0.012 * (1 - smoothstep(0.06, 0.3, t)))


def build_kaftan(F, mat):
    p = Part()
    kaftan_like(F, p, F.z_knee - 0.09)
    return F.finish(p, "kaftan", mat)


def folds(a, z, z_from, k=14, amp=0.007):
    """Soft vertical folds in hanging cloth: a ripple round the section, growing from z_from down."""
    return amp * smoothstep(z_from, z_from - 0.25, z) * math.sin(k * a)


def build_agbada(F, mat):
    p = Part()
    # inner tunic (mostly hidden): long, a bit leaner
    kaftan_like(F, p, F.z_knee - 0.14, n=18, m_top=0.022, m_hem=0.045, sleeve_m=(0.018, 0.022), sleeve_n=7, step=0.07)
    # outer robe: boxy, very wide, over the arms (folded "wings" on the shoulders), open sides below the wrists
    hem = (F.z_knee + F.z_ankle) / 2
    zn, zs_ = F.z_neck, F.z_shoulder
    # boxy (superellipse) cross-sections: flat front/back panels, shoulders widened by the folded sleeves
    # (owner, 2026-10-12: the first cut was far too puffy; this drapes just past the arms)
    # (2026-10-14: draped closer still: thinner front to back, the width falling in folds instead of a box)
    ell = [(zn - 0.01, 0.18, 0.12), (zn - 0.05, 0.23, 0.125), (zs_ - 0.03, 0.28, 0.13), (zs_ - 0.12, 0.295, 0.13),
           (F.z_wrist, 0.3, 0.13), (hem, 0.31, 0.135)]

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
    n = 56
    rings = F.body_loft(zs, mask, n, lambda z, a: 0.018, minell, exact=lambda z: nk if z == zt else None)
    # folds falling from the shoulders
    for ring, z in zip(rings, zs):
        for j, q in enumerate(ring):
            a = 2 * math.pi * j / n
            r = math.hypot(q.x, q.y)
            if r > 1e-4:
                k = 1 + folds(a, z, zs_ - 0.05, 18, 0.01) / r
                ring[j] = Vector((q.x * k, q.y * k, q.z))
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
    zsh = F.z_shoulder

    def embroidery(f_, verts):
        # a broad embroidered panel round the neck and down the chest (the agbada's pride)
        c = sum((verts[k] for k in f_), Vector()) / len(f_)
        if c.y < 0 and zsh - 0.32 < c.z < zt and abs(c.x) < 0.05 + 0.07 * smoothstep(zsh - 0.32, zsh, c.z):
            return 2
        return 0
    p.add(v, f, w, embroidery if isinstance(mat, (list, tuple)) else 0)
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


# ---------------------------------------------------------------- outfits added with the layered sprites (2026-10)
# Material slots: 0 = the outfit fabric (tinted to the player's colour), 1 = the same fabric a shade deeper,
# 2 = a fixed trim colour (embroidery, kente accents), 3 = a second fixed colour.
def front_open(F, zt, z_close, w_top=0.09, w_bottom=0.02):
    """drop() for a garment open down the front from the neck to z_close (narrowing V), closed below."""
    def drop(i, j, c):
        if c.y > -0.02 or c.z > zt + 0.005 or c.z < z_close:
            return False
        return abs(c.x) < lerp(w_bottom, w_top, smoothstep(z_close, zt, c.z))
    return drop


def build_jacket(F, mats, hem=None, z_close=None, name="jacket"):
    """A tailored jacket: to the hip (or `hem`), long sleeves, a V opening showing the shirt, closed below it."""
    p = Part()
    hem = F.z_hip - 0.1 if hem is None else hem
    zt = F.z_neck + 0.03
    zc = F.z_waist + 0.04 if z_close is None else z_close
    kaftan_like(F, p, hem, n=32, m_top=0.014, m_hem=0.026, sleeve_m=(0.013, 0.016), sleeve_n=10, step=0.03, drop=front_open(F, zt, zc, 0.085, 0.02))
    # lapels: a band of the deeper cloth along each edge of the V; the hem and cuffs too
    op = front_open(F, zt, zc, 0.085, 0.02)

    def lapel(f_, verts):
        c = sum((verts[k] for k in f_), Vector()) / len(f_)
        if c.y < 0 and zc < c.z < zt:
            near = op(0, 0, Vector((c.x * 0.72, c.y, c.z))) and not op(0, 0, c)
            if near:
                return 1
        if c.z < hem + 0.03:
            return 1
        return 0
    p.m = [lapel(f_, p.v) if k == 0 else k for f_, k in zip(p.f, p.m)]
    # the tie down the shirt front in the V, a knot at the collar
    if name == "jacket":
        pts = [q for q in F.B.pts(TORSO, zc - 0.02, F.z_neck) if abs(q.x) < 0.03]
        for k in range(8):
            z0 = F.z_neck - 0.02 - (F.z_neck - 0.02 - zc) * k / 8
            z1 = F.z_neck - 0.02 - (F.z_neck - 0.02 - zc) * (k + 1) / 8
            near = [q for q in pts if z1 - 0.02 < q.z < z0 + 0.02]
            if not near:
                continue
            y = min(q.y for q in near) - 0.006
            w0 = 0.014 + 0.012 * k / 8
            w1 = 0.014 + 0.012 * (k + 1) / 8
            quad = [Vector((-w0, y, z0)), Vector((w0, y, z0)), Vector((w1, y, z1)), Vector((-w1, y, z1))]
            p.add(quad, [(0, 3, 2, 1)], [F.body_w(Vector((0, y, (z0 + z1) / 2)))] * 4, 2)
    # buttons down the closed front
    if name == "jacket":
        front = [q for q in p.v if abs(q.x) < 0.02 and q.y < 0 and zc - 0.25 < q.z < zc]
        if front:
            for zb in (zc - 0.03, zc - 0.13):
                near_v = min(front, key=lambda q: abs(q.z - zb))
                add_ball(p, Vector((0.0, near_v.y - 0.006, zb)), 0.011, F.body_w(near_v), 3)
    return F.finish(p, name, mats)


def add_ball(part, c, r, w, mat):
    """A small sphere (a button) carried by the weights `w`."""
    nu, nv = 8, 5
    verts, faces = [], []
    for i in range(nv + 1):
        th = math.pi * i / nv
        for j in range(nu):
            ph = 2 * math.pi * j / nu
            verts.append(c + Vector((r * math.sin(th) * math.cos(ph), -r * 0.5 * math.sin(th) * math.sin(ph) - r * 0.2, r * math.cos(th))))
    for i in range(nv):
        for j in range(nu):
            j2 = (j + 1) % nu
            faces.append((i * nu + j, (i + 1) * nu + j, (i + 1) * nu + j2, i * nu + j2))
    part.add(verts, faces, [w] * len(verts), mat)


def build_denim_jacket(F, mats):
    """A short jacket to the waist, open all the way down the front."""
    return build_jacket(F, mats, hem=F.z_waist - 0.03, z_close=F.z_waist - 0.2, name="denim_jacket")


def build_summer_dress(F, mats):
    """A light dress: a flared skirt from the waist to the knee (the sleeveless bodice is painted on the body)."""
    p = Part()
    zs = levels(F.z_waist + 0.02, F.z_knee - 0.04, 0.045)

    def m(z, a):
        return lerp(0.02, 0.11, smoothstep(F.z_waist, F.z_knee - 0.04, z) ** 1.2)
    rings = F.body_loft(zs, TORSO | LEGS, 26, m)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    return F.finish(p, "summer_dress", mats)


def build_abaya(F, mats):
    """A loose full-length robe with long, wide sleeves."""
    p = Part()
    kaftan_like(F, p, F.z_ankle + 0.03, n=32, m_top=0.02, m_hem=0.055, sleeve_m=(0.018, 0.04), sleeve_n=11)
    return F.finish(p, "abaya", mats)


def kente_mat(f, verts):
    """Kente weave: blocks of the main colour with bands of the two fixed accent colours (gold-green and black)."""
    c = sum((verts[k] for k in f), Vector()) / len(f)
    band = int(math.floor((c.z + 3.0) / 0.055))
    col = int(math.floor((math.atan2(c.y, c.x) + math.pi) / (2 * math.pi) * 12))
    if band % 4 == 1:
        return 3 if col % 2 else 2
    if (band // 4 + col) % 3 == 0:
        return 2
    return 0


def build_kente(F, mats):
    """Kente cloth: for the man a full robe to mid-calf with short sleeves; woven blocks and bands."""
    p = Part()
    kaftan_like(F, p, (F.z_knee + F.z_ankle) / 2, n=32, m_top=0.02, m_hem=0.055, sleeve_m=(0.018, 0.035), sleeve_n=6, sleeve_end=0.42, mat=kente_mat)
    return F.finish(p, "kente", mats)


def build_kente_woman(F, mats):
    """Kente for the woman: a blouse with wide short sleeves and a long wrapper, both in the weave."""
    p = Part()
    zt = F.z_neck + 0.025
    hem = F.z_hip - 0.1
    zs = top_levels(F, zt, hem, 0.045)
    nk = F.neck_ell(zt, 0.035)
    rings = F.body_loft(zs, TORSO | UPPERLEGS, 24, lambda z, a: lerp(0.035, 0.06, smoothstep(F.z_neck, hem, z)), exact=lambda z: nk if z == zt else None)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v], kente_mat)
    for s_ in "lr":
        F.sleeve(p, s_, 0.06, 0.45, 6, 14, lambda t: 0.026 + 0.05 * smoothstep(0.15, 0.45, t), mat=kente_mat)
    zs = levels(F.z_waist, F.z_ankle + 0.02, 0.055)

    def m(z, a):
        if z > F.z_hip:
            return 0.03
        if z > F.z_knee:
            return lerp(0.04, 0.075, smoothstep(F.z_hip, F.z_knee, z))
        return lerp(0.075, 0.06, smoothstep(F.z_knee, F.z_ankle, z))
    rings = F.body_loft(zs, TORSO | LEGS, 24, m)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v], kente_mat)
    return F.finish(p, "kente", mats)


def build_boubou(F, mats):
    """The grand boubou: the agbada's wide flowing robe, with gold embroidery round the neck and down the chest."""
    o = build_agbada(F, mats)
    me = o.data
    zs = F.z_shoulder
    for poly in me.polygons:
        if poly.material_index:
            continue
        # vertices are back in rest-pose coordinates here (finish un-skins them): the rest pose is upright
        c = sum((me.vertices[k].co for k in poly.vertices), Vector()) / len(poly.vertices)
        if c.y < 0 and zs - 0.3 < c.z < F.z_neck + 0.05 and abs(c.x) < 0.07 + 0.05 * smoothstep(zs - 0.3, zs, c.z):
            poly.material_index = 2
    o.name = "boubou"
    return o


def build_kurta(F, mats):
    """A kurta: a straight tunic to just above the knee with long sleeves and a placket at the neck."""
    p = Part()
    def slit(i, j, c):  # side slits from the hip down
        return c.z < F.z_hip - 0.04 and abs(c.y) < 0.03 and abs(c.x) > 0.1
    kaftan_like(F, p, F.z_knee + 0.05, n=32, m_top=0.016, m_hem=0.032, sleeve_m=(0.013, 0.017), sleeve_n=10, step=0.035, drop=slit)

    # the placket: a short strip down the front from the neck in the fixed colour
    zt = F.z_neck + 0.03

    def mat(f, verts):
        c = sum((verts[k] for k in f), Vector()) / len(f)
        return 2 if (c.y < 0 and abs(c.x) < 0.018 and F.z_shoulder - 0.17 < c.z < zt) else 0
    p.m = [mat(f, p.v) if k == 0 else k for f, k in zip(p.f, p.m)]
    front = [q for q in p.v if abs(q.x) < 0.02 and q.y < 0 and F.z_shoulder - 0.17 < q.z < zt]
    for zb in (F.z_shoulder - 0.03, F.z_shoulder - 0.08, F.z_shoulder - 0.13):
        if front:
            near_v = min(front, key=lambda q: abs(q.z - zb))
            add_ball(p, Vector((0.0, near_v.y - 0.004, zb)), 0.008, F.body_w(near_v), 3)
    return F.finish(p, "kurta", mats)


def band_drape(F, part, z_lo, z_hi, centre, width, margin=0.05, mat=0, n=40, step=0.022):
    """A cloth band round the upper body: keeps the faces of a loose tube (z_lo..z_hi) that lie within `width` of
    centre(x, y) (a height for each point of the tube). Draped scarves, a dupatta, the pallu of a saree."""
    zs = levels(z_hi, z_lo, step)
    rings = F.body_loft(zs, TORSO | UPPERLEGS, n, lambda z, a: margin)

    def drop(i, j, c):
        return abs(c.z - centre(c.x, c.y)) > width / 2
    v, f = grid(rings, drop=drop)
    part.add(v, f, [F.body_w(q) for q in v], mat)


def build_kameez(F, mats):
    """Kameez (a tunic to the knee, sleeves to below the elbow, side slits) and the dupatta over the shoulders."""
    p = Part()
    hem = F.z_knee - 0.02

    def slit(i, j, c):
        return c.z < F.z_hip - 0.06 and abs(c.y - 0.0) < 0.035 and abs(c.x) > 0.1
    kaftan_like(F, p, hem, n=32, m_top=0.017, m_hem=0.05, sleeve_m=(0.014, 0.02), sleeve_n=8, sleeve_end=0.78, drop=slit)
    zsh = F.z_shoulder

    def centre(x, y):
        # low in a U over the chest at the front, high across the back of the shoulders
        return zsh - 0.25 + 3.2 * x * x if y < 0 else zsh - 0.04
    band_drape(F, p, zsh - 0.32, zsh + 0.05, centre, 0.075, margin=0.045, mat=3)
    return F.finish(p, "kameez", mats)


def build_saree(F, mats):
    """A saree: the pleated skirt wrapped from the waist to the floor, and the pallu from the right hip up across
    the chest and over the left shoulder, hanging down the back (the short blouse is painted on the body)."""
    p = Part()
    zs = levels(F.z_waist - 0.02, F.z_ankle - 0.01, 0.05)

    def m(z, a):
        base = 0.025 if z > F.z_hip else lerp(0.035, 0.065, smoothstep(F.z_hip, F.z_ankle, z))
        # the pleats: a fan of folds down the front (the side that faces -y)
        front = smoothstep(0.2, 0.9, -math.sin(a)) * smoothstep(F.z_hip + 0.05, F.z_hip - 0.15, z)
        return base + front * (0.012 + 0.012 * math.cos(22 * a))
    rings = F.body_loft(zs, TORSO | LEGS, 64, m)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    zsh, zw = F.z_shoulder, F.z_waist - 0.04
    xs = 0.17

    def centre(x, y):
        if y < 0:  # front: a diagonal from the left shoulder (x > 0) down to the right hip
            return lerp(zw, zsh + 0.02, (x + xs) / (2 * xs))
        # back: falls from the left shoulder straight down, across the back
        return lerp(zsh - 0.32, zsh + 0.02, smoothstep(-0.05, xs, x))
    band_drape(F, p, F.z_hip - 0.08, zsh + 0.06, centre, 0.13, margin=0.03, mat=1, n=72, step=0.01)
    return F.finish(p, "saree", mats)


# ---------------------------------------------------------------- modern fashion (2026-10): stylish, not revealing
def skirt(F, part, top, hem, flare, n=40, pleats=0.0, mat=0):
    zs = levels(top, hem, 0.04)

    def m(z, a):
        t = smoothstep(top, hem, z)
        return lerp(0.014, flare, t) + pleats * t * math.cos(16 * a)
    rings = F.body_loft(zs, TORSO | LEGS, n, m)
    v, f = grid(rings)
    part.add(v, f, [F.body_w(q) for q in v], mat)


def build_mini_skirt(F, mats):
    """A mini skirt from the waist to mid-thigh, a gentle A-line."""
    p = Part()
    skirt(F, p, F.z_waist + 0.02, (F.z_hip + F.z_knee) / 2 - 0.02, 0.05)
    return F.finish(p, "mini_skirt", mats)


def build_bodycon(F, mats):
    """A fitted midi dress from the bust to mid-calf, close to the body all the way down."""
    p = Part()
    zt = F.z_shoulder - 0.08
    hem = (F.z_knee + F.z_ankle) / 2 + 0.04
    zs = levels(zt, hem, 0.035)
    rings = F.body_loft(zs, TORSO | UPPERLEGS | LEGS, 40, lambda z, a: 0.01 + 0.02 * smoothstep(F.z_hip, hem, z), shoulders=False)
    v, f = grid(rings)
    p.add(v, f, [F.body_w(q) for q in v])
    return F.finish(p, "bodycon", mats)


def build_flare_skirt(F, mats):
    """The ankara two-piece's skirt: fitted at the waist, flaring to mid-calf in soft folds."""
    p = Part()
    skirt(F, p, F.z_waist + 0.02, (F.z_knee + F.z_ankle) / 2, 0.11, pleats=0.008)
    return F.finish(p, "flare_skirt", mats)


def build_big_tee(F, mats):
    """An oversized tee: dropped shoulders, wide short sleeves, a straight hem at the hip."""
    p = Part()
    kaftan_like(F, p, F.z_hip - 0.06, n=32, m_top=0.03, m_hem=0.05, sleeve_m=(0.03, 0.045), sleeve_n=6, sleeve_end=0.48)
    return F.finish(p, "big_tee", mats)


def build_varsity(F, mats):
    """A varsity jacket: body in the fabric, sleeves in cream leather (fixed), ribbed cuffs and hem (deeper), open front."""
    p = Part()
    zt = F.z_neck + 0.03
    hem = F.z_waist - 0.04
    kaftan_like(F, p, hem, n=32, m_top=0.02, m_hem=0.03, sleeve_m=(0.022, 0.024), sleeve_n=10, step=0.035,
                drop=front_open(F, zt, hem - 0.2, 0.05, 0.03))
    zsh = F.z_shoulder

    def role(f_, verts):
        c = sum((verts[k] for k in f_), Vector()) / len(f_)
        if c.z < hem + 0.035:
            return 1  # ribbed hem
        if abs(c.x) > 0.21 and c.z > F.z_wrist - 0.05:
            return 2  # leather sleeves
        return 0
    p.m = [role(f_, p.v) for f_ in p.f]
    return F.finish(p, "varsity", mats)


GARMENTS = [
    ("man", "Male", "agbada", (0.93, 0.9, 0.84), build_agbada),
    ("man", "Male", "kaftan", (0.12, 0.16, 0.37), build_kaftan),
    ("woman", "Female", "buba_wrapper", (0.06, 0.48, 0.42), build_buba_wrapper),
    ("woman", "Female", "peplum_gown", (0.89, 0.34, 0.18), build_peplum),
    ("man", "Male", "suit_jacket", (0.12, 0.16, 0.42), build_jacket),
    ("woman", "Female", "suit_jacket", (0.12, 0.16, 0.42), build_jacket),
    ("man", "Male", "denim_jacket", (0.29, 0.35, 0.16), build_denim_jacket),
    ("woman", "Female", "denim_jacket", (0.29, 0.35, 0.16), build_denim_jacket),
    ("woman", "Female", "summer_dress", (0.91, 0.52, 0.71), build_summer_dress),
    ("woman", "Female", "abaya", (0.15, 0.16, 0.17), build_abaya),
    ("man", "Male", "kente", (0.95, 0.72, 0.02), build_kente),
    ("woman", "Female", "kente", (0.95, 0.72, 0.02), build_kente_woman),
    ("man", "Male", "boubou", (0.18, 0.37, 0.7), build_boubou),
    ("woman", "Female", "boubou", (0.18, 0.37, 0.7), build_boubou),
    ("man", "Male", "kurta", (0.96, 0.96, 0.95), build_kurta),
    ("woman", "Female", "kameez", (0.06, 0.48, 0.42), build_kameez),
    ("woman", "Female", "saree", (0.78, 0.2, 0.12), build_saree),
    ("woman", "Female", "mini_skirt", (0.15, 0.15, 0.17), build_mini_skirt),
    ("woman", "Female", "bodycon", (0.48, 0.12, 0.24), build_bodycon),
    ("woman", "Female", "flare_skirt", (0.91, 0.54, 0.1), build_flare_skirt),
    ("man", "Male", "big_tee", (0.15, 0.15, 0.17), build_big_tee),
    ("man", "Male", "varsity", (0.48, 0.12, 0.24), build_varsity),
]
# Fixed colours for material slots 2 and 3 of each garment (trim, accents); slot 1 is slot 0 a shade deeper.
GARMENT_FIXED = {
    "varsity": ((0.93, 0.9, 0.82), (0.93, 0.9, 0.82)),
    "agbada": ((0.85, 0.62, 0.12), (0.85, 0.62, 0.12)),
    "suit_jacket": ((0.48, 0.09, 0.17), (0.06, 0.06, 0.07)),
    "kente": ((0.12, 0.42, 0.18), (0.05, 0.04, 0.03)),
    "boubou": ((0.85, 0.62, 0.12), (0.85, 0.62, 0.12)),
    "kurta": ((0.85, 0.62, 0.12), (0.85, 0.62, 0.12)),
    "kameez": ((0.93, 0.9, 0.84), (0.93, 0.9, 0.84)),
}


def garment_mats(key, rgb):
    """The four material slots: fabric, fabric a shade deeper, and the two fixed colours (names carry the role, so
    the layered sprites know what to tint: T_fab, T_deep, FIX_*)."""
    fx = GARMENT_FIXED.get(key, ((0.85, 0.62, 0.12), (0.05, 0.04, 0.03)))
    return [make_mat(f"T_fab_{key}", rgb), make_mat(f"T_deep_{key}", tuple(c * 0.86 for c in rgb)),
            make_mat(f"FIX_a_{key}", fx[0]), make_mat(f"FIX_b_{key}", fx[1])]


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


NEW_KEYS = {"mini_skirt", "bodycon", "flare_skirt", "big_tee", "varsity", "agbada", "suit_jacket", "denim_jacket", "summer_dress", "abaya", "kente", "boubou", "kurta", "kameez", "saree"}


def build_one(src, who, key, rgb, fn, OUT):
    if True:
        arm, body, others = load_body(src)
        paint_body(body, SKIN)
        F = Fit(arm, body)
        g = fn(F, garment_mats(key, rgb) if key in NEW_KEYS else make_mat(key, rgb))
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
