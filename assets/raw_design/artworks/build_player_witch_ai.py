"""Build the reference witch from scratch; one board cell is one world unit."""
from pathlib import Path
import argparse
import json
import math
import sys
import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "assets/raw_design/artworks"
MODEL = ROOT / "assets/model"
ASSET_ID = "player_witch_ai"
parser = argparse.ArgumentParser()
parser.add_argument("--skip-render", action="store_true")
options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
runtime = bpy.data.collections.new("PLAYER | export only")
scene.collection.children.link(runtime)
studio = bpy.data.collections.new("STUDIO | never exported")
scene.collection.children.link(studio)


def material(name, color):
    channels = [int(color[offset:offset + 2], 16) / 255 for offset in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    result = bpy.data.materials.new(name + "_ai")
    result.diffuse_color = (*linear, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Roughness"].default_value = 0.9
    shader.inputs["Specular IOR Level"].default_value = 0.22
    result["color_srgb"] = color
    return result


hat = material("hat_charcoal", "#36343d")
hat_light = material("hat_side", "#44414a")
hat_dark = material("hat_underside", "#232128")
robe = material("robe_charcoal", "#27252b")
robe_light = material("robe_fold", "#353139")
robe_dark = material("robe_lining", "#19181e")
hair = material("silver_hair", "#c9c4c4")
hair_dark = material("hair_shadow", "#a9a5ae")
hair_light = material("hair_edge", "#d3cccc")
skin = material("warm_skin", "#edd0b8")
eye = material("ink_eyes", "#393036")
boot = material("boots", "#201e24")


def relink(obj, collection):
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mesh(name, vertices, faces, materials, indices=None, collection=runtime):
    data = bpy.data.meshes.new(name + "_mesh_ai")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name + "_ai", data)
    collection.objects.link(obj)
    for entry in materials:
        data.materials.append(entry)
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


def box(name, location, dimensions, surface, bevel=0, collection=runtime):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = relink(bpy.context.object, collection)
    obj.name = name + "_ai"
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    if bevel:
        modifier = obj.modifiers.new("single_bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def loft(name, rings, sides, materials, assignments=None, closed=True):
    vertices = []
    for center_x, center_y, height, radius_x, radius_y in rings:
        for index in range(sides):
            angle = math.tau * index / sides + math.pi / sides
            vertices.append((center_x + radius_x * math.cos(angle), center_y + radius_y * math.sin(angle), height))
    faces = []
    indices = []
    for ring_index in range(len(rings) - 1):
        for index in range(sides):
            next_index = (index + 1) % sides
            faces.append((ring_index * sides + index, ring_index * sides + next_index, (ring_index + 1) * sides + next_index, (ring_index + 1) * sides + index))
            indices.append(assignments[index % len(assignments)] if assignments else 0)
    if closed:
        faces.extend([tuple(reversed(range(sides))), tuple(range((len(rings) - 1) * sides, len(rings) * sides))])
        indices.extend([0, 0])
    return mesh(name, vertices, faces, materials, indices)


robe_rings = [(0, 0.015, 0.086, 0.285, 0.173), (0, 0.015, 0.237, 0.224, 0.148), (0, 0.012, 0.608, 0.142, 0.108), (0, 0.005, 0.648, 0.124, 0.097)]
robe_inner = [(center_x, center_y, height, radius_x - 0.009, radius_y - 0.009) for center_x, center_y, height, radius_x, radius_y in reversed(robe_rings)]
robe_shell = loft("open_hem_cloak", robe_rings + robe_inner, 12, [robe, robe_light, robe_dark], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], closed=False)
for polygon in robe_shell.data.polygons:
    if 48 <= polygon.index < 84:
        polygon.material_index = 2
loft("raised_black_collar", [(0, 0, 0.63, 0.127, 0.105), (0, -0.006, 0.662, 0.148, 0.117), (0, 0, 0.694, 0.14, 0.106)], 12, [robe_dark, robe], [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0])
for side, sign in [("left", -1), ("right", 1)]:
    box(side + "_boot", (sign * 0.07, -0.028, 0.041), (0.087, 0.126, 0.082), boot, 0.009)
    box(side + "_ankle", (sign * 0.07, -0.002, 0.089), (0.057, 0.065, 0.031), skin, 0.004)

bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1, location=(0, -0.018, 0.811))
face = relink(bpy.context.object, runtime)
face.name = "faceted_face_ai"
face.scale = (0.18, 0.159, 0.179)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for vertex in face.data.vertices:
    vertex.co.y = max(vertex.co.y, -0.146)
