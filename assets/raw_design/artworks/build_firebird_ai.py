"""Build a grid-scaled low-poly firebird with a fireball-to-tile ignition skill."""
from pathlib import Path
import json
import math
import sys
import tempfile
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "assets/raw_design/artworks"
REFERENCE = ART / "firebird_reference.png"
BLEND = ART / "firebird_ai.blend"
PREVIEW = Path(tempfile.gettempdir()) / "firebird_ai_preview.png"
CELL = 1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = CELL
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1200
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.frame_start = 1
scene.frame_end = 48

bird_collection = bpy.data.collections.new("FIREBIRD_MODEL | 3x3 grid")
grid_collection = bpy.data.collections.new("GRID_REFERENCE | 3x3 cells")
skill_collection = bpy.data.collections.new("FX_FIREBALL_IGNITE | single-cell skill")
studio_collection = bpy.data.collections.new("STUDIO | presentation")
for collection in (bird_collection, grid_collection, skill_collection, studio_collection):
    scene.collection.children.link(collection)


def material(name, color, roughness=0.78, emission=None, strength=0.0, alpha=1.0):
    srgb = [int(color[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    rgb = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in srgb]
    result = bpy.data.materials.new(name + "_ai")
    result.diffuse_color = (*rgb, alpha)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, alpha)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Alpha"].default_value = alpha
    if emission:
        srgb_glow = [int(emission[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
        glow = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in srgb_glow]
        socket = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        if socket:
            socket.default_value = (*glow, 1)
        power = shader.inputs.get("Emission Strength")
        if power:
            power.default_value = strength
    if alpha < 1:
        try:
            result.surface_render_method = "DITHERED"
        except Exception:
            try:
                result.blend_method = "BLEND"
            except Exception:
                pass
    result["color_srgb"] = color
    result["role"] = "skill_fx" if emission else "bird_model"
    return result


plum = material("phoenix_crimson", "#9e163b")
plum_light = material("phoenix_feather_light", "#cf2854")
plum_dark = material("phoenix_feather_shadow", "#68132f")
red = material("wing_ruby", "#a9163c")
red_light = material("wing_hot_ruby", "#d72b50")
orange = material("flame_orange", "#f36b1b", emission="#ff4a08", strength=0.35)
gold = material("flame_gold", "#ffb51b", emission="#ff8a08", strength=0.5)
yellow = material("flame_core", "#ffe88a", emission="#ffd547", strength=1.0)
beak_mat = material("beak_amber", "#e49322")
black = material("eye_obsidian", "#211923", roughness=0.26)
ember = material("floating_embers", "#ff7424", roughness=0.5, emission="#ff4b0b", strength=2.0)
fx_outer = material("fireball_outer", "#ec4b12", roughness=0.4, emission="#ff3c08", strength=2.5, alpha=0.72)
fx_mid = material("fireball_mid", "#ff8b17", roughness=0.36, emission="#ff7708", strength=3.1, alpha=0.88)
fx_core = material("fireball_core", "#fff1a1", roughness=0.3, emission="#ffe067", strength=4.0)
fx_trail = material("fireball_trail", "#ff6a13", emission="#ff3506", strength=2.2, alpha=0.35)
fx_impact = material("ignition_ring", "#ffd34f", emission="#ff8a0c", strength=2.8, alpha=0.8)
tile_mat = material("target_paper", "#efe9dc", roughness=0.94)
tile_side = material("target_tile_edge", "#aaa79b", roughness=0.92)
tile_burnt = material("scorched_cell", "#44323a", roughness=0.88)


def link_obj(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mesh_obj(name, vertices, faces, materials, indices=None, collection=bird_collection):
    data = bpy.data.meshes.new(name + "_mesh_ai")
    data.from_pydata(vertices, [], faces)
    data.update()
    for surface in materials:
        data.materials.append(surface)
    if indices:
        for face, index in zip(data.polygons, indices):
            face.material_index = index
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    for face in data.polygons:
        face.use_smooth = False
    obj = bpy.data.objects.new(name + "_ai", data)
    collection.objects.link(obj)
    return obj


def ico(name, location, scale, surface, collection=bird_collection, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location)
    obj = link_obj(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    for face in obj.data.polygons:
        face.use_smooth = False
    return obj


def cone_between(name, start, end, radius_start, radius_end, surface, collection=bird_collection, vertices=6):
    start, end = Vector(start), Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius_start, radius2=radius_end, depth=direction.length, location=(start + end) * 0.5)
    obj = link_obj(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.data.materials.append(surface)
    for face in obj.data.polygons:
        face.use_smooth = False
    return obj


def tube(name, points, radii, materials, collection=bird_collection, sides=7):
    path = [Vector(p) for p in points]
    vertices, faces, indices = [], [], []
    for index, point in enumerate(path):
        tangent = (path[min(index + 1, len(path) - 1)] - path[max(0, index - 1)]).normalized()
        helper = Vector((0, 1, 0)) if abs(tangent.z) > 0.88 else Vector((0, 0, 1))
        side = tangent.cross(helper).normalized()
        up = tangent.cross(side).normalized()
        for segment in range(sides):
            angle = math.tau * segment / sides + math.pi / sides
            vertices.append(point + radii[index] * (side * math.cos(angle) + up * math.sin(angle)))
    for ring in range(len(path) - 1):
        for segment in range(sides):
            a = ring * sides + segment
            b = ring * sides + (segment + 1) % sides
            c = (ring + 1) * sides + (segment + 1) % sides
            d = (ring + 1) * sides + segment
            if (ring + segment) % 2:
                faces.extend([(a, b, d), (b, c, d)])
            else:
                faces.extend([(a, b, c), (a, c, d)])
            indices.extend([(ring + segment) % len(materials), (ring + segment + 1) % len(materials)])
    faces.extend([tuple(reversed(range(sides))), tuple(range((len(path) - 1) * sides, len(path) * sides))])
    indices.extend([len(materials) - 1, 0])
    return mesh_obj(name, vertices, faces, materials, indices, collection)


def feather(name, start, end, width, surface, collection=bird_collection, thickness=0.035, bend=0.0):
    start, end = Vector(start), Vector(end)
    direction = (end - start).normalized()
    perpendicular = Vector((-direction.y, direction.x, 0)).normalized()
    center = (start + end) * 0.5 + Vector((0, 0, bend))
    vertices = [
        start,
        center + perpendicular * width,
        end,
        center - perpendicular * width,
        center + Vector((0, 0, thickness)),
        center - Vector((0, 0, thickness)),
        start + Vector((0, 0, thickness * 0.35)),
        end + Vector((0, 0, thickness * 0.2)),
    ]
    faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5), (6, 4, 1), (1, 5, 6), (4, 7, 2), (2, 5, 7)]
    return mesh_obj(name, vertices, faces, [surface], collection=collection)


def target_tile(name, location, color, collection=grid_collection):
    cx, cy, z = location
    vertices = [(cx - 0.475, cy - 0.475, z), (cx + 0.475, cy - 0.475, z), (cx + 0.475, cy + 0.475, z), (cx - 0.475, cy + 0.475, z), (cx - 0.475, cy - 0.475, z - 0.08), (cx + 0.475, cy - 0.475, z - 0.08), (cx + 0.475, cy + 0.475, z - 0.08), (cx - 0.475, cy + 0.475, z - 0.08)]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return mesh_obj(name, vertices, faces, [color, tile_side], [0, 1, 1, 1, 1, 1], collection)


def torus(name, location, major_radius, minor_radius, surface, collection, normal=(0, 0, 1), major_segments=16, minor_segments=5):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=major_segments, minor_segments=minor_segments, location=location)
    obj = link_obj(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(normal).normalized())
    obj.data.materials.append(surface)
    for face in obj.data.polygons:
        face.use_smooth = False
    return obj


def keyframe_visibility(obj, shown_frames):
    shown = set(shown_frames)
    for frame in range(scene.frame_start, scene.frame_end + 1):
        obj.hide_render = frame not in shown
        obj.hide_viewport = frame not in shown
        obj.keyframe_insert(data_path="hide_render", frame=frame)
        obj.keyframe_insert(data_path="hide_viewport", frame=frame)


# Main body is deliberately centered inside a 3-by-3 world-unit grid.
body = ico("faceted_phoenix_body", (0, -0.05, 1.18), (0.43, 0.35, 0.76), plum, bird_collection, 2)
body.rotation_euler[1] = math.radians(-9)
neck_points = [(0.0, 0.16, 1.35), (-0.02, 0.19, 1.62), (-0.08, 0.2, 1.91), (-0.13, 0.18, 2.19), (-0.17, 0.15, 2.39)]
tube("arched_phoenix_neck", neck_points, [0.29, 0.25, 0.2, 0.16, 0.13], [plum, plum_light, plum_dark], bird_collection, 8)
head = ico("phoenix_head", (-0.18, 0.12, 2.42), (0.25, 0.25, 0.23), plum_light, bird_collection, 1)
head.rotation_euler[1] = math.radians(-12)
cone_between("hooked_beak_upper", (-0.23, -0.08, 2.43), (-0.48, -0.12, 2.34), 0.115, 0.012, beak_mat, bird_collection, 5)
cone_between("hooked_beak_lower", (-0.24, -0.08, 2.39), (-0.42, -0.12, 2.34), 0.075, 0.008, gold, bird_collection, 5)
ico("glowing_eye_left", (-0.265, -0.106, 2.48), (0.033, 0.018, 0.025), yellow, bird_collection, 1)
ico("glowing_eye_right", (-0.08, -0.10, 2.48), (0.027, 0.015, 0.022), yellow, bird_collection, 1)

# Three swept crown plumes echo the crest in the supplied reference.
for index, (start, tip, width) in enumerate([
    ((-0.21, 0.10, 2.52), (-0.31, 0.11, 2.95), 0.105),
    ((-0.13, 0.13, 2.56), (-0.03, 0.16, 3.08), 0.095),
    ((-0.05, 0.17, 2.52), (0.20, 0.18, 2.91), 0.085),
]):
    feather("crown_flame_plume_" + str(index + 1), start, tip, width, red_light if index == 1 else plum_light, bird_collection, 0.045, 0.035)

# Broad, lifted wings with separate layered red feathers and orange flame tips.
for side in (-1, 1):
    label = "left" if side < 0 else "right"
    wing_root = Vector((side * 0.28, 0.045, 1.63))
    wing_tip = Vector((side * 1.48, 0.05, 2.32))
    wing_mid = Vector((side * 0.92, 0.08, 2.05))
    wing_vertices = [wing_root, Vector((side * 0.37, 0.075, 2.08)), wing_tip, Vector((side * 1.04, 0.05, 1.72)), Vector((side * 0.75, 0.04, 1.46))]
    wing = mesh_obj(label + "_swept_wing_fan", wing_vertices, [(0, 1, 4), (1, 2, 3), (1, 3, 4)], [plum, red, red_light], [0, 2, 1], bird_collection)
    feather_count = 9
    for index in range(feather_count):
        t = index / (feather_count - 1)
        root = wing_root.lerp(wing_mid, t)
        outer = Vector((side * (0.84 + 0.56 * t), 0.03, 1.47 + 0.88 * t))
        inner = Vector((side * (0.55 + 0.55 * t), -0.015, 1.14 + 0.24 * t))
        feather("{}_primary_feather_{:02d}".format(label, index + 1), root, outer, 0.105 - 0.018 * t, red_light if index % 3 == 0 else red, bird_collection, 0.045, 0.025)
        feather("{}_secondary_feather_{:02d}".format(label, index + 1), root + Vector((0, -0.012, -0.1)), inner, 0.087, plum_light if index % 2 else plum, bird_collection, 0.04, -0.015)
        flame_start = outer - Vector((side * 0.015, 0.018, 0.035))
        flame_tip = outer + Vector((side * (0.09 + 0.02 * (index % 3)), 0, 0.06 + 0.02 * (index % 2)))
        feather("{}_outer_flame_{:02d}".format(label, index + 1), flame_start, flame_tip, 0.055, orange if index % 2 else gold, bird_collection, 0.025, 0.015)

# Three long, separated streamers form the trailing tail.
for index, points in enumerate([
    [(0.08, 0.12, 0.76), (0.2, 0.12, 0.33), (0.44, 0.12, 0.06), (0.76, 0.10, 0.18), (0.94, 0.08, 0.53)],
    [(0.0, 0.06, 0.71), (-0.12, 0.06, 0.32), (-0.38, 0.06, 0.10), (-0.70, 0.04, 0.24), (-0.92, 0.02, 0.61)],
    [(-0.08, 0.14, 0.68), (-0.02, 0.15, 0.36), (0.12, 0.15, 0.15), (0.33, 0.14, 0.26), (0.48, 0.12, 0.68)],
]):
    tube("phoenix_tail_streamer_" + str(index + 1), points, [0.12, 0.09, 0.065, 0.043, 0.008], [plum, plum_light, plum_dark], bird_collection, 5)
    tail_tip = Vector(points[-1])
    feather("tail_flame_tip_" + str(index + 1), tail_tip - Vector((0.03, 0, 0.02)), tail_tip + Vector((0.18, 0, 0.15)), 0.045, orange if index != 1 else red_light, bird_collection, 0.018, 0.01)

# Small chest feathers reinforce the angular silhouette.
for index in range(7):
    x = -0.29 + index * 0.095
    z = 1.56 - 0.11 * abs(index - 3) / 3
    feather("chest_feather_{:02d}".format(index + 1), (x, -0.29, z + 0.13), (x - 0.035, -0.33, z - 0.12), 0.045, plum_light if index % 2 else plum_dark, bird_collection, 0.025, -0.01)

# Feet tuck under the body with simple faceted talons.
for side in (-1, 1):
    x = side * 0.2
    cone_between("phoenix_leg", (x, -0.06, 0.76), (x, -0.12, 0.52), 0.07, 0.04, plum_dark, bird_collection, 5)
    for toe in (-1, 0, 1):
        cone_between("phoenix_talon", (x, -0.12, 0.55), (x + toe * 0.075, -0.23, 0.47), 0.04, 0.008, beak_mat, bird_collection, 4)

bird_root = bpy.data.objects.new("FIREBIRD_AI | 3x3 cells", None)
bird_collection.objects.link(bird_root)
bird_root["asset_id"] = "firebird_ai"
bird_root["footprint_cells"] = "3x3"
bird_root["cell_size_world_units"] = CELL
bird_root["grid_span"] = 3.0
bird_root["visual_only"] = True
for obj in list(bird_collection.objects):
    if obj != bird_root:
        obj.parent = bird_root
bird_root.scale = (0.96, 0.96, 1.0)
bird_root["fit_scale_xy"] = 0.96

# Nine neutral board cells: the center holds the bird, the forward cell is ignition target.
for row in range(3):
    for column in range(3):
        x, y = column - 1, row - 1
        tile_color = tile_burnt if (row, column) == (0, 2) else tile_mat
        target_tile("grid_cell_{}_{}".format(row, column), (x, y, -0.055), tile_color, grid_collection)
        if (row, column) == (0, 2):
            bpy.ops.mesh.primitive_plane_add(size=0.88, location=(x, y, 0.001))
            cell_mark = link_obj(bpy.context.object, grid_collection)
            cell_mark.name = "single_ignition_target_cell_ai"
            cell_mark.data.materials.append(orange)
for x in (-1.5, -0.5, 0.5, 1.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, 0.008))
    line = link_obj(bpy.context.object, grid_collection)
    line.name = "grid_vertical_line_ai"
    line.dimensions = (0.009, 3.0, 0.012)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    line.data.materials.append(tile_side)
for y in (-1.5, -0.5, 0.5, 1.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, 0.008))
    line = link_obj(bpy.context.object, grid_collection)
    line.name = "grid_horizontal_line_ai"
    line.dimensions = (3.0, 0.009, 0.012)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    line.data.materials.append(tile_side)

