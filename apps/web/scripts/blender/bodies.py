# Puts the Universal Animation Library (Unreal rig) animations on the Universal Base Characters bodies
# (CC0, Quaternius) and exports one game-ready .glb per body.
#   blender -b -P bodies.py -- <body.gltf> <al_ue.fbx> <out.glb> <preview.png>
import bpy, sys, math

body_path, al_path, out_path, preview = sys.argv[-4:]
KEEP = ["Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Dance_Loop", "Idle_Talking_Loop", "Sitting_Idle_Loop",
        "Fixing_Kneeling", "PickUp_Table", "Interact", "Driving_Loop", "Walk_Formal_Loop"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=body_path)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name.startswith("Icosphere"):
        bpy.data.objects.remove(o)
body_arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body_objs = set(bpy.data.objects)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

bpy.ops.import_scene.fbx(filepath=al_path)
al_objs = [o for o in bpy.data.objects if o not in body_objs]

ad = body_arm.animation_data_create()
kept = []
for name in KEEP:
    act = next((a for a in bpy.data.actions if a.name.endswith("|" + name)), None)
    if not act:
        print("MISSING", name)
        continue
    act.name = name
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(act.frame_range[0]), act)
    if hasattr(strip, "action_slot") and len(act.slots):
        strip.action_slot = act.slots[0]
    track.mute = True
    kept.append(act)
for o in al_objs:
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a not in kept:
        bpy.data.actions.remove(a)

# Plain materials: the game paints skin and outfits itself; keep the eye texture, make brows dark.
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for slot in o.material_slots:
        m = slot.material
        if not m or "Eye" in m.name:
            continue
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        for link in list(bsdf.inputs["Base Color"].links) + list(bsdf.inputs["Normal"].links) + list(bsdf.inputs["Roughness"].links):
            nt.links.remove(link)
        is_hair = "Hair" in m.name
        bsdf.inputs["Base Color"].default_value = (0.02, 0.014, 0.01, 1) if is_hair else (0.45, 0.28, 0.18, 1)
        bsdf.inputs["Roughness"].default_value = 0.7
for img in list(bpy.data.images):
    if "Eye_Brown" not in img.name:
        bpy.data.images.remove(img)

# Preview: one walking frame, so we can see the animation drives this body.
walk = next(t for t in ad.nla_tracks if t.name == "Walk_Loop")
walk.mute = False
scene = bpy.context.scene
scene.frame_set(12)
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.render.resolution_x, scene.render.resolution_y = 360, 560
scene.render.film_transparent = True
zs = [(o.matrix_world @ v.co).z for o in bpy.data.objects if o.type == "MESH" for v in o.data.vertices]
h = max(zs) - min(zs)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
cam.location = (h * 0.45, -h * 1.35, h * 0.55)
cam.rotation_euler = (math.radians(86), 0, math.radians(18))
cam.data.lens = 50
scene.camera = cam
scene.render.filepath = preview
bpy.ops.render.render(write_still=True)
walk.mute = True
bpy.data.objects.remove(cam)

bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_skins=True, export_morph=False, export_image_format="WEBP")
print("BODY", out_path, "height", round(h, 3), "actions", [a.name for a in kept])
