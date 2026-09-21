"""Blender 5.x: georeferenced, handcrafted low-poly Beijing park diorama.
Rebuild: blender -b --python art/build_park.py
Coordinates: local metres / 10, east=X, north=Y, up=Z. glTF exports Y-up.
OSM footprint data © OpenStreetMap contributors, ODbL. Landmarks are artistic approximations.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
random.seed(21)
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'art/source'
scene_data=json.loads((DATA/'scenery.json').read_text())['elements']
osm=json.loads((DATA/'osm.json').read_text())['elements']
LON,LAT=116.6775,39.8554
SCALE=10

def xy(lon,lat):return ((lon-LON)*111320*math.cos(math.radians(LAT))/SCALE,(lat-LAT)*111320/SCALE)
def geo(lon,lat,z=0):return (*xy(lon,lat),z)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in bpy.data.materials:bpy.data.materials.remove(m)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.color=(.75,.78,.71)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.78,.85,.8,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55

def mat(name,hexcode,rough=1,metal=0):
 c=tuple(int(hexcode[i:i+2],16)/255 for i in (0,2,4))
 c=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c)
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if p is None:
  p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs[0],out.inputs['Surface'])
 p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
M={n:mat(n,c) for n,c in {
'grass':'92AC78','grass_light':'A9BC8B','edge':'CEBC96','earth':'A8916C','road':'E9DDC0','curb':'CDBD9D',
'water':'5AAFB4','water_light':'84C8CD','bark':'756652','leaf':'56794C','leaf_light':'7B9859','leaf_dark':'3D6350',
'stone':'D1BE9C','stone_light':'E2D2B3','roof':'586779','roof_light':'72879A','window':'385668','gold':'DEB355',
'industrial':'677C80','industrial_light':'9EAFAC','purple':'645887','purple_light':'8A79A5','rust':'B1744E',
'red':'B56951','red_roof':'885141','cream':'E7D7AD','yellow':'E7BF51','blue':'78A6B8','coral':'CD8F78',
'mountain':'819481','mountain_light':'9DAC98','white':'F4EEDB','dark':'425A51'}.items()}
current=None

def collection(name):
 global current
 c=bpy.data.collections.new(name);scene.collection.children.link(c);current=c
 return c

def finish(obj,name,material):
 obj.name=name
 if material:obj.data.materials.append(M[material] if isinstance(material,str) else material)
 for c in list(obj.users_collection):c.objects.unlink(obj)
 current.objects.link(obj)
 return obj

def cube(name,loc,scale,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 finish(o,name,material)
 if bevel:
  mod=o.modifiers.new('Small crafted edges','BEVEL');mod.width=bevel;mod.segments=1
  bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def cone(name,loc,radius,depth,material,vertices=8,r2=0):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=r2,depth=depth,location=loc)
 return finish(bpy.context.object,name,material)

def ico(name,loc,scale,material,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=finish(bpy.context.object,name,material);o.scale=scale;return o

def prism(name,pts,z,height,material):
 if pts[0]==pts[-1]:pts=pts[:-1]
 if len(pts)<3:return None
 n=len(pts);verts=[(x,y,z) for x,y in pts]+[(x,y,z+height) for x,y in pts]
 # tessellate concave OSM footprints explicitly, avoid invalid ngons in glTF.
 vectors=[Vector((x,y,0)) for x,y in pts];index={tuple(v):i for i,v in enumerate(vectors)}
 triangles=tessellate_polygon([vectors]);faces=[]
 for t in triangles:
  ids=[v if isinstance(v,int) else index[tuple(v)] for v in t];faces.extend([tuple(reversed(ids)),tuple(i+n for i in ids)])
 for i in range(n):j=(i+1)%n;faces.append((i,j,j+n,i+n))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);current.objects.link(obj);obj.data.materials.append(M[material]);return obj

def path(name,points,radius,material):
 if len(points)<2:return
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=1;cu.bevel_depth=radius;cu.bevel_resolution=0;cu.resolution_u=1
 sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 obj=bpy.data.objects.new(name,cu);current.objects.link(obj);cu.materials.append(M[material]);return obj

def beam(name,a,b,r,material):
 mid=(Vector(a)+Vector(b))/2;o=cone(name,mid,r,(Vector(a)-Vector(b)).length,material,6,r)
 o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler();return o

def roof(name,x,y,z,w,d,h,material):
 # Gabled roof with deliberately sharp triangular silhouette.
 verts=[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x-w/2,y+d/2,z),(x+w/2,y+d/2,z),(x,y-d/2,z+h),(x,y+d/2,z+h)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(0,1,4),(2,5,3),(0,4,5,2),(1,3,5,4)]);me.update();ob=bpy.data.objects.new(name,me);current.objects.link(ob);me.materials.append(M[material]);return ob

def inside(p,poly):
 x,y=p;v=False
 for i in range(len(poly)):
  a,b=poly[i-1],poly[i]
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:v=not v
 return v

collection('01 · Park island and paths')
boundary=next(x for x in osm if x.get('tags',{}).get('tourism')=='theme_park')
outline=[xy(p['lon'],p['lat']) for p in boundary['geometry']]
prism('Layered earth plinth',outline,-3.1,2.4,'earth');prism('Sandstone edge',outline,-.7,.62,'edge');prism('Park lawn',outline,-.08,.08,'grass')
water_polys=[];building_polys=[];road_points=[]
for x in scene_data:
 t=x.get('tags',{});g=x.get('geometry',[])
 if len(g)<3:continue
 pts=[xy(p['lon'],p['lat']) for p in g if 'lon' in p]
 if t.get('natural')=='water' or t.get('water'):
  if inside(pts[0],outline):prism('Water '+str(x['id']),pts,.03,.05,'water');water_polys.append(pts)
for x in osm:
 if 'highway' not in x.get('tags',{}) or not x.get('geometry'):continue
 points=[(*xy(p['lon'],p['lat']),.06) for p in x['geometry']]
 # Keep roads on the diorama, no floating surroundings.
 run=[]
 for p in points:
  if inside(p[:2],outline):run.append(p);road_points.append(p[:2])
  else:
   if len(run)>1:path('Walkway '+str(x['id']),run,.24,'road')
   run=[]
 if len(run)>1:path('Walkway '+str(x['id']),run,.24,'road')

# Author landmark sites using footprint locations; no claimed survey-accurate facades or heights.
LANDMARKS=[(116.6809,39.85585,7.8),(116.6740,39.85665,10),(116.6774,39.8560,5.5),(116.67965,39.8576,6.5),(116.6777,39.85745,7),(116.67845,39.8533,6)]
def landmark_near(p):return any(math.dist(p,xy(lon,lat))<r for lon,lat,r in LANDMARKS)
collection('02 · OSM building massing')
for x in scene_data:
 t=x.get('tags',{});g=x.get('geometry',[])
 if not t.get('building') or len(g)<3:continue
 pts=[xy(p['lon'],p['lat']) for p in g if 'lon' in p];center=tuple(sum(p[i] for p in pts)/len(pts) for i in (0,1))
 if not inside(center,outline):continue
 building_polys.append(pts)
 if landmark_near(center):continue
 h=random.uniform(.75,1.65)
 color='cream' if center[1]<-13 else 'stone' if center[0]>18 else 'industrial_light' if center[0]<-12 else 'stone_light'
 prism('OSM '+str(x['id'])+' '+t.get('name','building'),pts,.12,h,color)
 prism('Roof '+str(x['id']),pts,.12+h,.17,'roof_light' if center[0]>16 else 'coral' if center[1]<-12 else 'industrial')

collection('03 · Hogwarts castle')
x,y=xy(116.6809,39.85585)
for dx,dy,s in [(-3,0,3),(1,1,4),(3,-2,3),(-2,3,3)]:ico('Faceted castle rock',(x+dx,y+dy,1),(s,s*.8,2.3),'mountain',1)
cube('Great Hall',(x,y,3.5),(5.5,6,3.1),'stone',.13);roof('Great Hall steep slate',x,y,5.05,6,6.6,2.2,'roof')
cube('Clock wing',(x-3,y+1.5,3.1),(2.3,4,2.6),'stone_light',.1);roof('Clock wing roof',x-3,y+1.5,4.4,2.7,4.4,1.6,'roof_light')
for i,(dx,dy,r,h) in enumerate([(-3,-2,1.05,6.5),(2.6,1.8,1.2,9),(-2,3.2,.75,7),(3,-1.8,.7,5.4),(0,-2.6,.55,6.3)]):
 cone('Castle tower '+str(i),(x+dx,y+dy,1.4+h/2),r,h,'stone_light',10,r*.9)
 cone('Tower collar '+str(i),(x+dx,y+dy,h+1.25),r*1.08,.35,'stone',10,r*1.08)
 cone('Slate spire '+str(i),(x+dx,y+dy,h+2.8),r*1.3,3.1,'roof',10)
 cone('Gold finial '+str(i),(x+dx,y+dy,h+4.55),.1,.5,'gold',6)
 for z in [3,4.6,6]:
  if z<h:cube('Tower narrow window',(x+dx,y+dy-r-.01,z),(.18,.03,.62),'window')
for dx in [-1.8,-.6,.6,1.8]:cube('Great Hall lancet',(x+dx,y-3.03,3.8),(.35,.06,1.45),'window')
# Hogsmeade street: clustered steep roofs and chimney stacks.
for i in range(7):
 hx=x-5.7+(i%3)*2;hy=y-7.5-(i//3)*1.8
 cube('Hogsmeade cottage',(hx,hy,1),(1.65,1.45,1.9),'stone_light',.04);roof('Hogsmeade gable',hx,hy,2,1.9,1.7,1.2,'roof')
 cube('Snow accent',(hx+.4,hy,2.7),(.3,1.6,.12),'white');cube('Village chimney',(hx-.5,hy+.3,2.8),(.25,.3,1.1),'stone')

collection('04 · Decepticoaster and Cybertron')
x,y=xy(116.6740,39.85665)
# Sculptural coaster loop / hill; alignment fits its OSM footprint, elevations artistic.
track=[]
for i in range(121):
 t=i/120*math.tau
 px=x+8.3*math.cos(t);py=y+4.1*math.sin(t)
 z=1.25+5.3*((math.cos(t-.45)+1)/2)**4+1.6*math.sin(2*t)**2
 track.append((px,py,z))
path('Purple coaster spine',track,.2,'purple')
for offset in [-.27,.27]:path('Coaster running rail',[(a,b+offset,c+.18) for a,b,c in track],.055,'purple_light')
for i in range(0,120,7):
 a,b,c=track[i];beam('Coaster steel upright',(a,b,.12),(a,b,c-.2),.12,'industrial_light')
 if i%14==0:beam('Coaster diagonal support',(a+.9,b,.1),(a,b,c-.3),.09,'industrial_light')
loop=[]
for i in range(49):
 t=i/48*math.tau;loop.append((x+2.7*math.sin(t),y-1.2,3.15+2.7*math.cos(t)))
path('Signature vertical inversion',loop,.17,'purple')
cube('Launch station',(x-3,y-3.5,1.15),(5,1.7,2.2),'industrial');cube('Station roof',(x-3,y-3.5,2.35),(5.5,2.1,.25),'purple')
# Fire-source sci-fi hangar north east of coaster.
bx,by=xy(116.6749,39.85725)
cube('Cybertron hangar',(bx,by,1.65),(6,4,3.2),'industrial',.3)
for dx in [-2,0,2]:cube('Hangar rib',(bx+dx,by-2.2,2),(.42,.6,3.8),'industrial_light')
cone('Energy beacon',(bx,by,4.1),.65,2.2,'blue',6);cone('Beacon cap',(bx,by,5.5),.7,.6,'gold',6)

collection('05 · Jurassic island')
x,y=xy(116.6769,39.8559)
for dx,dy,s,h in [(-1.8,0,3,4.5),(1.4,1.2,3.5,5.6),(2.8,-1,2,3.2),(-2,-2,2.2,3)]:
 ico('Nublar limestone peak',(x+dx,y+dy,h*.4),(s,s*.75,h*.6),'mountain' if dx<0 else 'mountain_light',1)
# Faceted blue visitor-centre dome and terraces.
x,y=xy(116.6778,39.8553)
cone('Discovery dome',(x,y,1.5),2.4,2.4,'blue',12,.2)
cone('Dome base',(x,y,.3),2.7,.5,'stone_light',12,2.7)
for i in range(12):
 t=i*math.tau/12;beam('Dome structural rib',(x+2.4*math.cos(t),y+2.4*math.sin(t),.4),(x,y,2.7),.065,'cream')
for dx in [-2,2]:cube('Jurassic gate pillar',(x+dx,y-4,1.6),(.6,.65,3.1),'stone',.08)
cube('Jurassic gate lintel',(x,y-4,2.85),(4.6,.75,.6),'dark',.08)
# Iconic dinosaur silhouette, invented sculpture as a park-map cue.
bx,by=x-2.6,y-1.5
ico('Dinosaur body',(bx,by,1.2),(1.1,.42,.5),'dark',1)
beam('Dinosaur neck',(bx+.6,by,1.4),(bx+1.1,by,2.2),.18,'dark');ico('Dinosaur head',(bx+1.25,by,2.25),(.45,.22,.2),'dark',1)
for dx in [-.5,.4]:beam('Dinosaur leg',(bx+dx,by,.15),(bx+dx,by,1.1),.13,'dark')
beam('Dinosaur tail',(bx-.8,by,1.2),(bx-2,by,1.6),.1,'dark')

collection('06 · WaterWorld amphitheatre')
x,y=xy(116.67965,39.85765)
cone('Lagoon basin',(x,y,.08),4.7,.18,'water',24,4.7)
for tier in range(4):
 r=5+tier*.6
 # back half of stadium terraces; open south to read the lagoon.
 pts=[(x+r*math.cos(i*math.pi/20),y+r*math.sin(i*math.pi/20),.55+tier*.45) for i in range(21)]
 path('Stadium seating tier',pts,.35,'stone_light' if tier%2 else 'cream')
for dx,dy,h in [(-3,0,3.8),(2.6,1,4.8),(1,-2.5,2.8)]:
 for sx in [-.4,.4]:beam('Rusty stunt tower',(x+dx+sx,y+dy,.1),(x+dx+sx,y+dy,h),.1,'rust')
 cube('Tower platform',(x+dx,y+dy,h), (1.4,1.2,.18),'industrial')
 beam('Tower cross brace',(x+dx-.4,y+dy,1),(x+dx+.4,y+dy,h-.3),.065,'rust')
cube('Floating pontoon',(x,y-.5,.35),(3,.8,.3),'rust');beam('Stunt gantry',(x-3,y,3.6),(x+2.6,y+1,4.6),.09,'rust')

# Seaplane and crane silhouette drawn from the official WaterWorld arena reference.
beam('Crane mast',(x-3.8,y+1.8,.2),(x-3.8,y+1.8,5.2),.13,'rust')
beam('Crane boom',(x-3.8,y+1.8,5.2),(x-1,y+.6,6.2),.1,'rust')
beam('Crane cable',(x-1,y+.6,6.2),(x-1,y+.6,3.8),.025,'dark')
# Deliberately toy-like scale; the model is a visual cue, not a surveyed obstacle.
px,py=x+1,y-1.2
ico('Stunt seaplane fuselage',(px,py,1.1),(1.2,.25,.25),'white',1)
cube('Seaplane broad wing',(px,py,1.15),(.48,2.2,.1),'industrial_light',.04)
cube('Seaplane tail wing',(px-.9,py,1.15),(.28,.85,.09),'industrial')
cube('Seaplane rudder',(px-.9,py,1.4),(.28,.08,.55),'rust')
for dy in [-.5,.5]:cube('Seaplane float',(px,py+dy,.55),(1.1,.15,.15),'industrial')

collection('07 · Panda valley')
x,y=xy(116.67765,39.8575)
# Stylised Chinese roof tiers (the actual attraction is primarily indoors).
for i,(w,d,h) in enumerate([(5.2,4.3,1.7),(3.5,3,1.6),(2.1,1.9,1.2)]):
 z=i*1.8
 cube('Panda pavilion tier',(x,y,z+h/2+.15),(w*.78,d*.78,h),'red',.08)
 cone('Pagoda sweeping roof',(x,y,z+h+.45),w*.79,.9,'red_roof',4,w*.13).rotation_euler[2]=math.pi/4
 cone('Golden roof trim',(x,y,z+h+.04),w*.79,.12,'gold',4,w*.72).rotation_euler[2]=math.pi/4
for dx in [-2,2]:
 for dy in [-1.6,1.6]:cone('Red temple column',(x+dx,y+dy,1.25),.15,2.4,'red',8,.15)
cone('Pagoda finial',(x,y,6.4),.12,.8,'gold',6)
for i in range(9):
 a=i*math.tau/9;tx=x+4.2*math.cos(a);ty=y+3.5*math.sin(a)
 beam('Lantern pole',(tx,ty,0),(tx,ty,1.8),.045,'dark');ico('Warm lantern',(tx,ty,1.7),(.24,.24,.3),'gold',1)

collection('08 · Minion neighbourhood')
x,y=xy(116.67835,39.8533)
for i,(dx,dy,w,h,c) in enumerate([(-2,-1,2.2,2.6,'coral'),(.1,0,2,3.5,'blue'),(2.2,.5,2,2.6,'yellow'),(-1.8,2,2.5,2.1,'cream'),(1,2.6,2.3,2.7,'coral')]):
 cube('Minion town house',(x+dx,y+dy,h/2), (w,1.7,h),c,.12);roof('Playful gable',x+dx,y+dy,h,w+0.25,2,1,'roof' if i%2 else 'red_roof')
 for wx in [-.5,.5]:cube('Town window',(x+dx+wx,y+dy-.87,h*.65),(.35,.05,.6),'white')
# Super Silly land canopy.
cone('Silly carousel canopy',(x+3,y-3,2),2,1.5,'yellow',10,.15);cone('Carousel base',(x+3,y-3,.3),2,.4,'blue',10,2)
for i in range(8):
 a=i*math.tau/8;beam('Carousel pole',(x+3+1.3*math.cos(a),y-3+1.3*math.sin(a),.3),(x+3+1.3*math.cos(a),y-3+1.3*math.sin(a),1.7),.04,'white')
# Toy-like yellow mascot cue, no downloaded character meshes.
cone('Minion body',(x-3.5,y-3,1),.55,1.2,'yellow',10,.55);ico('Round yellow cap',(x-3.5,y-3,1.6),(.55,.55,.5),'yellow',1)
cube('Blue overalls',(x-3.5,y-3,.6),(1.05,.9,.65),'blue',.12);cube('Silver goggles',(x-3.5,y-3.55,1.45),(.75,.18,.38),'industrial_light',.08)

collection('09 · Hollywood and arrival')
x,y=xy(116.6751,39.8532)
for i in range(5):
 hx=x+(i-2)*2.2;h=2.1+(i%2)*.7
 cube('Art deco frontage',(hx,y,h/2),(1.95,2.1,h),'cream' if i%2 else 'coral',.08)
 cube('Art deco parapet',(hx,y,h+.15),(1.3,2.1,.3),'stone_light')
 for dx in [-.5,0,.5]:cube('Facade pilaster',(hx+dx,y-1.12,h*.5),(.12,.12,h*.82),'white')
# Globe is an invented orientation landmark near the arrival axis, not a surveyed entrance pin.
x,y=xy(116.6746,39.85255)
cone('Arrival fountain',(x,y,.25),1.7,.5,'stone_light',20,1.7);ico('Universal globe',(x,y,1.7),(1.15,1.15,1.15),'blue',2)
for angle in [0,math.pi/3,2*math.pi/3]:
 pts=[]
 for i in range(33):
  t=i*math.tau/32;pts.append((x+1.18*math.sin(t)*math.cos(angle),y+1.18*math.sin(t)*math.sin(angle),1.7+1.18*math.cos(t)))
 path('Globe meridian',pts,.035,'gold')

collection('10 · Faceted gardens')
# Rejection-sampled trees leave real roads, water and footprints readable.
minx,maxx=min(x for x,y in outline),max(x for x,y in outline);miny,maxy=min(y for x,y in outline),max(y for x,y in outline)
count=0
for _ in range(2800):
 if count>=310:break
 x=random.uniform(minx,maxx);y=random.uniform(miny,maxy)
 if not inside((x,y),outline) or landmark_near((x,y)):continue
 if any(inside((x,y),p) for p in building_polys+water_polys):continue
 if road_points and min((x-a)**2+(y-b)**2 for a,b in road_points)<.85**2:continue
 h=random.uniform(1.1,2.2);c=random.choice(['leaf','leaf_light','leaf_dark'])
 cone('Tree trunk',(x,y,h*.27),.095,h*.55,'bark',5,.07)
 if count%3==0:
  cone('Pine lower',(x,y,h*.55),h*.45,h,c,6);cone('Pine crown',(x,y,h*.88),h*.3,h*.8,c,6)
 else:ico('Faceted tree crown',(x,y,h*.72),(h*.48,h*.43,h*.61),c,1)
 count+=1

collection('11 · Lighting and presentation')
bpy.ops.object.light_add(type='AREA',location=(-45,-65,95));light=bpy.context.object;light.name='Large warm softbox';light.data.energy=115000;light.data.shape='DISK';light.data.size=60;light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(92,-125,140));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=126;scene.camera=camera
scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
# Save editable source before combining meshes for the browser.
(ROOT/'public/models').mkdir(parents=True,exist_ok=True)
scene['design_note']='Low-poly artistic interpretation, georeferenced OSM footprints; landmark heights and detailed facades are illustrative, not surveyed.'
scene['origin_lon']=LON;scene['origin_lat']=LAT;scene['metres_per_unit']=10
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/universal-beijing.blend'))
# Convert curves and combine by material to keep browser draw calls low.
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
 if obj.type in {'MESH','CURVE'}:obj.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in scene.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
materials={}
for o in list(scene.objects):
 if o.type=='MESH' and o.data.materials:materials.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in materials.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name='Park · '+name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/beijing-park.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_apply=True)
scene.render.filepath=str(ROOT/'art/park-preview.png');bpy.ops.render.render(write_still=True)
print('PARK_BUILD_COMPLETE',count,'trees',len(materials),'material batches')