# Fireball skill choreography: takeoff -> travel -> impact -> one-cell ignition.
fx_root = bpy.data.objects.new("SKILL_FIREBALL_IGNITE_ONE_CELL", None)
skill_collection.objects.link(fx_root)
fx_root["skill_name_zh"] = "火球点燃单格"
fx_root["skill_name"] = "Fireball: ignite one grid cell"
fx_root["target_footprint"] = "1x1 cell"
fx_root["animation_guide"] = "frames 1-48: charge, launch, impact, tile ignition"
start = Vector((-0.46, -0.02, 2.37))
impact = Vector((0.98, -1.0, 0.18))
direction = (impact - start).normalized()
fireball = ico("animated_fireball", start, (0.13, 0.13, 0.13), fx_outer, skill_collection, 2)
fireball.name = "animated_fireball_outer_ai"
core_ball = ico("animated_fireball_core", start + Vector((0, -0.025, 0)), (0.078, 0.082, 0.082), fx_core, skill_collection, 2)
mid_ball = ico("animated_fireball_mid", start + Vector((0, -0.012, 0)), (0.104, 0.104, 0.104), fx_mid, skill_collection, 1)

for frame, position, scale in [
    (1, start, 0.18), (5, start, 0.78), (9, start, 1.0),
    (26, impact.lerp(start, 0.58), 0.82), (38, impact, 1.08),
    (42, impact, 0.36), (48, impact, 0.01),
]:
    fireball.location = position
    fireball.scale = (0.13 * scale, 0.13 * scale, 0.13 * scale)
    fireball.keyframe_insert(data_path="location", frame=frame)
    fireball.keyframe_insert(data_path="scale", frame=frame)
    for inner, multiplier in ((mid_ball, 0.8), (core_ball, 0.6)):
        inner.location = position + Vector((0, -0.025, 0))
        inner.scale = (0.13 * scale * multiplier, 0.13 * scale * multiplier, 0.13 * scale * multiplier)
        inner.keyframe_insert(data_path="location", frame=frame)
        inner.keyframe_insert(data_path="scale", frame=frame)

