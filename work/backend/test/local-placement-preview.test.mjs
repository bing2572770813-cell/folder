import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundled=await build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {placeCategorizedPrefab} from './entities/tree-commands.mjs';export {previewPlacement} from './entities/placement-preview.mjs';",resolveDir:fileURLToPath(new URL('../../',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,previewPlacement}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const make=(id,type,tile,BaseEntity)=>({id,size:{width:1,height:1},occupied:[true],static:{entityType:type},tile,BaseEntity});
const paper=make('paper_ai','terrain',{color:'white',height:.09},['void_ai']);
const fire=make('fire_ai','terrain',{color:'red',height:.09,terrain:'fire'},['paper_ai']);
const key=make('key_ai','item',{height:.09,terrain:'key',keyName:'铜'},['paper_ai','fire_ai']);
const fixture=(size=6)=>new TreeDocument({version:1,width:size,height:size,tiles:Array.from({length:size},()=>Array.from({length:size},()=>({color:'white',height:.09,prefabId:'paper_ai'}))),spawn:{r:0,c:0,dir:0},foldCells:[]});
const tagCells=document=>document.world.serialize().filter(node=>node.tags.spawn||node.tags.entry).flatMap(node=>document.world.transforms.worldCells(node.transformId));
function compare(document,prefab,r,c,options={}){
 const before=document.serialize(),settings={...options,tagCells:tagCells(document)},tile={...prefab.tile,prefabId:prefab.id};
 let full,local,fullError,localError;
 try{full=placeCategorizedPrefab(document,prefab,tile,r,c,options);}catch(error){fullError=error.message;}
 try{local=previewPlacement(document,prefab,tile,r,c,settings);}catch(error){localError=error.message;}
 assert.equal(!!localError,!!fullError,`${prefab.id} at ${r},${c}: ${fullError} / ${localError}`);
 if(full){const cells=local.cells;assert.deepEqual([...local.candidate.viewCells(cells)],[...full.viewCells(cells)]);}
 assert.deepEqual(document.serialize(),before);
}
test('local previews match replacements, stacked items, invalid bases, hidden cells and bounds',()=>{
 const doc=fixture();for(const p of [paper,fire,key])for(const cell of [{r:2,c:2},{r:0,c:0},{r:8,c:1}])compare(doc,p,cell.r,cell.c);
 compare(doc,fire,2,2,{nodeHidden:()=>true});compare(doc,key,2,2,{isHidden:()=>true});
 const hot=placeCategorizedPrefab(doc,fire,fire.tile,2,2);compare(hot,key,2,2);compare(hot,fire,2,2);
 const withKey=placeCategorizedPrefab(doc,key,key.tile,2,2);compare(withKey,paper,2,2);
});
test('local previews include child footprints, ancestors, descendant protection and references',()=>{
 const doc=fixture(),child={id:'child-key',size:{width:1,height:1},occupied:[true],static:{entityType:'item'},components:{key:{name:'银'}},BaseEntity:['paper_ai']};
 const tree={...paper,children:[{prefab:child,local:{r:0,c:1,dir:0}}]};
 compare(doc,tree,2,2);compare(doc,tree,2,5);
 const placed=placeCategorizedPrefab(doc,tree,tree.tile,2,2);compare(placed,paper,2,2);
 const transform=doc.world.at(2,2)[0].transformId;doc.world.transforms.retain(transform,'external');compare(doc,paper,2,2);
});
test('global unique tags remain part of local validation',()=>{
 const doc=fixture(),entry={...key,tags:{entry:true}};compare(doc,entry,2,2);
 const record=doc.serialize();record.cellTags['4,4']={regionTag:'B'};
 const base=new TreeDocument(record),withEntry=placeCategorizedPrefab(base,entry,entry.tile,4,4);
 withEntry.cellTags['2,2']={regionTag:'B'};compare(withEntry,entry,2,2);
});
test('preview never clones, serializes or projects the full source document',()=>{
 const doc=fixture(48),tags=tagCells(doc);
 for(const method of ['clone','serialize','view','cellNodes'])doc[method]=()=>{throw new Error('full document access: '+method);};
 doc.world.serialize=()=>{throw new Error('full entity snapshot');};doc.world.snapshotRuntime=()=>{throw new Error('full runtime snapshot');};doc.world.transforms.serialize=()=>{throw new Error('full transform snapshot');};
 const result=previewPlacement(doc,paper,paper.tile,20,20,{tagCells:tags});
 assert.ok(result.candidate.world.serialize().length<=2,'local candidate contains just target and spawn');
});
