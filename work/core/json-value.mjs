import {jsonCopy} from '../backend/dist/core/json-value.js';

const propertyPolicy=Object.freeze({maxDepth:16,depthError:'JSON 属性嵌套过深',keyError:'属性名称无效',valueError:'属性必须是有效 JSON 数据'});
// Preserve the property editor's public signature, depth limit and error messages.
export function copyJson(value,depth=0){return jsonCopy(value,depth,propertyPolicy);}
