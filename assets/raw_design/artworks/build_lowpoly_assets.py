"""Build the first Fold Field low-poly runtime asset pack.

Source references live beside this script in raw_design/artworks. The generated
blend is an editable source; the GLB is the runtime delivery for Three.js.
Coordinates are Y-up and the tabletop top is Y=0.
"""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
ART=ROOT/'assets'/'raw_design'/'artworks'
MODEL=ROOT/'assets'/'model'
ART.mkdir(parents=True,exist_ok=True); MODEL.mkdir(parents=True,exist_ok=True)
SOURCE=ART/'boardgame_table_ai.blend'
OUT_BLEND=ART/'fold_field_lowpoly_assets.blend'
OUT_GLB=MODEL/'fold_field_lowpoly.glb'
MANIFEST=MODEL/'fold_field_lowpoly.manifest.json'

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
# Keep only the authored table collection; studio camera, lights and backdrop are
# intentionally excluded from the game package.
for collection in list(bpy.data.collections):
    if collection.name != 'Board game table | export':
        bpy.data.collections.remove(collection)
table=bpy.data.collections.get('Board game table | export')
if table is None:
    table=bpy.data.collections.new('Board game table | export'); bpy.context.scene.collection.children.link(table)
assets=bpy.data.collections.new('Fold Field | runtime entities'); bpy.context.scene.collection.children.link(assets)

def mat(name,hex_color,rough=.84,metal=0.0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    rgb=tuple(int(hex_color[i:i+2],16)/255 for i in (1,3,5))
    m.diffuse_color=(*rgb,1); m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*rgb,1); bsdf.inputs['Roughness'].default_value=rough; bsdf.inputs['Metallic'].default_value=metal
    m['color_srgb']=hex_color
    return m
paper=mat('Paper white','#f4f5ed'); paper_edge=mat('Paper edge','#414140'); eye=mat('Token eye','#ffffff',.35); pupil=mat('Token pupil','#182721',.35); gold=mat('Key brass','#d99a38',.55,.25); grass=mat('Grass','#6f9f73'); grass_dark=mat('Grass shadow','#426b52'); ice=mat('Ice','#9fd2e8',.35); stone=mat('Blocker stone','#56645f'); fire=mat('Fire','#e75e36',.45); ember=mat('Fire core','#f5c34f',.4); dark=mat('Dark base','#303a38')

def link(obj,collection=assets):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj); return obj

def cube(name,loc,scale,material,bevel=0.0,collection=assets):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=link(bpy.context.object,collection); o.name=name; o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Low-poly chamfer','BEVEL'); mod.width=bevel; mod.segments=1; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=False
    return o

def cyl(name,loc,radius,depth,material,verts=6,collection=assets):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=loc); o=link(bpy.context.object,collection); o.name=name; o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=False
    return o

def ico(name,loc,scale,material,sub=1,collection=assets):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=link(bpy.context.object,collection); o.name=name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=False
    return o

def cone(name,loc,r1,r2,depth,material,verts=6,collection=assets):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc); o=link(bpy.context.object,collection); o.name=name; o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=False
    return o

def torus(name,loc,major,minor,material,rotation=(0,0,0),collection=assets):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=8,minor_segments=4,location=loc,rotation=rotation); o=link(bpy.context.object,collection); o.name=name; o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=False
    return o

def dodeca(name,loc,radius,material,collection=assets):
    # Blender 4.2 has no primitive_dodecahedron_add operator. Build the
    # regular solid from its canonical vertices and let BMesh compute the hull.
    import bmesh
    phi=(1+math.sqrt(5))/2; inv=1/phi
    coords=[]
    for x in (-1,1):
        for y in (-1,1):
            for z in (-1,1): coords.append((x,y,z))
    for y in (-inv,inv):
        for z in (-phi,phi): coords.extend([(0,y,z),(y,z,0),(z,0,y)])
    mesh=bpy.data.meshes.new(name+' mesh'); bm=bmesh.new()
    for x,y,z in coords: bm.verts.new((x*radius,y*radius,z*radius))
    bm.verts.ensure_lookup_table(); bmesh.ops.convex_hull(bm,input=list(bm.verts))
    bm.to_mesh(mesh); bm.free(); mesh.update()
    o=bpy.data.objects.new(name,mesh); collection.objects.link(o); o.location=loc; o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=False
    return o

