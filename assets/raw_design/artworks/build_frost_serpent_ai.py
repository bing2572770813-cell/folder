"""Build a grid-scaled low-poly frost serpent with a reusable ice-breath effect."""
from pathlib import Path
import json
import math
import sys
import tempfile
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "assets/raw_design/artworks"
REFERENCE = ART / "frost_serpent_reference.png"
BLEND = ART / "frost_serpent_ai.blend"
PREVIEW = Path(tempfile.gettempdir()) / "frost_serpent_ai_preview.png"
CELL_SIZE = 1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

model_collection = bpy.data.collections.new("SNAKE_MODEL | editable")
grid_collection = bpy.data.collections.new("GRID_REFERENCE | 2x2 cells")
fx_collection = bpy.data.collections.new("FX_ICE_BREATH | skill effect")
studio_collection = bpy.data.collections.new("STUDIO | presentation")
for collection in (model_collection, grid_collection, fx_collection, studio_collection):
    scene.collection.children.link(collection)


def material(name, color, roughness=0.82, alpha=1.0, emission=None, emission_strength=0.0):
    rgb = [int(color[offset:offset + 2], 16) / 255.0 for offset in (1, 3, 5)]
    result = bpy.data.materials.new(name + "_ai")
    result.diffuse_color = (*rgb, alpha)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, alpha)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Alpha"].default_value = alpha
    if emission:
        emission_rgb = [int(emission[offset:offset + 2], 16) / 255.0 for offset in (1, 3, 5)]
        emission_color = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        if emission_color:
            emission_color.default_value = (*emission_rgb, 1.0)
        emission_power = shader.inputs.get("Emission Strength")
        if emission_power:
            emission_power.default_value = emission_strength
    if alpha < 1.0:
        try:
            result.surface_render_method = "DITHERED"
        except Exception:
            try:
                result.blend_method = "BLEND"
            except Exception:
                pass
        result.use_screen_refraction = True
    result["color_srgb"] = color
    result["asset_role"] = "skill_effect" if emission else "model"
    return result


ice = material("ice_white", "#dff8ff")
ice_light = material("ice_cyan", "#9de8f5")
ice_blue = material("ice_blue", "#48a9d5")
ice_shadow = material("ice_shadow", "#24658f")
ice_deep = material("ice_deep", "#17486f")
eye = material("serpent_eyes", "#071018", roughness=0.3)
mouth = material("mouth_shadow", "#143348", roughness=0.6)
fang = material("fangs", "#f4ffff", roughness=0.5)
fx_shell = material("frost_breath_shell", "#a8f1ff", alpha=0.10, emission="#54dfff", emission_strength=1.5)
fx_core = material("frost_breath_core", "#d8fbff", alpha=0.18, emission="#8defff", emission_strength=2.2)
fx_crystal = material("frost_crystal_glow", "#7ee6ff", alpha=0.78, emission="#48cfff", emission_strength=1.7)
fx_ring = material("frost_rings", "#c9f8ff", alpha=0.42, emission="#5fe4ff", emission_strength=2.0)
grid_tile = material("grid_tile", "#e6e1d3", roughness=0.96)
grid_edge = material("grid_edge", "#aaa99f", roughness=0.9)
grid_void = material("grid_void", "#c9d8da", roughness=0.96)


def link_object(obj, collection):
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mesh_object(name, vertices, faces, materials, indices=None, collection=model_collection):
    data = bpy.data.meshes.new(name + "_mesh_ai")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name + "_ai", data)
    collection.objects.link(obj)
    for surface in materials:
        data.materials.append(surface)
    if indices:
        for polygon, index in zip(data.polygons, indices):
            polygon.material_index = index
    editable = bmesh.new()
    editable.from_mesh(data)
    bmesh.ops.remove_doubles(editable, verts=list(editable.verts), dist=0.000001)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(data)
    editable.free()
    for polygon in data.polygons:
        polygon.use_smooth = False
    return obj


