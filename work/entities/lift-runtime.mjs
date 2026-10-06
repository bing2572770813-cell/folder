export function initialLiftState(config){
  const min=Number(config.minHeight),max=Number(config.maxHeight),initial=Number(config.initialHeight);
  return {height:initial,direction:max>min?1:0,occupied:false,lastTime:null};
}

export function advanceLift(state,config,now,occupied=state.occupied){
  const min=Number(config.minHeight),max=Number(config.maxHeight),duration=Number(config.durationMs);
  const current={...state,occupied:!!occupied};
  if(current.lastTime===null||!Number.isFinite(current.lastTime))return {...current,lastTime:now};
  const elapsed=Math.max(0,now-current.lastTime);
  if(min===max)return {...current,height:min,direction:0,lastTime:now};
  let direction=current.direction||1;
  if(current.occupied&&direction>0)direction=-1;
  let phase=(current.height-min)/(max-min);
  phase=Math.max(0,Math.min(1,phase));
  if(current.occupied&&direction<0&&phase<=0)return {height:min,direction:-1,occupied:true,lastTime:now};
  let progress=direction>0?phase:1-phase;
  progress+=elapsed/duration;
  while(progress>=1){progress-=1;direction=-direction;}
  // Cosine interpolation gives smooth acceleration at both endpoints.
  const eased=(1-Math.cos(progress*Math.PI))/2;
  const height=direction>0?min+(max-min)*eased:max-(max-min)*eased;
  return {height,direction,occupied:current.occupied,lastTime:now};
}
