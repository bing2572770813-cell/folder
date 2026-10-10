import React from 'react';
import {UiSection,UiInput,UiButton} from './controls.jsx';
import {lightingFields,lightingDefaults} from '../../render/lighting.mjs';

export function PhysicsPanel(){return <UiSection className="studio-section">
 <h2>物理属性</h2><p className="studio-readout">摄像机仅在新区域渲染完成后定位到玩家，普通移动和折叠不跟随。</p><p className="studio-readout">全局光照与折叠参数即时作用于编辑与游玩视图，仅当前会话生效。</p>
 <div className="studio-fields"><label><input id="cameraFollowToggle" type="checkbox" defaultChecked={false} disabled />持续跟随玩家（已停用）</label>{lightingFields.map(([key,label,min,max,step])=><label key={key}>{label}<UiInput id={'lighting-'+key} aria-label={label} type="number" min={min} max={max} step={step} defaultValue={lightingDefaults[key]}/></label>)}
 <UiButton id="resetLighting">重置物理属性</UiButton><p id="lightingStatus" role="status" className="studio-readout">修改参数立即预览。</p></div>
 </UiSection>;}
