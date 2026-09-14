"""Remesh browser skins by anatomical motion region; preserve the game skeleton.

Each limb has its own remesh and weight-transfer surface. Spatially touching
arms, thighs, toes and wings must never fuse or share animation weights.
Run: Blender --background --python join_skin.py -- INPUT OUTPUT [species...].
"""
import bpy, bmesh, gzip, json, sys, struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

args = sys.argv[sys.argv.index('--')+1:]
source, destination = Path(args[0]), Path(args[1])
destination.mkdir(parents=True, exist_ok=True)
keys = args[2:] or [p.stem for p in source.glob('*.bin')]

for key in keys:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    raw = (source / (key+'.bin')).read_bytes()
    rig = json.loads((source/(key+'.json')).read_text())['rig']
    values = struct.unpack('<'+'f'*(len(raw)//4), raw)
    rows = [values[i:i+17] for i in range(0, len(values), 17)]
    owners = {}
    for index, leg in enumerate(rig['legs']):
        for bone in ('upper','lower','toe'):owners[leg[bone]] = 'leg'+str(index)
    for index, arm in enumerate(rig['arms']):owners[arm['id']] = 'arm'+str(index)
    for index, wing in enumerate(rig['wings']):owners[wing['id']] = 'wing'+str(index)
    for index, grip in enumerate(rig.get('grips', [])):
        for idx in [grip['id']] + [digit['id'] for digit in grip['digits']]:owners[idx] = 'grip'+str(index)
    regions, retained = {}, []
    for i in range(0,len(rows),3):
        tri = rows[i:i+3]
        if not all(abs(v[13]-1)<.01 and int(v[14])!=2 for v in tri):
            retained.extend(tri)
            continue
        # Authored triangles belong to one chain even across a knee/ankle.
        # Bone 0 is the fixed torso influence at an anatomical attachment.
        groups = {owners[int(v[b])] for v in tri for b,w in ((12,1-v[16]),(15,v[16])) if w>1e-6 and int(v[b]) in owners}
        if len(groups)>1:raise ValueError(key+': source triangle crosses independent limbs')
        region = next(iter(groups)) if groups else 'body'
        regions.setdefault(region,[]).extend(tri)
    areas = {}
    for name, skin in regions.items():
        areas[name] = sum((Vector(skin[i+1][:3])-Vector(skin[i][:3])).cross(Vector(skin[i+2][:3])-Vector(skin[i][:3])).length*.5 for i in range(0,len(skin),3))
    total_area = sum(areas.values())
    output, triangle_count, region_report = list(retained), 0, []
    for name, skin in regions.items():
        original_positions = [Vector(v[:3]) for v in skin]
        faces = [(i,i+1,i+2) for i in range(0,len(skin),3)]
        tree = BVHTree.FromPolygons(original_positions, faces, all_triangles=True)
        mesh = bpy.data.meshes.new(key+'_'+name)
        mesh.from_pydata(original_positions, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(key+'_'+name,mesh)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh);bm.free()
        mesh.remesh_voxel_size = .010 if key in ('blue','brachiosaurus','pteranodon') else .012 if key == 'trex' else .021 if key in ('drex','triceratops','apatosaurus') else .018
        mesh.use_remesh_preserve_volume = True
        bpy.ops.object.voxel_remesh()
        smooth=obj.modifiers.new('Smooth anatomical region','SMOOTH')
        smooth.factor=.60 if key in ('blue','brachiosaurus','pteranodon') else .65 if key == 'trex' else .80
        smooth.iterations=3 if key in ('blue','brachiosaurus','pteranodon') else 4 if key == 'trex' else 9
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        budget=max(350,round((20500 if key in ('blue','brachiosaurus','pteranodon') else 19500 if key == 'trex' else 12500)*areas[name]/total_area))
        dec=obj.modifiers.new('Browser triangle budget','DECIMATE')
        dec.ratio=min(1,budget/max(1,len(obj.data.polygons)*2))
        bpy.ops.object.modifier_apply(modifier=dec.name)
        triangulate=obj.modifiers.new('Export triangles','TRIANGULATE')
        bpy.ops.object.modifier_apply(modifier=triangulate.name)
        mesh=obj.data
        for p in mesh.polygons:p.use_smooth=True
        mesh.update()
        attributes=[]
        for v in mesh.vertices:
            point,_,face,_=tree.find_nearest(v.co)
            sr=skin[face*3:face*3+3]
            a,b,c=(Vector(p[:3]) for p in sr)
            weights=barycentric_transform(point,a,b,c,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
            weights=[max(0,min(1,x)) for x in weights];total=sum(weights) or 1
            weights=[x/total for x in weights]
            bones={}
            for row,w in zip(sr,weights):
                for idx,amount in ((int(row[12]),1-row[16]),(int(row[15]),row[16])):
                    if amount*w>1e-8:bones[idx]=bones.get(idx,0)+amount*w
            # Preserve attachment to the pelvis/scapula, within this limb only.
            for leg in rig['legs']:
                idx=leg['upper']
                if idx in bones:
                    amount=max(0,min(1,(leg['base'][1]-v.co.y)/.38))
                    fixed=bones[idx]*(1-amount);bones[idx]*=amount;bones[0]=bones.get(0,0)+fixed
            for arm in rig['arms']:
                if arm['id'] in bones:
                    amount=max(0,min(1,(arm['pivot'][1]-v.co.y)/.24))
                    fixed=bones[arm['id']]*(1-amount);bones[arm['id']]*=amount;bones[0]=bones.get(0,0)+fixed
            belly=max(0,min(.60,(-v.normal.y-.15)*.72))
            attributes.append({'bones':bones,'color':[1-belly,belly,0]})
        adjacency=[set() for _ in mesh.vertices]
        for edge in mesh.edges:
            a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
        # Diffusion cannot cross regions: an adjacent thigh is not an arm joint.
        for iteration in range(5):
            previous=[v['bones'].copy() for v in attributes]
            for i,neighbours in enumerate(adjacency):
                if not neighbours:continue
                blend={k:v*.65 for k,v in previous[i].items()}
                for j in neighbours:
                    for k,v in previous[j].items():blend[k]=blend.get(k,0)+v*.35/len(neighbours)
                attributes[i]['bones']=blend
        for poly in mesh.polygons:
            if poly.area<1e-12:continue
            center=sum((mesh.vertices[i].co for i in poly.vertices),Vector())/3
            _,_,face,_=tree.find_nearest(center)
            part=int(skin[face*3][14])
            for index in poly.vertices:
                v=mesh.vertices[index];data=attributes[index]
                bs=sorted(data['bones'].items(),key=lambda x:x[1],reverse=True)[:2]
                if len(bs)<2:bs.append((0,0))
                total=bs[0][1]+bs[1][1] or 1
                normal=v.normal.normalized() if v.normal.length>.1 else poly.normal.normalized()
                if normal.length<.1:normal=Vector((0,1,0))
                output.append(tuple(v.co)+tuple(normal)+tuple(v.co)+tuple(data['color'])+(float(bs[0][0]),1.,float(part),float(bs[1][0]),bs[1][1]/total))
            triangle_count+=1
        region_report.append({'name':name,'triangles':len(mesh.polygons)})
    flattened=[f for row in output for f in row]
    target=destination/(key+'.mesh.gz')
    target.write_bytes(gzip.compress(struct.pack('<'+'f'*len(flattened),*flattened),compresslevel=9,mtime=0))
    metadata={'species':key,'source_vertices':len(rows),'vertices':len(output),'skin_triangles':triangle_count,'compressed_bytes':target.stat().st_size,'regions':region_report}
    (destination/(key+'.json')).write_text(json.dumps(metadata,indent=2)+'\n')
    print('SKIN_EXPORT '+json.dumps({k:v for k,v in metadata.items() if k!='regions'}),flush=True)
print('SKIN_EXPORT_COMPLETE',flush=True)