trail = cone_between("fireball_motion_trail", start - direction * 0.18, start - direction * 0.58, 0.105, 0.015, fx_trail, skill_collection, 8)
trail.hide_render = True
trail.hide_viewport = True
for frame, visible in ((1, False), (8, True), (33, True), (38, False), (48, False)):
    trail.hide_render = not visible
    trail.hide_viewport = not visible
    trail.keyframe_insert(data_path="hide_render", frame=frame)
    trail.keyframe_insert(data_path="hide_viewport", frame=frame)

impact_flash = ico("impact_flash", impact, (0.08, 0.08, 0.08), fx_core, skill_collection, 1)
for frame, scale in ((1, 0.001), (36, 0.001), (38, 0.3), (40, 0.62), (43, 0.2), (48, 0.001)):
    impact_flash.scale = (scale, scale, scale)
    impact_flash.keyframe_insert(data_path="scale", frame=frame)

for index, (radius, height, frame_scale) in enumerate(((0.19, 0.12, 38), (0.35, 0.18, 40), (0.49, 0.24, 42))):
    ring = torus("ignition_burst_ring_" + str(index + 1), (impact.x, impact.y, height), radius, 0.025, fx_impact, skill_collection)
    for frame, scale in ((1, 0.001), (frame_scale - 2, 0.001), (frame_scale, 0.4), (frame_scale + 3, 1.0), (48, 1.18)):
        ring.scale = (scale, scale, scale)
        ring.keyframe_insert(data_path="scale", frame=frame)