def parent(name,objects):
    root=bpy.data.objects.new(name,None); assets.objects.link(root)
    for o in objects:o.parent=root
    return root

# Runtime paper tile; the top is exactly Y=0 so it agrees with the existing table.
paper_tile=cube('paper_ai',(0,-.045,0),(.98,.09,.98),paper,.025); paper_tile['asset_id']='paper_ai'; paper_tile['category']='terrain'; paper_tile['source_concept']='Paper_1.png'
# Intrinsic dark rim is geometry/material, independent from the editor grid toggle.
edge=cube('paper_ai_edge',(0,.002,0),(.99,.012,.99),paper_edge,.018); edge['asset_id']='paper_ai'; edge['role']='intrinsic_edge'

# Player token: dodecahedron has no bottom plane and keeps the current eye language.
token=dodeca('player_ai',(0,.42,0),.36,paper); token['asset_id']='player_ai'; token['category']='creature'; token['source_concept']='Player.jpg'
for x in (-.11,.11):
    e=ico('player_ai_eye',(x,.50,-.29),(.065,.065,.065),eye,1); e.parent=token
    p=ico('player_ai_pupil',(x,.50,-.346),(.029,.029,.029),pupil,1); p.parent=token

# Key prop: a flat ring, hexagonal shaft and two block teeth.
ring=torus('key_ai_ring',(0,.16,0),.18,.045,gold,rotation=(math.pi/2,0,0)); shaft=cyl('key_ai_shaft',(0,.16,-.23),.055,.46,gold,6); shaft.rotation_euler[0]=math.pi/2
teeth=[cube('key_ai_tooth_a',(-.09,.16,-.43),(.11,.10,.12),gold,.02),cube('key_ai_tooth_b',(.09,.16,-.43),(.11,.10,.12),gold,.02)]
keyroot=parent('key_ai',[ring,shaft,*teeth]); keyroot['asset_id']='key_ai'; keyroot['category']='item'; keyroot['source_concept']='Key_1.jpg'

# Terrain variants are intentionally compact and readable in the fixed editor view.
grass_base=cube('grass_ai',(0,.06,0),(.94,.12,.94),grass,.06); blades=[]
for x,z in [(-.25,-.2),(.2,-.15),(-.1,.2),(.28,.2)]:
    b=cone('grass_ai_blade',(x,.22,z),.08,0,.30,grass_dark,4); b.rotation_euler[1]=(-.25 if x<0 else .25); blades.append(b)
grassroot=parent('grass_ai',[grass_base,*blades]); grassroot['asset_id']='grass_ai'; grassroot['category']='terrain'; grassroot['source_concept']='Environment_1.jpg'

ice_base=ico('ice_ai',(0,.20,0),(.46,.20,.46),ice,1); ice_base['asset_id']='ice_ai'; ice_base['category']='terrain'; ice_base['source_concept']='Environment_2.jpg'
stone_base=cube('blocker_ai',(0,.25,0),(.90,.50,.90),stone,.10); stone_base['asset_id']='blocker_ai'; stone_base['category']='terrain'; stone_base['source_concept']='Environment_3.jpg'
fire_base=cube('fire_ai_base',(0,.07,0),(.88,.14,.88),dark,.10)
flames=[cone('fire_ai_outer',(-.12,.38,0),.20,.03,.62,fire,6),cone('fire_ai_inner',(.12,.32,.03),.15,.02,.50,ember,5),cone('fire_ai_tip',(0,.58,-.06),.10,.01,.56,fire,5)]
fireroot=parent('fire_ai',[fire_base,*flames]); fireroot['asset_id']='fire_ai'; fireroot['category']='terrain'; fireroot['source_concept']='Environment_1.jpg'

