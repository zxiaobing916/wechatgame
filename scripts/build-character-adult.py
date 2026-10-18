"""Original procedural technical character. Run: blender -b --python scripts/build-character.py"""
import bpy, math, os
from mathutils import Vector
from math import sin, cos, pi
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.5):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
skin=mat('Skin warm porcelain',(.73,.47,.35),rough=.58); hair=mat('Hair chestnut',(.065,.033,.025),rough=.43); ivory=mat('OutfitIvory',(.86,.79,.63)); sage=mat('OutfitSage',(.32,.43,.32)); gold=mat('Antique gold',(.64,.39,.13),.65,.32); white=mat('Eye ivory',(.92,.89,.82),rough=.24); iris=mat('Iris hazel',(.21,.115,.055),rough=.23); black=mat('Pupil',(.012,.008,.009)); lip=mat('Lip rose',(.47,.16,.15),rough=.5); boot=mat('Boot walnut',(.12,.068,.038))
def group(n,p=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.parent=p;return o
root=group('CharacterRoot'); head=group('Head',root)
def finish(o,n,m,p=root):
 o.name=n;o.data.materials.append(m);o.parent=p
 if o.type=='MESH':
  for f in o.data.polygons:f.use_smooth=True
 return o
def uv(n,loc,scale,m,p=root):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc);o=bpy.context.object;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,n,m,p)
def tube(n,pts,r,m,p=root):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=3
 s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for q,co in zip(s.bezier_points,pts):q.co=co;q.handle_left_type='AUTO';q.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.parent=p;o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
 return o
def dress(n,rings,m):
 verts=[];faces=[];N=80
 for z,rx,ry,amp in rings:
  for i in range(N):
   a=2*pi*i/N;fl=1+amp*cos(a*16);verts.append((rx*cos(a)*fl,ry*sin(a)*fl,z))
 for j in range(len(rings)-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
 faces += [tuple(range(N-1,-1,-1)),tuple((len(rings)-1)*N+i for i in range(N))]
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,n,m)
# Full length adult proportions and a fluted fabric silhouette.
dress('OutfitSkirt',[(.14,.29,.205,.035),(.19,.285,.20,.045),(.4,.255,.18,.04),(.68,.205,.15,.03),(.91,.15,.116,.015),(1.04,.115,.087,0)],sage)
dress('OutfitUnderskirt',[(.105,.275,.196,.04),(.14,.291,.207,.035),(.18,.28,.20,.03)],ivory)
dress('OutfitBodice',[(1.0,.119,.09,0),(1.09,.115,.088,0),(1.23,.16,.11,0),(1.34,.175,.09,0),(1.39,.105,.065,0),(1.435,.054,.049,0)],ivory)
dress('OutfitBelt',[(1.01,.122,.094,0),(1.045,.122,.094,0)],gold)
uv('Neck',(0,0,1.44),(.052,.047,.1),skin,head)
face=uv('Face',(0,-.008,1.594),(.094,.078,.132),skin,head)
# taper cheeks to a soft chin, preserve forehead width
for v in face.data.vertices:
 t=v.co.z/.132
 if t<-.12:v.co.x*=1-.28*((-t-.12)/.88)
face.shape_key_add(name='Basis');key=face.shape_key_add(name='FaceWidth')
for v in key.data:v.co.x*=1.22
for side,label in [(-1,'L'),(1,'R')]:
 x=.039*side;g=group('Eye'+label,head);g.location=(x,-.073,1.615)
 uv('EyeWhite'+label,(0,0,0),(.027,.012,.0115),white,g)
 uv('Iris'+label,(0,-.011,.0005),(.008,.0025,.0085),iris,g)
 uv('Pupil'+label,(0,-.0135,.0005),(.0038,.001,.0055),black,g)
 uv('EyeGlint'+label,(-.002,-.0145,.003),(.0015,.0006,.0018),white,g)
 tube('UpperLid'+label,[(-.027,-.001,0),(-.014,-.010,.009),(0,-.013,.011),(.016,-.009,.007),(.027,0,0)],.0016,hair,g)
 tube('LowerLid'+label,[(-.027,0,0),(0,-.012,-.011),(.027,0,0)],.001,skin,g)
 b=group('Brow'+label,head);b.location=(x,-.073,1.645)
 tube('BrowShape'+label,[(-.025,.003,0),(-.009,-.003,.005),(.009,-.002,.004),(.025,.004,-.001)],.0027,hair,b)
 uv('Ear'+label,(side*.091,.002,1.588),(.014,.016,.027),skin,head)
 uv('Earring'+label,(side*.097,-.002,1.556),(.006,.006,.014),gold,head)
 arm=group('Arm'+label,root)
 uv('OutfitShoulder'+label,(side*.16,.002,1.335),(.058,.056,.058),ivory,arm)
 tube('Wrist'+label,[(side*.258,-.008,1.01),(side*.268,-.012,.965)],.018,skin,arm)
 o=uv('OutfitSleeve'+label,(side*.198,.002,1.245),(.052,.054,.16),ivory,arm);o.rotation_euler[1]=-side*.22
 o=uv('Forearm'+label,(side*.25,-.005,1.078),(.031,.034,.13),skin,arm);o.rotation_euler[1]=-side*.15
 uv('Hand'+label,(side*.268,-.012,.965),(.029,.019,.045),skin,arm)
 uv('OutfitCuff'+label,(side*.24,-.003,1.138),(.044,.044,.025),ivory,arm)
 leg=group('Leg'+label,root)
 uv('Boot'+label,(side*.092,-.025,.071),(.057,.105,.068),boot,leg)