def box(name, location, dimensions, surface, bevel=0.0, collection=grid_collection):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = link_object(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    if bevel:
        modifier = obj.modifiers.new("single_bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def ico(name, location, scale, surface, collection=model_collection, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location)
    obj = link_object(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def crystal(name, location, scale, surface, collection=fx_collection, rotation=(0.0, 0.0, 0.0)):
    width, depth, height = scale
    vertices = [(0.0, 0.0, height), (width, 0.0, 0.0), (0.0, depth, 0.0), (-width, 0.0, 0.0), (0.0, -depth, 0.0), (0.0, 0.0, -height)]
    faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)]
    obj = mesh_object(name, vertices, faces, [surface], collection=collection)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def tube(name, points, radii, surfaces, collection=model_collection, sides=8):
    path = [Vector(point) for point in points]
    vertices = []
    for index, point in enumerate(path):
        if index == 0:
            tangent = (path[1] - path[0]).normalized()
        elif index == len(path) - 1:
            tangent = (path[-1] - path[-2]).normalized()
        else:
            tangent = (path[index + 1] - path[index - 1]).normalized()
        helper = Vector((0.0, 0.0, 1.0)) if abs(tangent.z) < 0.88 else Vector((0.0, 1.0, 0.0))
        side = tangent.cross(helper).normalized()
        up = tangent.cross(side).normalized()
        for segment in range(sides):
            angle = math.tau * segment / sides + math.pi / sides
            vertices.append(point + radii[index] * (side * math.cos(angle) + up * math.sin(angle)))
    faces = []
    indices = []
    for ring in range(len(path) - 1):
        for segment in range(sides):
            next_segment = (segment + 1) % sides
            first = ring * sides + segment
            second = ring * sides + next_segment
            third = (ring + 1) * sides + next_segment
            fourth = (ring + 1) * sides + segment
            if (ring + segment) % 2:
                faces.extend([(first, second, fourth), (second, third, fourth)])
            else:
                faces.extend([(first, second, third), (first, third, fourth)])
            indices.extend([(segment + ring) % len(surfaces), (segment + ring + 1) % len(surfaces)])
    faces.extend([tuple(reversed(range(sides))), tuple(range((len(path) - 1) * sides, len(path) * sides))])
    indices.extend([len(surfaces) - 1, 0])
    return mesh_object(name, vertices, faces, surfaces, indices, collection)


def wedge(name, center, forward, back_width, front_width, back_height, front_height, length, surfaces, collection=model_collection):
    direction = Vector(forward).normalized()
    side = Vector((-direction.y, direction.x, 0.0)).normalized()
    vertical = Vector((0.0, 0.0, 1.0))
    center = Vector(center)
    back = center - direction * length * 0.45
    front = center + direction * length * 0.55
    vertices = []
    for point, width, height in ((back, back_width, back_height), (front, front_width, front_height)):
        vertices.extend([point - side * width - vertical * height, point + side * width - vertical * height, point + side * width + vertical * height, point - side * width + vertical * height])
    faces = [(0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6), (0, 4, 5), (0, 5, 1), (1, 5, 6), (1, 6, 2), (2, 6, 7), (2, 7, 3), (3, 7, 4), (3, 4, 0)]
    indices = [0, 1, 2, 2, 1, 0, 1, 0, 1, 0, 2, 1]
    return mesh_object(name, vertices, faces, surfaces, indices, collection)


def oriented_cone(name, location, direction, radius, depth, surface, collection=fx_collection, vertices=8, radius_far=None):
    direction = Vector(direction).normalized()
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius_far if radius_far is not None else 0.0, depth=depth, location=location)
    obj = link_object(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(direction)
    obj.data.materials.append(surface)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def orient_to(obj, direction):
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(Vector(direction).normalized())


base_points = [
    (0.06, 0.27, 0.29), (0.06, 0.08, 0.25), (-0.16, -0.12, 0.22), (-0.48, -0.22, 0.20),
    (-0.75, -0.08, 0.18), (-0.82, 0.17, 0.17), (-0.70, 0.38, 0.17), (-0.42, 0.49, 0.18),
    (-0.08, 0.48, 0.19), (0.22, 0.36, 0.20), (0.38, 0.16, 0.21), (0.31, -0.06, 0.22),
    (0.08, -0.20, 0.22), (-0.18, -0.17, 0.22), (-0.34, 0.00, 0.22), (-0.25, 0.19, 0.23),
    (-0.05, 0.27, 0.24), (0.21, 0.28, 0.24), (0.40, 0.38, 0.25)
]
base_radii = [0.115, 0.135, 0.16, 0.18, 0.19, 0.19, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.125, 0.12, 0.115, 0.11, 0.105, 0.10, 0.095]
tube("coiled_serpent_body", base_points, base_radii, [ice, ice_light, ice_blue, ice_shadow, ice_deep], model_collection, 9)

tail_points = [
    (0.40, 0.42, 0.25), (0.54, 0.44, 0.32), (0.74, 0.44, 0.50), (0.88, 0.44, 0.75),
    (0.87, 0.44, 1.00), (0.75, 0.44, 1.16), (0.56, 0.44, 1.19), (0.40, 0.44, 1.04),
    (0.36, 0.44, 0.82), (0.45, 0.44, 0.66), (0.60, 0.44, 0.66), (0.70, 0.44, 0.78),
    (0.69, 0.44, 0.93), (0.59, 0.44, 1.04), (0.49, 0.44, 1.00), (0.47, 0.44, 0.87),
    (0.56, 0.44, 0.79), (0.65, 0.44, 0.84), (0.63, 0.44, 0.93), (0.57, 0.44, 0.96)
]
tail_radii = [0.14, 0.125, 0.11, 0.095, 0.08, 0.068, 0.058, 0.05, 0.043, 0.037, 0.032, 0.027, 0.022, 0.018, 0.014, 0.011, 0.008, 0.005, 0.003, 0.001]
tail_mesh = tube("raised_spiral_tail", tail_points, tail_radii, [ice, ice_light, ice_blue, ice_shadow, ice_deep], model_collection, 8)
tail_direction = Vector(tail_points[-1]) - Vector(tail_points[-2])
oriented_cone("sharp_spiral_tail_tip", Vector(tail_points[-1]) + tail_direction.normalized() * 0.015, tail_direction, 0.021, 0.075, ice_light, model_collection, 5, 0.0)

neck_points = [(0.06, 0.27, 0.29), (0.02, 0.18, 0.40), (0.01, 0.10, 0.62), (-0.02, 0.02, 0.82), (-0.12, -0.02, 1.02), (-0.24, -0.06, 1.17)]
neck_radii = [0.12, 0.135, 0.14, 0.135, 0.12, 0.105]
tube("raised_serpent_neck", neck_points, neck_radii, [ice_light, ice, ice_blue, ice_shadow, ice_deep], model_collection, 8)

head_center = Vector((-0.28, -0.12, 1.27))
head_forward = Vector((-0.88, -0.31, -0.16)).normalized()
head_side = Vector((-head_forward.y, head_forward.x, 0.0)).normalized()

def faceted_head(name, center, forward, side):
    vertical = Vector((0.0, 0.0, 1.0))
    side_axis = Vector((-forward.y, forward.x, 0.0)).normalized()
    up_axis = forward.cross(side_axis).normalized()
    sections = [(-0.18, 0.12, 0.10, -0.08), (-0.02, 0.16, 0.14, -0.105), (0.14, 0.105, 0.08, -0.065), (0.28, 0.048, 0.022, -0.022), (0.43, 0.006, 0.004, -0.004)]
    vertices = []
    for distance, width, top, bottom in sections:
        point = Vector((0.0, distance, 0.0))
        vertices.extend([
            point + Vector((0.0, 0.0, top)),
            point + Vector((width * 0.82, 0.0, top * 0.62)),
            point + Vector((width, 0.0, bottom * 0.42)),
            point + Vector((0.0, 0.0, bottom)),
        ])
    faces = []
    indices = []
    for ring in range(len(sections) - 1):
        first = ring * 4
        next_ring = (ring + 1) * 4
        for index in range(3):
            next_index = index + 1
            faces.append((first + index, first + next_index, next_ring + next_index, next_ring + index))
            indices.append([0, 1, 2][index])
    last = (len(sections) - 1) * 4
    faces.extend([(0, 1, 2, 3), (last, last + 3, last + 2, last + 1)])
    indices.extend([0, 1])
    data = bpy.data.meshes.new(name + "_mesh_ai")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name + "_ai", data)
    model_collection.objects.link(obj)
    for surface in (ice, ice_light, ice_blue, ice_shadow):
        data.materials.append(surface)
    for polygon, index in zip(data.polygons, indices):
        polygon.material_index = index
    editable = bmesh.new()
    editable.from_mesh(data)
    bmesh.ops.remove_doubles(editable, verts=list(editable.verts), dist=0.000001)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(data)
    editable.free()
    for polygon in data.polygons:
        polygon.use_smooth = False
    basis = Matrix(((side_axis.x, forward.x, up_axis.x), (side_axis.y, forward.y, up_axis.y), (side_axis.z, forward.z, up_axis.z)))
    obj.location = center
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = basis.to_quaternion()
    mirror = obj.modifiers.new("Mirror head symmetry", "MIRROR")
    mirror.use_axis[0] = True
    mirror.use_clip = True
    mirror.use_mirror_merge = True
    mirror.merge_threshold = 0.0001
    obj["symmetry"] = "Mirror modifier across local X head centerline"
    return obj