face.data.materials.append(skin)
for side, sign in [("left", -1), ("right", 1)]:
    box(side + "_vertical_eye", (sign * 0.082, -0.168, 0.806), (0.029, 0.011, 0.079), eye, 0.006)

rear_angles = [math.radians(-115 + index * 23) for index in range(11)]
rear_rings = [(0.654, 0.174, 0.114), (0.703, 0.22, 0.153), (0.85, 0.233, 0.179), (0.957, 0.21, 0.156), (0.997, 0.151, 0.108)]
rear_vertices = [(radius_x * math.sin(angle), 0.02 + radius_y * math.cos(angle), height) for height, radius_x, radius_y in rear_rings for angle in rear_angles]
rear_faces = []
for ring_index in range(len(rear_rings) - 1):
    for index in range(10):
        start = ring_index * 11 + index
        rear_faces.append((start, start + 1, start + 12, start + 11))
rear_faces.extend([tuple(reversed(range(11))), tuple(range(44, 55)), tuple([ring_index * 11 for ring_index in range(5)] + [ring_index * 11 + 10 for ring_index in reversed(range(5))])])
mesh("bob_back_shell", rear_vertices, rear_faces, [hair, hair_dark], [1 if index % 10 in (0, 9) else 0 for index in range(len(rear_faces))])
for side, sign in [("left", -1), ("right", 1)]:
    rows = [(0.969, 0.148, 0.18, 0.20), (0.855, 0.17, 0.20, 0.229), (0.704, 0.167, 0.198, 0.226), (0.641, 0.157, 0.181, 0.208), (0.608, 0.138, 0.141, 0.145)]
    vertices = []
    for height, inside, ridge, outside in rows:
        vertices.extend([(sign * inside, -0.146, height), (sign * ridge, -0.17, height + 0.008), (sign * outside, -0.106, height + 0.019), (sign * outside, 0.048, height + 0.024), (sign * inside, 0.065, height)])
    faces = []
    indices = []
    for ring_index in range(len(rows) - 1):
        for index in range(5):
            next_index = (index + 1) % 5
            faces.append((ring_index * 5 + index, ring_index * 5 + next_index, (ring_index + 1) * 5 + next_index, (ring_index + 1) * 5 + index))
            indices.append([0, 2, 0, 1, 1][index])
    faces.extend([tuple(reversed(range(5))), tuple(range(20, 25))])
    indices.extend([0, 0])
    mesh(side + "_pointed_bob", vertices, faces, [hair, hair_dark, hair_light], indices)

bangs = [(-0.17, -0.093, 0.826), (-0.094, -0.033, 0.832), (-0.033, 0.06, 0.827), (0.061, 0.114, 0.829), (0.113, 0.164, 0.837)]
for index, (left, right, bottom) in enumerate(bangs):
    inset = 0.01 if index in (1, 3) else 0.004
    outline = [(left, 0.989), (right, 0.98), (right - inset, bottom), (left + 0.004, bottom), (left, bottom + 0.057)]
    vertices = []
    for depth_offset in (0, 0.025):
        vertices.extend([(position, -0.166 - 0.018 * (1 - abs(position) / 0.18) + depth_offset + (height - bottom) * 0.21, height) for position, height in outline])
    faces = [tuple(reversed(range(5))), tuple(range(5, 10))]
    faces.extend((corner, (corner + 1) % 5, (corner + 1) % 5 + 5, corner + 5) for corner in range(5))
    mesh("blunt_fringe_" + str(index + 1), vertices, faces, [hair, hair_light], [index % 2] + [0] * 6)

