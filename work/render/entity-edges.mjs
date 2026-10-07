import {isPaper} from './paper-surface.mjs';
import {tileHeight,tileThickness} from '../entities/tile-model.mjs';

// Paper has a printed front border, never an underside or vertical border.
export function entityEdgeSegments(tile,surface){
  if(surface)return surface.boundarySegments.map(segment=>segment.map(p=>[p[0],p[1]+.004,p[2]]));
  const top=tileHeight(tile),bottom=top-tileThickness(tile);
  const corners=[[-.5,bottom,-.5],[.5,bottom,-.5],[.5,bottom,.5],[-.5,bottom,.5],[-.5,top+.004,-.5],[.5,top+.004,-.5],[.5,top+.004,.5],[-.5,top+.004,.5]];
  const pairs=isPaper(tile)?[[4,5],[5,6],[6,7],[7,4]]:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  return pairs.map(([a,b])=>[corners[a],corners[b]]);
}
