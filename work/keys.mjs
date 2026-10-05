import {blocked} from './tile-model.mjs';
export const keyNameOf=tile=>tile?.keyName?.trim()||'钥匙';
export function legalKeyNames(map){return [...new Set(map.tiles.flat().filter(t=>t?.terrain==='key'&&!blocked(t)).map(keyNameOf))].sort();}