# The wide asymmetric brim and square-section bent crown form the reference silhouette.
brim_segments = 12
brim_vertices = []
for ring_index in range(4):
    inner = ring_index in (0, 3)
    for index in range(brim_segments):
        angle = math.tau * index / brim_segments
        position_x = (0.18 if inner else 0.46) * math.cos(angle)
        position_y = (0.141 if inner else 0.32) * math.sin(angle) + 0.018
        height = (1.016 if inner else 0.96) + 0.225 * position_x + 0.025 * position_y - (0.018 if ring_index >= 2 else 0)
        brim_vertices.append((position_x, position_y, height))
brim_faces = []
brim_indices = []
for ring_index in range(4):
    for index in range(brim_segments):
        next_index = (index + 1) % brim_segments
        next_ring = (ring_index + 1) % 4
        brim_faces.append((ring_index * brim_segments + index, ring_index * brim_segments + next_index, next_ring * brim_segments + next_index, next_ring * brim_segments + index))
        brim_indices.append((1 if index in (1, 2, 8) else 0) if ring_index == 0 else 2)
mesh("sloping_twelve_sided_brim", brim_vertices, brim_faces, [hat, hat_light, hat_dark], brim_indices)

crown_path = [((-0.015, 0.02, 1.006), 0.182, 0.143), ((-0.073, 0.02, 1.284), 0.085, 0.082), ((0.186, 0.02, 1.438), 0.037, 0.046), ((0.314, 0.02, 1.293), 0.029, 0.031), ((0.231, 0.02, 1.183), 0.024, 0.026), ((0.139, 0.02, 1.252), 0.017, 0.019), ((0.191, 0.02, 1.322), 0.011, 0.012), ((0.237, 0.02, 1.286), 0.001, 0.001)]
section = [(-1, 0.6), (-0.66, 1), (0.66, 1), (1, 0.6), (1, -0.6), (0.66, -1), (-0.66, -1), (-1, -0.6)]
crown_vertices = []
for index, (coordinates, width, depth) in enumerate(crown_path):
    center = Vector(coordinates)
    if index == 0:
        tangent = Vector((0, 0, 1))
    elif index == len(crown_path) - 1:
        tangent = (center - Vector(crown_path[index - 1][0])).normalized()
    else:
        tangent = ((center - Vector(crown_path[index - 1][0])) + (Vector(crown_path[index + 1][0]) - center)).normalized()
    sideways = Vector((tangent.z, 0, -tangent.x))
    for horizontal, forward in section:
        crown_vertices.append(center + sideways * horizontal * width + Vector((0, forward * depth, 0)))
crown_faces = []
crown_indices = []
for ring_index in range(len(crown_path) - 1):
    for index in range(8):
        next_index = (index + 1) % 8
        crown_faces.append((ring_index * 8 + index, ring_index * 8 + next_index, (ring_index + 1) * 8 + next_index, (ring_index + 1) * 8 + index))
        crown_indices.append([0, 0, 1, 0, 1, 0, 2, 0][index])
crown_faces.extend([tuple(reversed(range(8))), tuple(range(56, 64))])
crown_indices.extend([2, 0])
mesh("continuous_square_spiral_crown", crown_vertices, crown_faces, [hat, hat_light, hat_dark], crown_indices)

root = bpy.data.objects.new(ASSET_ID, None)
runtime.objects.link(root)
for obj in list(runtime.objects):
    if obj.type == "MESH":
        obj.parent = root
root["cell_size"] = 1.0
root["max_footprint"] = 0.92
root["front_axis"] = "-Z in exported assets"
root["visual_only"] = True
bpy.context.view_layer.update()
points = [obj.matrix_world @ vertex.co for obj in runtime.objects if obj.type == "MESH" for vertex in obj.data.vertices]
minimum = [min(point[axis] for point in points) for axis in range(3)]
maximum = [max(point[axis] for point in points) for axis in range(3)]
footprint_radius = max(math.hypot(point.x, point.y) for point in points)
assert footprint_radius <= 0.47
assert abs(minimum[2]) < 0.000001
triangle_count = 0
for obj in runtime.objects:
    if obj.type == "MESH":
        obj.data.calc_loop_triangles()
        triangle_count += len(obj.data.loop_triangles)
assert triangle_count < 3000

