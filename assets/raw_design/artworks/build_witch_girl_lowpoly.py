"""Build the witch-girl player token from the supplied concept images.

Blender is Z-up; the exported GLB is Y-up. This is a visual-only asset:
player.cjs and the player prefab remain authoritative for gameplay.
"""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "assets/raw_design/artworks"
MODEL = ROOT / "assets/model"
ART.mkdir(parents=True, exist_ok=True)
MODEL.mkdir(parents=True, exist_ok=True)

REFERENCE = ART / "witch_girl_reference.png"
THUMBNAIL = ART / "witch_girl_lowpoly_thumbnail.png"
BLEND = ART / "witch_girl_player.blend"
GLB = MODEL / "player_witch_ai.glb"
MANIFEST = MODEL / "player_witch_ai.manifest.json"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "BLENDER_EEVEE_NEXT"


def material(name, color, roughness=0.82):
    rgb = tuple(int(color[i:i + 2], 16) / 255.0 for i in (1, 3, 5))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    mat["color_srgb"] = color
    return mat


# A restrained Monument-Valley palette: near-black plum, paper cream, and
# cool silver hair so the silhouette stays readable at board-cell scale.
hat = material("hat plum", "#40384f")
hat_top = material("hat top facet", "#5d536d")
hat_shadow = material("hat underside", "#211f2a")
cloak = material("cloak midnight", "#252836")
cloak_light = material("cloak facet", "#45465d")
cloak_shadow = material("cloak shadow", "#171923")
hair = material("silver hair", "#c8c7c9")
hair_shadow = material("silver hair shadow", "#8f9098")
face = material("face paper cream", "#eadbc8")
eye = material("eyes", "#1b1a22", 0.35)
collar = material("folded collar", "#f2eadf")
accent = material("warm clasp", "#d08b52", 0.5)
boots = material("boots", "#191b25")
board = material("thumbnail board", "#d9cfbd")
board_edge = material("thumbnail board edge", "#b5aa96")
shadow = material("thumbnail shadow", "#8e8a84")


def link(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = link(bpy.context.object, collection)
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("single designed edge", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def ico(name, location, scale, mat, collection, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=1.0, location=location
    )
    obj = link(bpy.context.object, collection)
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def cylinder(name, location, radius, depth, mat, collection, vertices=10, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location
    )
    obj = link(bpy.context.object, collection)
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def mesh(name, vertices, faces, mat, collection):
    data = bpy.data.meshes.new(name + " mesh")
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = False
    return obj


def open_frustum(name, z0, z1, radius0, radius1, mat, collection, sides=8):
    vertices = []
    for z, radius in ((z0, radius0), (z1, radius1)):
        for i in range(sides):
            angle = 2.0 * math.pi * i / sides
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
    faces = []
    for i in range(sides):
        j = (i + 1) % sides
        faces.append((i, j, sides + j, sides + i))
    # Close the shoulders but deliberately leave the underside open.
    faces.append(tuple(range(sides, sides * 2)))
    return mesh(name, vertices, faces, mat, collection)


def bent_hat_crown(name, mat, collection):
    """A faceted tube following the curled profile in the concept sketch."""
    rings = [
        # center x, center y, center z, radius
        (0.00, 0.00, 1.67, 0.285),
        (0.00, 0.00, 1.86, 0.235),
        (-0.035, 0.00, 2.03, 0.185),
        (-0.15, 0.00, 2.13, 0.135),
        (-0.285, 0.00, 2.08, 0.095),
        (-0.34, 0.00, 1.98, 0.035),
    ]
    sides = 6
    vertices = []
    for cx, cy, cz, radius in rings:
        for i in range(sides):
            angle = 2.0 * math.pi * i / sides
            vertices.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle), cz))
    faces = []
    for ring in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            faces.append((ring * sides + i, ring * sides + j,
                          (ring + 1) * sides + j, (ring + 1) * sides + i))
    faces.append(tuple(range((len(rings) - 1) * sides, len(rings) * sides)))
    return mesh(name, vertices, faces, mat, collection)


def parent_root(name, parts, collection):
    root = bpy.data.objects.new(name, None)
    collection.objects.link(root)
    for part in parts:
        part.parent = root
    return root


