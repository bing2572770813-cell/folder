"""Author the player concept as a readable fixed-view low-poly asset.
Blender uses Z-up; the exported GLB is the runtime player visual source.
"""
from pathlib import Path
import math,json,bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]; ART=ROOT/'assets/raw_design/artworks'; MODEL=ROOT/'assets/model'
ART.mkdir(parents=True,exist_ok=True); MODEL.mkdir(parents=True,exist_ok=True)
THUMB=ART/'player_ai_lowpoly_thumbnail.png'; BLEND=ART/'player_ai_lowpoly.blend'; GLB=MODEL/'player_ai_lowpoly.glb'; META=MODEL/'player_ai_lowpoly.manifest.json'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1; scene.render.engine='BLENDER_EEVEE_NEXT'

def material(name,hex_color,rough=.8):
 m=bpy.data.materials.new(name); rgb=tuple(int(hex_color[i:i+2],16)/255 for i in (1,3,5)); m.diffuse_color=(*rgb,1); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*rgb,1); b.inputs['Roughness'].default_value=rough; m['color_srgb']=hex_color; return m
skin=material('skin','#c5a995'); hair=material('charcoal hair','#303a38'); cloak=material('charcoal cloak','#26302f'); collar=material('folded collar','#60736e'); eye=material('eyes','#17201f',.35); sole=material('soft dark sole','#18211f'); accent=material('warm clasp','#c99653',.45); board=material('thumbnail board','#e5dbc3')

def link(obj,collection=None):
 collection=collection or bpy.context.scene.collection
 for c in list(obj.users_collection): c.objects.unlink(obj)
 collection.objects.link(obj); return obj

def ico(name,loc,scale,mat,sub=1,collection=None):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=link(bpy.context.object,collection);o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=False
 return o

