import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'assets/raw_design/artworks/player_ai_lowpoly_thumbnail.png'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.render.engine='BLENDER_EEVEE_NEXT'

def mat(name,color,rough=.8):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True; bsdf=m.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(*color,1); bsdf.inputs['Roughness'].default_value=rough; return m
skin=mat('skin',(0.74,.63,.54)); hair=mat('hair',(.19,.23,.23)); cloak=mat('cloak',(.12,.15,.16)); collar=mat('fold collar',(.28,.33,.33)); eye=mat('eyes',(.025,.035,.035)); accent=mat('accent',(.66,.46,.22)); ground=mat('ground',(.84,.82,.74))

def link(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 scene.collection.objects.link(o); return o

def ico(loc,scale,material,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=link(bpy.context.object);o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for f in o.data.polygons:f.use_smooth=False
 return o

def cone(loc,r1,r2,depth,material,verts=6):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=depth,location=loc);o=link(bpy.context.object);o.data.materials.append(material)
 for f in o.data.polygons:f.use_smooth=False
 return o

def cube(loc,scale,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=link(bpy.context.object);o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:mod=o.modifiers.new('facet','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def mesh(name,verts,faces,material,origin=(0,0,0),scale=1):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.location=origin;o.scale=(scale,scale,scale);o.data.materials.append(material)
 for f in me.polygons:f.use_smooth=False
 return o

def player(origin=(0,0,0),scale=1,turn=0,ghost=False):
 x,y,z=origin; s=scale
 objects=[]
 # compact cloak body: readable wedge silhouette
 objects.append(cone((x,y+.42*s,z),.36*s,.26*s,.68*s,cloak,6))
 # back hood/hair mass and exposed faceted face
 objects.append(ico((x,y+.96*s,z+.01*s),(.29*s,.32*s,.23*s),hair,1))
 objects.append(ico((x,y+.98*s,z-.20*s),(.22*s,.25*s,.12*s),skin,1))
 # bob panels
 objects.append(ico((x-.23*s,y+.88*s,z-.01*s),(.11*s,.28*s,.17*s),hair,1))
 objects.append(ico((x+.23*s,y+.88*s,z-.01*s),(.11*s,.28*s,.17*s),hair,1))
 # mouse ears; slightly flattened and faceted
 objects.append(ico((x-.18*s,y+1.20*s,z+.01*s),(.15*s,.16*s,.11*s),hair,1))
 objects.append(ico((x+.18*s,y+1.20*s,z+.01*s),(.15*s,.16*s,.11*s),hair,1))
 # broad folded-paper collar, two planes forming a strong triangle
 v=[(-.37,0,-.03),(-.04,.12,-.22),(-.02,.01,-.42),(.02,.01,-.42),(.04,.12,-.22),(.37,0,-.03),(.0,.18,.12)]
 objects.append(mesh('angular folded collar',v,[(0,1,2),(2,1,6),(2,6,3),(3,6,4),(3,4,5)],collar,(x,y+.67*s,z),s))
 # eyes face toward camera/front
 objects.append(ico((x-.085*s,y+1.02*s,z-.305*s),(.035*s,.045*s,.028*s),eye,1))
 objects.append(ico((x+.085*s,y+1.02*s,z-.305*s),(.035*s,.045*s,.028*s),eye,1))
 # tiny mouth/face cue
 objects.append(cube((x,y+.91*s,z-.315*s),(.07*s,.015*s,.018*s),accent,.006*s))
 # feet separate the cloak from board at tiny scale
 objects.append(cube((x-.12*s,y+.065*s,z-.07*s),(.13*s,.13*s,.24*s),hair,.025*s))
 objects.append(cube((x+.12*s,y+.065*s,z-.07*s),(.13*s,.13*s,.24*s),hair,.025*s))
 root=bpy.data.objects.new('player_thumbnail',None);scene.collection.objects.link(root)
 for o in objects:o.parent=root
 root.location=(0,0,0);root.rotation_euler=(math.pi/2,0,turn)
 if ghost:
  for o in objects:
   for m in o.data.materials:m.diffuse_color=tuple(v*.65 for v in m.diffuse_color[:3])+(1,)
 return root

# main and three tiny readability studies
player((0,0,0),1.0,math.radians(-12)); player((-1.25,0,0),.42,math.radians(20),True); player((1.2,0,0),.42,math.radians(180),True)
# board-like ground plane for scale cue
cube((0,0,-.09),(3.2,1.65,.12),ground,.08)
# camera fixed isometric-like view
bpy.ops.object.camera_add(location=(3.8,-6.5,3.4));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=3.45;cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));key=bpy.context.object;key.data.energy=550;key.data.size=5;key.rotation_euler=(-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(4,1,3));fill=bpy.context.object;fill.data.energy=180;fill.data.size=4;fill.rotation_euler=(-fill.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Thumbnail World');scene.world.color=(.73,.76,.72);scene.render.resolution_x=1024;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.render.filepath=str(OUT);bpy.ops.render.render(write_still=True)
print('PLAYER_THUMBNAIL',OUT)