# One clearly bounded, 1x1 fire patch; neighboring cells have no fire geometry.
flame_objects = []
for index, (x_offset, height, lean, width) in enumerate([
    (-0.28, 0.66, -0.10, 0.17), (-0.08, 0.92, -0.04, 0.2), (0.15, 0.74, 0.12, 0.18), (0.3, 0.48, 0.16, 0.13),
]):
    base = Vector((impact.x + x_offset, impact.y, 0.06))
    tip = base + Vector((lean, 0.0, height))
    outer_flame = cone_between("ignition_flame_outer_" + str(index + 1), base, tip, width, 0.006, orange, skill_collection, 5)
    inner_flame = cone_between("ignition_flame_core_" + str(index + 1), base + Vector((0, -0.008, 0.01)), base + Vector((lean * 0.62, -0.01, height * 0.72)), width * 0.48, 0.004, yellow, skill_collection, 5)
    flame_objects.extend((outer_flame, inner_flame))

for obj in flame_objects:
    obj.hide_render = True
    obj.hide_viewport = True
    for frame, visible in ((1, False), (37, False), (39, True), (48, True)):
        obj.hide_render = not visible
        obj.hide_viewport = not visible
        obj.keyframe_insert(data_path="hide_render", frame=frame)
        obj.keyframe_insert(data_path="hide_viewport", frame=frame)