def cube(name,loc,scale,mat,bevel=0,collection=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=link(bpy.context.object,collection);o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('intentional facet','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for f in o.data.polygons:f.use_smooth=False
 return o

def cone(name,loc,r1,r2,depth,mat,verts=6,collection=None):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc);o=link(bpy.context.object,collection);o.name=name;o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=False
 return o

def custom_mesh(name,verts,faces,mat,collection=None):
 me=bpy.data.meshes.new(name+' mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);(collection or bpy.context.scene.collection).objects.link(o);o.data.materials.append(mat)
 for f in me.polygons:f.use_smooth=False
 return o

def parent_root(name,parts,collection):
 root=bpy.data.objects.new(name,None);collection.objects.link(root)
 for part in parts:part.parent=root
 return root

def make_player(collection,scale=1,origin=(0,0,0),rotation=0,ghost=False):
 x,y,z=origin;s=scale; parts=[]
 # The cloak is a compact truncated hexagonal cone: a strong readable body silhouette.
 parts.append(cone('player cloak',(x,y,z+.42*s),.37*s,.25*s,.72*s,cloak,6,collection))
 # Hair mass, face plane, bob panels and mouse-ear silhouette.
 parts.append(ico('player hair',(x,y+.015*s,z+1.00*s),(.31*s,.25*s,.34*s),hair,1,collection))
 parts.append(ico('player face',(x,y-.225*s,z+1.00*s),(.235*s,.055*s,.265*s),skin,1,collection))
 parts.append(ico('player bob left',(x-.245*s,y-.005*s,z+.91*s),(.115*s,.20*s,.29*s),hair,1,collection))
 parts.append(ico('player bob right',(x+.245*s,y-.005*s,z+.91*s),(.115*s,.20*s,.29*s),hair,1,collection))
 parts.append(ico('player ear left',(x-.20*s,y+.01*s,z+1.30*s),(.17*s,.15*s,.17*s),hair,1,collection))
 parts.append(ico('player ear right',(x+.20*s,y+.01*s,z+1.30*s),(.17*s,.15*s,.17*s),hair,1,collection))
 # Broad folded collar reads as two triangular paper planes over the cloak.
 v=[(-.38,-.24,.70),(-.04,-.31,.93),(-.02,-.34,.57),(.02,-.34,.57),(.04,-.31,.93),(.38,-.24,.70),(0,-.38,1.04)]
 parts.append(custom_mesh('player folded collar',[(x+vx*s,y+vy*s,z+vz*s) for vx,vy,vz in v],[(0,1,2),(2,1,6),(2,6,3),(3,6,4),(3,4,5)],collar,collection))
 # Eyes and clasp make the token readable at board-cell scale.
 parts.append(ico('player eye left',(x-.085*s,y-.285*s,z+1.04*s),(.037*s,.025*s,.052*s),eye,1,collection))
 parts.append(ico('player eye right',(x+.085*s,y-.285*s,z+1.04*s),(.037*s,.025*s,.052*s),eye,1,collection))
 parts.append(cube('player clasp',(x,y-.355*s,z+.79*s),(.075*s,.025*s,.075*s),accent,.012*s,collection))
 parts.append(cube('player foot left',(x-.12*s,y-.06*s,z+.055*s),(.14*s,.26*s,.11*s),sole,.025*s,collection))
 parts.append(cube('player foot right',(x+.12*s,y-.06*s,z+.055*s),(.14*s,.26*s,.11*s),sole,.025*s,collection))
 root=parent_root('player_ai',parts,collection);root.location=origin;root.rotation_euler[2]=rotation
 if ghost:
  for part in parts:
   for m in part.data.materials:
    color=m.diffuse_color; m.diffuse_color=tuple(v*.68 for v in color[:3])+(1,)
 return root

# Runtime collection and source metadata.
runtime=bpy.data.collections.new('Player AI | runtime');scene.collection.children.link(runtime);make_player(runtime)
scene['asset_id']='player_ai';scene['category']='creature';scene['source_concept']='assets/raw_design/artworks/Player_1.jpg';scene['coordinate_system']='Blender Z-up, glTF Y-up';scene['fixed_view']='Three.js editor fixedView orthographic';scene['player_token_no_bottom_plane']=True
# Thumbnail design sheet uses the same exact parts at three scales.
thumb=bpy.data.collections.new('Player thumbnail | design');scene.collection.children.link(thumb)
make_player(thumb,1.0,origin=(0,0,0),rotation=math.radians(-8));make_player(thumb,.34,origin=(-1.18,.0,.0),rotation=math.radians(18),ghost=True);make_player(thumb,.34,origin=(1.15,.0,.0),rotation=math.radians(180),ghost=True)
cube('thumbnail board',(0,0,-.08),(3.25,1.65,.12),board,.06,thumb)
# Camera matches the editor's fixed isometric impression.
bpy.ops.object.camera_add(location=(3.7,-6.2,3.4));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=3.15;cam.rotation_euler=(Vector((0,0,.68))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));key=bpy.context.object;key.data.energy=500;key.data.size=5;key.rotation_euler=(-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(4,1,3));fill=bpy.context.object;fill.data.energy=160;fill.data.size=4;fill.rotation_euler=(-fill.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Player studio world');scene.world.color=(.72,.76,.73);scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.render.filepath=str(THUMB);bpy.ops.render.render(write_still=True)
# Save source with thumbnail study included, then export only runtime player collection.
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND));bpy.ops.object.select_all(action='DESELECT')
for obj in runtime.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=runtime.objects[0]
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_normals=True,export_cameras=False,export_lights=False)
meta={'id':'player_ai','sourceConcept':'assets/raw_design/artworks/Player_1.jpg','thumbnail':'assets/raw_design/artworks/player_ai_lowpoly_thumbnail.png','blend':'assets/raw_design/artworks/player_ai_lowpoly.blend','glb':'assets/model/player_ai_lowpoly.glb','coordinates':'Blender Z-up / glTF Y-up','fixedView':'Three.js editor fixedView orthographic','design':['mouse-ear hair silhouette','short bob panels','faceted face and readable eyes','short charcoal folded cloak','broad angular folded-paper collar','separate feet for board-cell readability','no bottom plane under token body'],'gameplay':'Existing player.cjs and player prefab remain authoritative; this asset is visual only.'}
META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(meta,ensure_ascii=False))