bpy.ops.object.select_all(action="DESELECT")
for obj in runtime.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
MODEL.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.fbx(filepath=str(MODEL / (ASSET_ID + ".fbx")), use_selection=True, object_types={"MESH", "EMPTY"}, axis_forward="-Z", axis_up="Y", apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL", bake_space_transform=True, use_mesh_modifiers=True, mesh_smooth_type="OFF", use_triangles=True, add_leaf_bones=False, bake_anim=False, use_custom_props=True)
bpy.ops.export_scene.gltf(filepath=str(MODEL / (ASSET_ID + ".glb")), export_format="GLB", use_selection=True, export_apply=True, export_materials="EXPORT", export_normals=True, export_cameras=False, export_lights=False, export_extras=True)

paper = material("studio_paper", "#efebe4")
ground_material = material("studio_ground", "#e8e4e1")
box("studio_ground", (0, 0, -0.065), (200, 200, 0.06), ground_material, collection=studio)
for row in range(-1, 2):
    for column in range(-1, 2):
        box("cell_" + str(row) + "_" + str(column), (column, row, -0.02), (0.98, 0.98, 0.04), paper, 0.012, studio)
world = bpy.data.worlds.new("soft_studio_world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.72, 0.75, 0.8, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
scene.world = world

def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

for name, location, energy, size in [("key", (3, 4, 6), 470, 4), ("fill", (-4, 1, 3), 150, 3), ("rim", (-1, -4, 4), 330, 3)]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    studio.objects.link(light)
    light.location = location
    point_at(light, (0, 0, 0.7))
camera_data = bpy.data.cameras.new("reference_camera")
camera = bpy.data.objects.new("reference_camera", camera_data)
studio.objects.link(camera)
camera.data.type = "ORTHO"
scene.camera = camera
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100

def render(name, location, target, span):
    camera.location = location
    camera.data.ortho_scale = span
    point_at(camera, target)
    scene.render.filepath = str(ART / name)
    if not options.skip_render:
        bpy.ops.render.render(write_still=True)

for obj in studio.objects:
    if obj.name.startswith("cell_"):
        obj.hide_render = True
render("player_witch_front_ai.png", (0.02, -6, 1.85), (0, 0, 0.75), 1.78)
for obj in studio.objects:
    if obj.name.startswith("cell_"):
        obj.hide_render = False
render("player_witch_grid_ai.png", (-3, 5, 4.5), (0, 0, 0.52), 3.65)
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
bpy.context.view_layer.objects.active = root
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_distance = 2.6
        area.spaces.active.region_3d.view_location = (0, 0, 0.7)
bpy.ops.wm.save_as_mainfile(filepath=str(ART / (ASSET_ID + ".blend")))
metadata = {
    "id": ASSET_ID,
    "sourceConcept": "assets/raw_design/artworks/player_witch_reference.png",
    "authoringScript": "assets/raw_design/artworks/build_player_witch_ai.py",
    "blend": "assets/raw_design/artworks/player_witch_ai.blend",
    "fbx": "assets/model/player_witch_ai.fbx",
    "glb": "assets/model/player_witch_ai.glb",
    "previews": ["assets/raw_design/artworks/player_witch_front_ai.png", "assets/raw_design/artworks/player_witch_grid_ai.png"],
    "coordinates": "Blender Z-up/+Y front; FBX and GLB Y-up/-Z front; origin at soles",
    "cellSize": 1,
    "bounds": {"min": [round(minimum[0], 6), round(minimum[2], 6), round(minimum[1], 6)], "max": [round(maximum[0], 6), round(maximum[2], 6), round(maximum[1], 6)]},
    "dimensions": {"width": round(maximum[0] - minimum[0], 6), "height": round(maximum[2] - minimum[2], 6), "depth": round(maximum[1] - minimum[1], 6)},
    "maxHorizontalRadius": round(footprint_radius, 6),
    "triangles": triangle_count,
    "meshes": len([obj for obj in runtime.objects if obj.type == "MESH"]),
    "materials": len({surface.name for obj in runtime.objects if obj.type == "MESH" for surface in obj.data.materials}),
    "rigged": False,
    "textures": [],
    "gameplay": "Visual only; player.cjs and one-cell player occupancy remain unchanged. Studio tiles, camera and lights are not exported."
}
(MODEL / (ASSET_ID + ".manifest.json")).write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=False))
