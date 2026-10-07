const directions=Object.freeze({
 north:Object.freeze({r:-1,c:0,opposite:'south',label:'上（北）'}),
 east:Object.freeze({r:0,c:1,opposite:'west',label:'右（东）'}),
 south:Object.freeze({r:1,c:0,opposite:'north',label:'下（南）'}),
 west:Object.freeze({r:0,c:-1,opposite:'east',label:'左（西）'}),
});
function validate(config){if(!Object.hasOwn(directions,config.initialDirection))throw new Error('Invalid ray emitter initial direction');}
module.exports={directions,validate};