def build_player(collection, scale=1.0, origin=(0.0, 0.0, 0.0), rotation=0.0):
    ox, oy, oz = origin
    s = scale
    parts = []

    # Compact open-bottom cloak: 0.78 board units tall and under one-cell wide.
    parts.append(open_frustum("cloak body", oz + 0.08 * s, oz + 0.84 * s,
                               0.39 * s, 0.255 * s, cloak, collection, sides=8))
    # Two large planar facets make the paper-fold look survive a small render.
    parts.append(mesh("cloak front light fold", [
        (ox - 0.39 * s, oy - 0.01 * s, oz + 0.08 * s),
        (ox, oy - 0.34 * s, oz + 0.08 * s),
        (ox + 0.39 * s, oy - 0.01 * s, oz + 0.08 * s),
        (ox, oy - 0.255 * s, oz + 0.84 * s),
    ], [(0, 1, 3), (1, 2, 3)], cloak_light, collection))
    parts.append(mesh("cloak rear shadow fold", [
        (ox - 0.28 * s, oy + 0.17 * s, oz + 0.08 * s),
        (ox + 0.28 * s, oy + 0.17 * s, oz + 0.08 * s),
        (ox + 0.18 * s, oy + 0.17 * s, oz + 0.84 * s),
        (ox - 0.18 * s, oy + 0.17 * s, oz + 0.84 * s),
    ], [(0, 1, 2, 3)], cloak_shadow, collection))

    # Hair, face, and the simple dark eyes are intentionally graphic rather
    # than realistic, matching the attached low-poly modeling reference.
    parts.append(ico("hair mass", (ox, oy + 0.01 * s, oz + 1.10 * s),
                     (0.305 * s, 0.235 * s, 0.34 * s), hair_shadow, collection))
    parts.append(ico("face", (ox, oy - 0.225 * s, oz + 1.10 * s),
                     (0.225 * s, 0.055 * s, 0.245 * s), face, collection))
    parts.append(ico("hair left panel", (ox - 0.235 * s, oy - 0.005 * s, oz + 1.03 * s),
                     (0.105 * s, 0.17 * s, 0.30 * s), hair, collection))
    parts.append(ico("hair right panel", (ox + 0.235 * s, oy - 0.005 * s, oz + 1.03 * s),
                     (0.105 * s, 0.17 * s, 0.30 * s), hair, collection))
    parts.append(ico("left eye", (ox - 0.073 * s, oy - 0.285 * s, oz + 1.13 * s),
                     (0.032 * s, 0.022 * s, 0.046 * s), eye, collection))
    parts.append(ico("right eye", (ox + 0.073 * s, oy - 0.285 * s, oz + 1.13 * s),
                     (0.032 * s, 0.022 * s, 0.046 * s), eye, collection))
    parts.append(cube("small coral smile", (ox, oy - 0.286 * s, oz + 1.035 * s),
                      (0.055 * s, 0.014 * s, 0.012 * s), accent, collection, 0.004 * s))

    # The folded collar is three readable paper triangles, not a solid block.
    collar_vertices = [
        (ox - 0.36 * s, oy - 0.20 * s, oz + 0.83 * s),
        (ox - 0.04 * s, oy - 0.35 * s, oz + 1.00 * s),
        (ox, oy - 0.40 * s, oz + 0.66 * s),
        (ox + 0.36 * s, oy - 0.20 * s, oz + 0.83 * s),
        (ox + 0.04 * s, oy - 0.35 * s, oz + 1.00 * s),
    ]
    parts.append(mesh("folded paper collar", collar_vertices,
                      [(0, 1, 2), (2, 1, 4), (2, 4, 3)], collar, collection))
    parts.append(cube("cloak clasp", (ox, oy - 0.39 * s, oz + 0.76 * s),
                      (0.075 * s, 0.032 * s, 0.075 * s), accent, collection, 0.010 * s))

    # Wide low-poly brim keeps the silhouette readable while remaining under
    # a single board cell (0.92 diameter). The crown follows the curled tip.
    parts.append(cylinder("hat underside", (ox, oy, oz + 1.48 * s),
                          0.46 * s, 0.07 * s, hat_shadow, collection, vertices=10,
                          scale=(1.0, 0.86, 1.0)))
    parts.append(cylinder("hat top brim", (ox, oy - 0.01 * s, oz + 1.525 * s),
                          0.43 * s, 0.045 * s, hat, collection, vertices=10,
                          scale=(1.0, 0.86, 1.0)))
    parts.append(bent_hat_crown("bent hat crown", hat_top, collection))
    # A small front ribbon fragment adds the concept's warm focal point without
    # turning the hat into a noisy texture-heavy asset.
    parts.append(cube("hat ribbon", (ox, oy - 0.275 * s, oz + 1.70 * s),
                      (0.30 * s, 0.025 * s, 0.065 * s), accent, collection, 0.008 * s))

    # Separate feet remain visible below the open cloak for board-cell contact.
    parts.append(cube("left boot", (ox - 0.115 * s, oy - 0.055 * s, oz + 0.045 * s),
                      (0.135 * s, 0.23 * s, 0.11 * s), boots, collection, 0.018 * s))
    parts.append(cube("right boot", (ox + 0.115 * s, oy - 0.055 * s, oz + 0.045 * s),
                      (0.135 * s, 0.23 * s, 0.11 * s), boots, collection, 0.018 * s))

    root = parent_root("player_witch_ai", parts, collection)
    root.location = origin
    root.rotation_euler[2] = rotation
    root["asset_id"] = "player_witch_ai"
    root["category"] = "creature"
    root["source_concept"] = REFERENCE.name
    root["fixed_view_readable"] = True
    root["open_bottom"] = True
    root["board_cell_footprint"] = 0.92
    root["height_units"] = 2.15
    return root


