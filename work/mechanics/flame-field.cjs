const CARDINAL=Object.freeze([{r:-1,c:0},{r:1,c:0},{r:0,c:-1},{r:0,c:1}]);
function key(cell){return cell.r+','+cell.c;}
function neighbors(cell,width,height){return CARDINAL.map(delta=>({r:cell.r+delta.r,c:cell.c+delta.c})).filter(cell=>cell.r>=0&&cell.r<height&&cell.c>=0&&cell.c<width);}
function addFlame(existing,cells,width,height){const next=new Set((existing??[]).map(key));for(const cell of cells??[])if(cell.r>=0&&cell.r<height&&cell.c>=0&&cell.c<width)next.add(key(cell));return [...next].map(value=>{const [r,c]=value.split(',').map(Number);return {r,c};}).sort((a,b)=>a.r-b.r||a.c-b.c);}
function spreadFlame(existing,sources,width,height){const frontier=[...(existing??[]),...(sources??[])];return addFlame(existing,frontier.flatMap(cell=>neighbors(cell,width,height)),width,height);}
function contains(cells,cell){return (cells??[]).some(value=>value.r===cell.r&&value.c===cell.c);}
module.exports={CARDINAL,neighbors,addFlame,spreadFlame,contains};