# A small low-poly creature blockout is included as a separate non-gameplay prop.
body=ico('creature_ai_body',(0,.42,0),(.28,.32,.38),stone,1); head=ico('creature_ai_head',(0,.70,-.18),(.25,.22,.25),stone,1); wing1=cone('creature_ai_wing',(-.30,.48,0),.22,0,.50,fire,4); wing1.rotation_euler=(0,.0,-math.pi/2); wing2=cone('creature_ai_wing',( .30,.48,0),.22,0,.50,fire,4); wing2.rotation_euler=(0,.0,math.pi/2); creature=parent('creature_ai',[body,head,wing1,wing2]); creature['asset_id']='creature_ai'; creature['category']='creature'; creature['source_concept']='Creature_1.jpg'

# Tag all game-visible roots and exclude helper children from separate scene exports.
for root in list(assets.objects):
    if root.parent is None and root.type in {'MESH','EMPTY'}: root['runtime_root']=True
bpy.context.scene['fold_field_asset_pack']='1.0'; bpy.context.scene['coordinate_system']='Y-up'; bpy.context.scene['fixed_view']='Three.js editor fixedView orthographic'; bpy.context.scene['tabletop_y']=0.0
# Remove cameras/lights from the source scene after table import.
for obj in list(bpy.context.scene.objects):
    if obj.type in {'CAMERA','LIGHT'}: bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
# Export only table and runtime assets, not hidden studio remnants.
bpy.ops.object.select_all(action='DESELECT')
for obj in list(table.objects)+list(assets.objects): obj.select_set(True)
bpy.context.view_layer.objects.active=table.objects[0] if table.objects else next(iter(assets.objects))
bpy.ops.export_scene.gltf(filepath=str(OUT_GLB),export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_normals=True,export_cameras=False,export_lights=False)
manifest={
 'name':'fold_field_lowpoly', 'version':'1.0.0', 'coordinates':'Y-up', 'fixedView':'Three.js editor fixedView orthographic',
 'sourceBlend':'assets/raw_design/artworks/fold_field_lowpoly_assets.blend', 'runtimeGlb':'assets/model/fold_field_lowpoly.glb',
 'referenceDirectory':'assets/raw_design/artworks',
 'assets':[
  {'id':'boardgame_table_ai','category':'environment','reference':'boardgame_table_ai.png','status':'converted','collision':'tabletop participates in fold collision'},
  {'id':'paper_ai','category':'terrain','reference':'Paper_1.png','status':'converted','collision':'physical'},
  {'id':'player_ai','category':'creature','reference':'Player.jpg','status':'converted','collision':'gameplay prefab remains authoritative'},
  {'id':'key_ai','category':'item','reference':'Key_1.jpg','status':'converted','collision':'prefab remains authoritative'},
  {'id':'grass_ai','category':'terrain','reference':'Environment_1.jpg','status':'converted'},
  {'id':'ice_ai','category':'terrain','reference':'Environment_2.jpg','status':'converted'},
  {'id':'fire_ai','category':'terrain','reference':'Environment_1.jpg','status':'converted'},
  {'id':'blocker_ai','category':'terrain','reference':'Environment_3.jpg','status':'converted'},
  {'id':'creature_ai','category':'creature','reference':'Creature_1.jpg','status':'blockout','note':'visual blockout; gameplay prefab/behavior not changed'},
 ],
 'pendingConcepts':['Characters.jpg','Player_1.jpg','Player_2.jpg','Key_2.jpg','Key_3.jpg','World_1.jpg']
}
MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'blend':str(OUT_BLEND),'glb':str(OUT_GLB),'manifest':str(MANIFEST),'assetCount':len(manifest['assets'])}))