faceted_head("faceted_serpent_head", head_center, head_forward, head_side)
wedge("sharp_upper_snout", head_center + head_forward * 0.31 + Vector((0.0, 0.0, 0.005)), head_forward, 0.07, 0.008, 0.045, 0.006, 0.31, [ice_light, ice, ice_blue], model_collection)
wedge("open_lower_jaw", head_center + head_forward * 0.23 + Vector((0.0, 0.0, -0.12)), head_forward, 0.12, 0.028, 0.042, 0.012, 0.27, [mouth, ice_shadow, ice_deep], model_collection)

for side_sign in (-1, 1):
    eye_center = head_center + head_forward * 0.06 + head_side * side_sign * 0.145 + Vector((0.0, 0.0, 0.085))
    eye_mesh = ico("serpent_eye_" + ("left" if side_sign < 0 else "right"), eye_center, (0.042, 0.018, 0.024), eye, model_collection, 1)
    eye_mesh.rotation_mode = "QUATERNION"
    eye_mesh.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(head_side * side_sign)
    fang_position = head_center + head_forward * 0.35 + head_side * side_sign * 0.045 + Vector((0.0, 0.0, -0.035))
    oriented_cone("serpent_fang_" + ("left" if side_sign < 0 else "right"), fang_position, (0.0, 0.0, -1.0), 0.032, 0.17, fang, model_collection, 5, 0.0)

