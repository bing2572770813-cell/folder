export interface GridTransform {r:number;c:number;dir:number}
export interface Footprint {width:number;height:number;occupied:boolean[]}
export interface TransformNode {id:string;parentId:string|null;local:GridTransform;footprint:Footprint}
export interface TransformChange {type:'transformChanged';ids:string[]}
const copy=<T>(value:T):T=>structuredClone(value);

/** One owner for grid translations, relative headings, references and derived cell lookup. */
export class TransformManager {
  private nodes=new Map<string,TransformNode>();
  private index=new Map<string,string[]>();
  private children=new Map<string,string[]>();
  private order=new Map<string,number>();
  private nextOrder=0;
  private references=new Map<string,Set<string>>();
  private listeners=new Set<(event:TransformChange)=>void>();
  notificationErrors:unknown[]=[];
  constructor(readonly width:number,readonly height:number,nodes:TransformNode[]=[]) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('Invalid map dimensions');
    for(const node of nodes){if(this.nodes.has(node.id))throw new Error('Duplicate transform ID');this.nodes.set(node.id,copy(node));}
    this.index=this.validate(this.nodes);
    for(const node of this.nodes.values()){
      this.order.set(node.id,this.nextOrder++);
      if(node.parentId!==null){const children=this.children.get(node.parentId)??[];children.push(node.id);this.children.set(node.parentId,children);}
    }
  }
  get(id:string):TransformNode {const node=this.nodes.get(id);if(!node)throw new Error('Unknown transform: '+id);return copy(node);}
  clone():TransformManager {
    const result=new TransformManager(this.width,this.height);
    result.nodes=new Map(structuredClone([...this.nodes]));
    result.index=new Map(structuredClone([...this.index]));
    result.children=new Map([...this.children].map(([id,children])=>[id,[...children]]));
    result.order=new Map(this.order);result.nextOrder=this.nextOrder;
    result.references=new Map([...this.references].map(([id,owners])=>[id,new Set(owners)]));
    return result;
  }
  serialize():TransformNode[]{return [...this.nodes.values()].map(copy);}
  childrenOf(id:string):string[]{if(!this.nodes.has(id))throw new Error('Unknown transform: '+id);return [...(this.children.get(id)??[])];}
  world(id:string):GridTransform{return this.resolve(this.nodes,id,new Set());}
  at(r:number,c:number):string[]{return [...(this.index.get(r+','+c)??[])];}
  worldCells(id:string):Array<{r:number;c:number}>{const node=this.nodes.get(id);if(!node)throw new Error('Unknown transform: '+id);return this.cells(node,this.resolve(this.nodes,id,new Set()));}
  onChange(listener:(event:TransformChange)=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  retain(id:string,owner:string):void{if(!this.nodes.has(id))throw new Error('Unknown transform: '+id);if(!owner)throw new Error('Empty reference owner');const refs=this.references.get(id)??new Set();refs.add(owner);this.references.set(id,refs);}
  release(id:string,owner:string):void{this.references.get(id)?.delete(owner);}
  referenceOwners(id:string):string[]{if(!this.nodes.has(id))throw new Error('Unknown transform: '+id);return [...(this.references.get(id)??[])];}
  assertRemovable(id:string,ignoredOwners:string[]=[]):void{
    this.get(id);if(this.childrenOf(id).length)throw new Error('Transform has children');
    const ignored=new Set(ignoredOwners);
    if(this.referenceOwners(id).some(owner=>!ignored.has(owner)))throw new Error('Transform has external references');
  }
  create(node:TransformNode):void{if(this.nodes.has(node.id))throw new Error('Duplicate transform ID');this.commit(node.id,next=>{next.set(node.id,copy(node));});}
  setLocal(id:string,local:GridTransform):void{const node=this.get(id);node.local=copy(local);this.commit(id,next=>{next.set(id,node);});}
  setParent(id:string,parentId:string|null,preserveWorld=false):void{
    const node=this.get(id);const previous=this.world(id);node.parentId=parentId;
    if(preserveWorld){const parent=parentId===null?{r:0,c:0,dir:0}:this.world(parentId);node.local={r:previous.r-parent.r,c:previous.c-parent.c,dir:(previous.dir-parent.dir+8)%8};}
    this.commit(id,next=>{next.set(id,node);});
  }
  remove(id:string):void{
    this.assertRemovable(id);
    this.commit(id,next=>{next.delete(id);});this.references.delete(id);
  }
  private commit(id:string,mutate:(next:Map<string,TransformNode>)=>void):void{
    const next=new Map(this.nodes);mutate(next);
    const affected:string[]=[];
    const visit=(key:string)=>{affected.push(key);for(const child of this.children.get(key)??[])visit(child);};visit(id);
    // Validate the entire moved subtree before touching nodes, indexes or references.
    const newCells=new Map(affected.filter(key=>next.has(key)).map(key=>[key,this.validCells(next,next.get(key)!)]));
    const buckets=new Map<string,string[]>(),selected=new Set(affected);
    const bucket=(key:string)=>{if(!buckets.has(key))buckets.set(key,(this.index.get(key)??[]).filter(owner=>!selected.has(owner)));return buckets.get(key)!;};
    for(const key of affected)if(this.nodes.has(key))for(const cell of this.worldCells(key))bucket(cell.r+','+cell.c);
    for(const [key,cells] of newCells)for(const cell of cells)bucket(cell.r+','+cell.c).push(key);
    const ids=this.listeners.size?[...new Set([...this.nodes.keys(),...next.keys()])]:[];
    const previous=this.nodes.get(id),current=next.get(id);
    if(!previous&&current)this.order.set(id,this.nextOrder++);
    for(const [key,owners] of buckets){owners.sort((a,b)=>this.order.get(a)!-this.order.get(b)!);if(owners.length)this.index.set(key,owners);else this.index.delete(key);}
    if(previous?.parentId!==current?.parentId){
      if(previous?.parentId!==null&&previous?.parentId!==undefined){const children=this.children.get(previous.parentId)!.filter(child=>child!==id);if(children.length)this.children.set(previous.parentId,children);else this.children.delete(previous.parentId);}
      if(current?.parentId!==null&&current?.parentId!==undefined){const children=[...(this.children.get(current.parentId)??[]),id];children.sort((a,b)=>this.order.get(a)!-this.order.get(b)!);this.children.set(current.parentId,children);}
    }
    if(!current){this.order.delete(id);this.children.delete(id);}
    this.nodes=next;
    this.notificationErrors=[];
    for(const listener of [...this.listeners]){if(!this.listeners.has(listener))continue;try{listener({type:'transformChanged',ids:[...ids]});}catch(error){this.notificationErrors.push(error);}}
  }
  private resolve(nodes:Map<string,TransformNode>,id:string,visited:Set<string>):GridTransform{
    if(visited.has(id))throw new Error('Transform cycle');visited.add(id);
    const node=nodes.get(id);if(!node)throw new Error('Unknown parent transform: '+id);
    const parent=node.parentId===null?{r:0,c:0,dir:0}:this.resolve(nodes,node.parentId,visited);
    return {r:parent.r+node.local.r,c:parent.c+node.local.c,dir:(parent.dir+node.local.dir)%8};
  }
  private cells(node:TransformNode,world:GridTransform):Array<{r:number;c:number}>{
    return node.footprint.occupied.flatMap((occupied,i)=>occupied?[{r:world.r+Math.floor(i/node.footprint.width),c:world.c+i%node.footprint.width}]:[]);
  }
  private validate(nodes:Map<string,TransformNode>):Map<string,string[]>{
    const index=new Map<string,string[]>();
    for(const node of nodes.values()){
      for(const cell of this.validCells(nodes,node)){
        const key=cell.r+','+cell.c;const ids=index.get(key)??[];ids.push(node.id);index.set(key,ids);
      }
    }
    return index;
  }
  private validCells(nodes:Map<string,TransformNode>,node:TransformNode):Array<{r:number;c:number}>{
    if(typeof node.id!=='string'||!node.id||node.id.length>100||!(node.parentId===null||typeof node.parentId==='string'))throw new Error('Invalid transform identity');
    const {r,c,dir}=node.local;const f=node.footprint;
    if(!Number.isInteger(r)||!Number.isInteger(c)||!Number.isInteger(dir)||dir<0||dir>7)throw new Error('Invalid local transform');
    if(!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<1||f.height<1||f.width>128||f.height>128||!Array.isArray(f.occupied)||f.occupied.length!==f.width*f.height||f.occupied.some(v=>typeof v!=='boolean')||!f.occupied.some(Boolean))throw new Error('Invalid footprint');
    const cells=this.cells(node,this.resolve(nodes,node.id,new Set()));
    if(cells.some(cell=>cell.r<0||cell.c<0||cell.r>=this.height||cell.c>=this.width))throw new Error('Transform outside map bounds');
    return cells;
  }
}