for index in range(10):
    spread = (index - 4.5) * 0.075
    pos = impact + Vector((spread, -0.025, 0.12 + (index % 3) * 0.055))
    spark = ico("ignition_ember_" + str(index + 1), pos, (0.025, 0.025, 0.055 if index % 2 else 0.035), ember, skill_collection, 1)
    spark.rotation_euler[1] = (index - 4) * 0.12
    spark.hide_render = True
    spark.hide_viewport = True
    for frame, visible in ((1, False), (37, False), (39, True), (48, True)):
        spark.hide_render = not visible
        spark.hide_viewport = not visible
        spark.keyframe_insert(data_path="hide_render", frame=frame)
        spark.keyframe_insert(data_path="hide_viewport", frame=frame)

for obj in list(skill_collection.objects):
    if obj != fx_root:
        obj.parent = fx_root

# Make the startup view show the bird and single-cell impact composition.
scene.frame_set(41)

if REFERENCE.exists():
    reference_image = bpy.data.images.load(str(REFERENCE), check_existing=False)
    reference_image.name = "REFERENCE_firebird_packed"
    reference_image.pack()
    reference_empty = bpy.data.objects.new("REFERENCE_firebird_hidden", None)
    studio_collection.objects.link(reference_empty)
    reference_empty.empty_display_type = "IMAGE"
    reference_empty.data = reference_image
    reference_empty.empty_display_size = 3.0
    reference_empty.hide_viewport = True
    reference_empty.hide_render = True
    scene["packed_reference_image"] = reference_image.name