for index, (position, scale, rotation) in enumerate([
    ((-0.03, 0.14, 0.54), (0.055, 0.035, 0.17), (0.2, -0.4, 0.0)),
    ((0.03, 0.04, 0.73), (0.06, 0.04, 0.18), (-0.25, 0.32, 0.2)),
    ((-0.03, -0.02, 0.91), (0.055, 0.035, 0.15), (0.18, -0.2, -0.2)),
    ((-0.31, 0.16, 0.19), (0.08, 0.045, 0.13), (0.2, 0.0, 0.35)),
    ((0.22, -0.27, 0.19), (0.09, 0.05, 0.12), (-0.12, 0.0, -0.3)),
]):
    crystal("ice_scale_" + str(index + 1), position, scale, ice_light if index % 2 else ice_blue, model_collection, rotation)

model_root = bpy.data.objects.new("FROST_SERPENT_AI", None)
model_collection.objects.link(model_root)
model_root["asset_id"] = "frost_serpent_ai"
model_root["grid_cell_size"] = CELL_SIZE
model_root["grid_footprint"] = "2x2 cells"
model_root["visual_only"] = True
for obj in list(model_collection.objects):
    if obj != model_root:
        obj.parent = model_root

for row in range(2):
    for column in range(2):
        x = column - 0.5
        y = row - 0.5
        box("grid_cell_" + str(row) + "_" + str(column), (x, y, -0.025), (0.98, 0.98, 0.05), grid_tile, 0.012, grid_collection)