# facial features (front is -Y in Blender / +Z in GLTF)
n=group('Nose',head);n.location=(0,-.078,1.585)
uv('NoseBridge',(0,0,.009),(.009,.011,.028),skin,n);uv('NoseTip',(0,-.01,-.007),(.012,.014,.009),skin,n)
m=group('Mouth',head);m.location=(0,-.077,1.55)
tube('UpperLip',[(-.019,0,0),(-.007,-.004,.003),(0,-.005,.001),(.007,-.004,.003),(.019,0,0)],.0028,lip,m)
tube('LowerLip',[(-.018,0,0),(0,-.004,-.004),(.018,0,0)],.0035,lip,m)
# Back hair mass, layered curved locks and swept forehead fringe
uv('HairBack',(0,.048,1.461),(.103,.071,.242),hair,head)
# fitted cap only above brow line; avoids covering facial features
verts=[];faces=[];N=48;K=14
for j in range(K+1):
 t=j/K
 for i in range(N):
  a=2*pi*i/N
  # forehead edge z 1.67, lower at rear
  maxphi=1.20 if sin(a)<0 else 1.95
  ph=t*maxphi
  verts.append((.099*sin(ph)*cos(a),.006+.084*sin(ph)*sin(a),1.60+.137*cos(ph)))
for j in range(K):
 for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
me=bpy.data.meshes.new('HairCap');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('HairCap',me);bpy.context.collection.objects.link(o);finish(o,'HairCap',hair,head)
for side in [-1,1]:
 for j in range(5):
  xx=side*(.073+j*.006)
  tube('HairLock',[(side*.022,-.043,1.729),(xx,-.055,1.675),(side*.10,-.022,1.57),(side*(.095+j*.004),.005,1.42),(side*(.08+j*.007),-.012,1.29)],.007,hair,head)
# decorative leaves, flowers and skirt piping
for side in [-1,1]:
 tube('SkirtGoldSeam',[(side*.08,-.075,1.02),(side*.14,-.12,.78),(side*.22,-.15,.4),(side*.25,-.155,.16)],.0025,gold)
 for i in range(7):
  z=.3+i*.095;x=side*(.235-(z-.3)*.19);y=-.16+(z-.3)*.085
  for k in range(5):
   a=k*2*pi/5;uv('EmbroideryPetal',(x+.006*cos(a),y-.004,z+.006*sin(a)),(.004,.0018,.005),ivory)
  uv('FlowerCenter',(x,y-.006,z),(.0025,.002,.0025),gold)
for i in range(5):
 a=i*2*pi/5;uv('HairFlowerPetal',(-.099+.009*cos(a),-.025,1.665+.009*sin(a)),(.008,.004,.009),ivory,head)
uv('HairFlowerGold',(-.099,-.031,1.665),(.005,.003,.005),gold,head)
# Merge static decorations to reduce draw calls, keep adjustable nodes independent.
for prefix in ['EmbroideryPetal','FlowerCenter','HairLock','HairFlowerPetal','SkirtGoldSeam']:
 bpy.ops.object.select_all(action='DESELECT')
 batch=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(prefix)]
 if len(batch)>1:
  for o in batch:o.select_set(True)
  bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();batch[0].name=prefix
# Export clean, only character objects, with applied units.
for o in bpy.context.scene.objects:o.select_set(True)
bpy.context.view_layer.objects.active=face
os.makedirs(os.path.join(ROOT,'web/assets/models'),exist_ok=True);os.makedirs(os.path.join(ROOT,'art/source'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art/source/character-prototype.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'web/assets/models/keeper.glb'),export_format='GLB',use_selection=True,export_yup=True,export_morph=True)
# Optional preview render, independent from export.
if os.environ.get('CHARACTER_PREVIEW') != '1':
 import sys
 sys.exit(0)
bpy.ops.object.camera_add(location=(2.4,-4.8,2.1));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.05;bpy.context.scene.camera=cam
for loc,power,size in [((2,-3,4),450,4),((-3,-1,2),220,3),((0,3,3),400,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
s=bpy.context.scene;s.render.engine='BLENDER_EEVEE_NEXT';s.render.resolution_x=640;s.render.resolution_y=800;s.render.resolution_percentage=100;s.world.color=(.18,.18,.18);s.render.image_settings.file_format='PNG';s.render.filepath=os.path.join(ROOT,'art/source/character-preview.png');bpy.ops.render.render(write_still=True)