world = bpy.data.worlds.new("firebird_studio_world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.73, 0.79, 0.85, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42
scene.world = world

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

for name, location, energy, size, color in [
    ("key_light", (-4, -5, 6), 850, 4.5, (1.0, 0.75, 0.55)),
    ("fill_light", (4, -2, 4), 420, 3.5, (0.65, 0.78, 1.0)),
    ("rim_light", (0, 4, 5), 650, 3.0, (1.0, 0.42, 0.18)),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    studio_collection.objects.link(light)
    light.location = location
    point_at(light, (0, 0, 1.35))

camera_data = bpy.data.cameras.new("firebird_camera")
camera = bpy.data.objects.new("firebird_camera", camera_data)
studio_collection.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 4.9
camera.location = (3.5, -6.2, 4.0)
point_at(camera, (0.05, -0.05, 1.5))
scene.camera = camera
scene.render.filepath = str(PREVIEW)
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action="DESELECT")
bird_root.select_set(True)
fx_root.select_set(True)
bpy.context.view_layer.objects.active = bird_root
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_distance = 5.0
        area.spaces.active.region_3d.view_location = (0, 0, 1.4)

scene["asset_id"] = "firebird_ai"
scene["grid_cell_size"] = CELL
scene["bird_footprint"] = "3x3 cells"
scene["skill"] = "Fireball ignites exactly one 1x1 cell"
scene["skill_animation_frames"] = "1-48"
scene["preview"] = str(PREVIEW)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

points = [obj.matrix_world @ vertex.co for obj in bird_collection.objects if obj.type == "MESH" for vertex in obj.data.vertices]
minimum = [min(point[axis] for point in points) for axis in range(3)]
maximum = [max(point[axis] for point in points) for axis in range(3)]
assert max(abs(point.x) for point in points) <= 1.5
assert max(abs(point.y) for point in points) <= 1.5
metadata = {
    "id": "firebird_ai",
    "blend": str(BLEND.relative_to(ROOT)).replace("\\\\", "/"),
    "sourceConcept": str(REFERENCE.relative_to(ROOT)).replace("\\\\", "/") if REFERENCE.exists() else "attached user reference",
    "cellSize": CELL,
    "footprint": "3x3 cells",
    "modelBounds": {"min": [round(v, 5) for v in minimum], "max": [round(v, 5) for v in maximum]},
    "skill": {"name": "火球点燃单格", "target": "one 1x1 grid cell", "animationFrames": [1, 48]},
    "collections": [c.name for c in (bird_collection, skill_collection, grid_collection)],
    "visualOnly": True
}
(BLEND.with_suffix(".manifest.json")).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=False))