for x in (-1.0, 0.0, 1.0):
    box("grid_line_x_" + str(x), (x, 0.0, 0.008), (0.012, 2.0, 0.016), grid_edge, 0.0, grid_collection)
for y in (-1.0, 0.0, 1.0):
    box("grid_line_y_" + str(y), (0.0, y, 0.008), (2.0, 0.012, 0.016), grid_edge, 0.0, grid_collection)
box("grid_center_shadow", (0.0, 0.0, 0.003), (1.72, 1.45, 0.008), grid_void, 0.0, grid_collection)

fx_root = bpy.data.objects.new("FX_ICE_BREATH", None)
fx_collection.objects.link(fx_root)
fx_root["skill_name"] = "Frost Breath"
fx_root["skill_name_zh"] = "冰霜吐息"
fx_root["effect_type"] = "cone_beam_crystals"
fx_root["grid_scaled"] = True
breath_origin = head_center + head_forward * 0.52 + Vector((0.0, 0.0, -0.02))
breath_direction = Vector((-0.88, -0.45, 0.03)).normalized()
breath_end = breath_origin + breath_direction * 1.02
oriented_cone("frost_breath_outer_cone", breath_origin + breath_direction * 0.51, breath_direction, 0.075, 1.02, fx_shell, fx_collection, 8, 0.29)
oriented_cone("frost_breath_inner_cone", breath_origin + breath_direction * 0.42, breath_direction, 0.035, 0.84, fx_core, fx_collection, 7, 0.16)

for ring_index, distance in enumerate((0.23, 0.52, 0.82)):
    point = breath_origin + breath_direction * distance
    bpy.ops.mesh.primitive_torus_add(major_radius=0.11 + ring_index * 0.045, minor_radius=0.012, major_segments=12, minor_segments=4, location=point)
    ring = link_object(bpy.context.object, fx_collection)
    ring.name = "frost_breath_ring_" + str(ring_index + 1) + "_ai"
    orient_to(ring, breath_direction)
    ring.data.materials.append(fx_ring)
    for polygon in ring.data.polygons:
        polygon.use_smooth = False

particle_data = [
    (0.13, -0.02, 0.02, 0.07), (0.19, 0.10, 0.10, 0.045), (0.27, -0.12, -0.03, 0.085),
    (0.34, 0.08, -0.10, 0.052), (0.42, -0.18, 0.08, 0.095), (0.51, 0.16, 0.02, 0.06),
    (0.58, -0.10, 0.13, 0.043), (0.65, 0.23, -0.06, 0.07), (0.73, -0.23, 0.05, 0.09),
    (0.82, 0.04, 0.16, 0.055), (0.93, -0.17, -0.02, 0.045), (1.02, 0.18, 0.10, 0.06),
]
for index, (distance, side_offset, height_offset, size) in enumerate(particle_data):
    side = Vector((-breath_direction.y, breath_direction.x, 0.0)).normalized()
    position = breath_origin + breath_direction * distance + side * side_offset + Vector((0.0, 0.0, height_offset))
    crystal("frost_shard_" + str(index + 1), position, (size, size * 0.72, size * 1.45), fx_crystal if index % 3 else fx_core, fx_collection, (0.15 * index, -0.12 * index, 0.08 * index))