runtime = bpy.data.collections.new("Witch girl | runtime")
scene.collection.children.link(runtime)
build_player(runtime)

# A presentation scene uses the exact runtime mesh on a single-cell board tile.
studio = bpy.data.collections.new("Witch girl | thumbnail")
scene.collection.children.link(studio)
build_player(studio, origin=(0.0, 0.0, 0.0), rotation=math.radians(-7.0))
cube("thumbnail tile", (0.0, 0.0, -0.10), (2.85, 2.25, 0.12), board_edge, studio, 0.05)
cube("thumbnail tile top", (0.0, 0.0, -0.035), (2.72, 2.12, 0.025), board, studio, 0.035)
cylinder("thumbnail shadow", (0.0, -0.03, -0.005), 0.50, 0.008, shadow, studio, vertices=16,
          scale=(1.0, 0.52, 1.0))

# Orthographic isometric-ish studio framing, with enough contrast to reveal
# the faceted geometry rather than flattening the silver hair and paper collar.
bpy.ops.object.camera_add(location=(3.35, -5.8, 3.15))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.05
camera.rotation_euler = (Vector((0.0, 0.0, 1.02)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.2, 5.5))
key = bpy.context.object
key.data.energy = 430
key.data.size = 4.0
key.rotation_euler = (Vector((0.0, 0.0, 0.9)) - key.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.light_add(type="AREA", location=(3.8, -1.0, 3.2))
fill = bpy.context.object
fill.data.energy = 140
fill.data.size = 3.0
fill.rotation_euler = (Vector((0.0, 0.0, 1.0)) - fill.location).to_track_quat("-Z", "Y").to_euler()

world = bpy.data.worlds.new("witch studio world")
scene.world = world
world.color = (0.035, 0.035, 0.045)
scene.render.resolution_x = 1024
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(THUMBNAIL)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "Medium High Contrast"
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.object.select_all(action="DESELECT")
for obj in runtime.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = runtime.objects.get("player_witch_ai")
bpy.ops.export_scene.gltf(
    filepath=str(GLB),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
    export_normals=True,
    export_cameras=False,
    export_lights=False,
)

metadata = {
    "id": "player_witch_ai",
    "sourceConcept": "assets/raw_design/artworks/witch_girl_reference.png",
    "referenceRole": "attached concept and modeling reference supplied by the user",
    "thumbnail": "assets/raw_design/artworks/witch_girl_lowpoly_thumbnail.png",
    "blend": "assets/raw_design/artworks/witch_girl_player.blend",
    "glb": "assets/model/player_witch_ai.glb",
    "coordinates": "Blender Z-up / glTF Y-up",
    "fixedView": "Three.js editor fixedView orthographic",
    "boardCellFootprint": 0.92,
    "heightUnits": 2.15,
    "design": [
        "bent curled witch hat with a single-cell readable brim",
        "faceted near-black plum cloak with light front fold",
        "silver angular bob hair and simple cream face",
        "three-plane folded-paper collar",
        "separate boots visible below the open cloak",
        "low-poly flat-shaded surfaces, no smooth subdivision",
    ],
    "gameplay": "Visual asset only; player.cjs and player prefab remain authoritative.",
}
MANIFEST.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=False))
