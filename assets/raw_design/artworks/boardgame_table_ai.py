"""Reproducible Blender authoring for the editor's low-poly board-game table.

Run: blender --background --python assets/raw_design/artworks/boardgame_table_ai.py
Outputs: editable .blend, FBX, runtime geometry JSON and a preview PNG.
The asset's tabletop is at Blender Z=0 / Three.js Y=0.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "assets" / "raw_design" / "artworks"
MODELS = ROOT / "assets" / "model"
STEM = "boardgame_table_ai"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1
asset = bpy.data.collections.new("Board game table | export")
scene.collection.children.link(asset)


def linear(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def material(name, color):
    mat = bpy.data.materials.new(name)
    channels = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    rgba = tuple(linear(v) for v in channels) + (1,)
    mat.diffuse_color = rgba
    mat["color_srgb"] = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = 0.86
    return mat


cream = material("Ivory tabletop", "#e5dbc3")
sage = material("Sage frame", "#9aac94")
dark_sage = material("Recessed sage apron", "#7e947e")
warm = material("Warm edge inlay", "#c7b58d")
materials = [cream, sage, dark_sage, warm]


def box(name, center, dimensions, mat, bevel=0.04, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    asset.objects.link(obj)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Single facet chamfer", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Keep the broad faces planar and the bevels visibly faceted.
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


# Open tabletop for the game: the broad horizontal surface has no props or seams.
box("Tabletop", (0, 0, -0.22), (10, 10, 0.44), cream, 0.12)
box("Fine warm edge", (0, 0, -0.45), (9.88, 9.88, 0.12), warm, 0.055)
box("Sage lower lip", (0, 0, -0.57), (9.66, 9.66, 0.17), sage, 0.07)

# Apron and gently splayed square legs read as a crafted tabletop-game stand.
for sign in (-1, 1):
    box(f"Apron X {sign}", (0, sign * 4.04, -0.97), (8.4, 0.32, 0.76), dark_sage, 0.045)
    box(f"Apron Y {sign}", (sign * 4.04, 0, -0.97), (0.32, 7.85, 0.76), dark_sage, 0.045)
for xsign in (-1, 1):
    for ysign in (-1, 1):
        box(
            f"Leg {xsign} {ysign}",
            (xsign * 3.9, ysign * 3.9, -2.05),
            (0.62, 0.62, 3.05),
            sage,
            0.07,
            (math.radians(ysign * 3), math.radians(-xsign * 3), 0),
        )

bpy.context.view_layer.update()

# Export actual authored Blender mesh data, with flat corner normals, to a compact
# runtime resource. Rotation (X,Y,Z) -> (X,Z,-Y) is right handed, Y-up.
def to_three(vec):
    return [round(vec.x, 6), round(vec.z, 6), round(-vec.y, 6)]


meshes = []
triangle_count = 0
all_points = []
for mat in materials:
    positions, normals = [], []
    for obj in asset.objects:
        if obj.type != "MESH" or obj.data.materials[0] != mat:
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        for tri in mesh.loop_triangles:
            normal = (normal_matrix @ tri.normal).normalized()
            for vertex_index in tri.vertices:
                vertex = to_three(obj.matrix_world @ mesh.vertices[vertex_index].co)
                positions.extend(vertex)
                normals.extend(to_three(normal))
                all_points.append(vertex)
            triangle_count += 1
    meshes.append({"name": mat.name, "color": mat["color_srgb"], "positions": positions, "normals": normals})

document = {
    "generator": "Blender " + bpy.app.version_string,
    "source": "assets/raw_design/artworks/boardgame_table_ai.blend",
    "coordinates": "Y-up, tabletop at Y=0",
    "dimensions": {"width": 10, "depth": 10},
    "triangleCount": triangle_count,
    "bounds": {"min": [min(v[i] for v in all_points) for i in range(3)], "max": [max(v[i] for v in all_points) for i in range(3)]},
    "meshes": meshes,
}
MODELS.mkdir(exist_ok=True)
(MODELS / f"{STEM}.json").write_text(json.dumps(document, separators=(",", ":")) + "\n", encoding="utf-8")

bpy.ops.object.select_all(action="DESELECT")
for obj in asset.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(asset.objects))
bpy.ops.export_scene.fbx(
    filepath=str(MODELS / f"{STEM}.fbx"),
    use_selection=True,
    object_types={"MESH"},
    axis_forward="-Z",
    axis_up="Y",
    bake_anim=False,
    add_leaf_bones=False,
)

# Separate non-exported studio rig makes the editable source directly previewable.
preview = bpy.data.collections.new("Preview studio | not exported")
scene.collection.children.link(preview)


def studio_object(obj):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    preview.objects.link(obj)


bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -3.62))
ground = bpy.context.object
ground.name = "Preview ground"
ground.data.materials.append(material("Preview backdrop", "#cbd8d0"))
studio_object(ground)
bpy.ops.object.camera_add(location=(15, -18, 16))
camera = bpy.context.object
camera.name = "Isometric preview"
camera.rotation_euler = (Vector((0, 0, -0.9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 17
scene.camera = camera
studio_object(camera)
for name, location, energy, size in [
    ("Warm key", (-8, -10, 18), 2100, 8),
    ("Soft fill", (10, 5, 10), 900, 10),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    studio_object(light)
scene.world.color = (0.38, 0.43, 0.39)
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1024
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
scene.render.filepath = str(SOURCE / f"{STEM}.png")
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{STEM}.blend"))
bpy.ops.render.render(write_still=True)
print("TABLE_ASSET " + json.dumps({"triangles": triangle_count, "bounds": document["bounds"], "materials": len(meshes)}))