for index, distance in enumerate((0.32, 0.57, 0.84)):
    position = breath_origin + breath_direction * distance
    sparkle = ico("frost_mote_" + str(index + 1), position, (0.025, 0.025, 0.025), fx_core, fx_collection, 1)
    sparkle["effect_role"] = "floating_mote"

for obj in list(fx_collection.objects):
    if obj != fx_root:
        obj.parent = fx_root
fx_root.scale = (1.0, 1.0, 1.0)
fx_root.keyframe_insert(data_path="scale", frame=1)
fx_root.scale = (1.06, 1.06, 1.06)
fx_root.keyframe_insert(data_path="scale", frame=12)
fx_root.scale = (1.0, 1.0, 1.0)
fx_root.keyframe_insert(data_path="scale", frame=24)
scene.frame_start = 1
scene.frame_end = 24

if REFERENCE.exists():
    reference_image = bpy.data.images.load(str(REFERENCE), check_existing=False)
    reference_image.name = "REFERENCE_frost_serpent_packed"
    reference_image.pack()
    reference_empty = bpy.data.objects.new("REFERENCE_frost_serpent_hidden", None)
    studio_collection.objects.link(reference_empty)
    reference_empty.empty_display_type = "IMAGE"
    reference_empty.data = reference_image
    reference_empty.empty_display_size = 2.0
    reference_empty.hide_viewport = True
    reference_empty.hide_render = True
    scene["packed_reference_image"] = reference_image.name

for collection in (grid_collection, model_collection, fx_collection):
    for obj in collection.objects:
        if obj.type == "MESH":
            obj.select_set(False)

world = bpy.data.worlds.new("frost_studio_world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.65, 0.74, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.48
scene.world = world


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

for name, location, energy, size, color in [
    ("key_light", (-3.5, -4.0, 5.0), 700, 4.0, (0.76, 0.91, 1.0)),
    ("fill_light", (4.0, -1.0, 3.0), 360, 3.0, (0.58, 0.82, 1.0)),
    ("rim_light", (1.0, 4.0, 4.5), 520, 3.0, (0.48, 0.75, 1.0)),
]:
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light_data.color = color
    light = bpy.data.objects.new(name, light_data)
    studio_collection.objects.link(light)
    light.location = location
    point_at(light, (0.0, 0.0, 0.72))

camera_data = bpy.data.cameras.new("frost_serpent_camera")
camera = bpy.data.objects.new("frost_serpent_camera", camera_data)
studio_collection.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.85
camera.location = (-3.25, -4.8, 2.45)
point_at(camera, (-0.02, -0.02, 0.70))
scene.camera = camera
scene.render.filepath = str(PREVIEW)
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action="DESELECT")
model_root.select_set(True)
fx_root.select_set(True)
bpy.context.view_layer.objects.active = model_root
scene["asset_id"] = "frost_serpent_ai"
scene["cell_size"] = CELL_SIZE
scene["footprint_cells"] = "2x2"
scene["preview"] = str(PREVIEW)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

points = [obj.matrix_world @ vertex.co for collection in (model_collection,) for obj in collection.objects if obj.type == "MESH" for vertex in obj.data.vertices]
minimum = [min(point[axis] for point in points) for axis in range(3)]
maximum = [max(point[axis] for point in points) for axis in range(3)]
metadata = {
    "id": "frost_serpent_ai",
    "blend": str(BLEND.relative_to(ROOT)).replace("\\\\", "/"),
    "sourceConcept": str(REFERENCE.relative_to(ROOT)).replace("\\\\", "/") if REFERENCE.exists() else "attached user reference",
    "cellSize": CELL_SIZE,
    "footprint": "2x2 cells",
    "modelBounds": {"min": [round(value, 5) for value in minimum], "max": [round(value, 5) for value in maximum]},
    "skillEffect": "FX_ICE_BREATH / Frost Breath / animated pulse frames 1-24",
    "collections": [collection.name for collection in (model_collection, fx_collection, grid_collection)],
    "visualOnly": True,
}
(BLEND.with_suffix(".manifest.json")).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=False))
