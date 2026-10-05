export class EventBus {
  #listeners = new Map();
  on(name, listener) {
    if(typeof name!=='string'||!name||typeof listener!=='function')throw new TypeError('事件名称和监听器无效');
    const listeners=this.#listeners.get(name)??new Set();
    const subscription={listener};listeners.add(subscription);this.#listeners.set(name,listeners);
    return ()=>{listeners.delete(subscription);if(!listeners.size&&this.#listeners.get(name)===listeners)this.#listeners.delete(name);};
  }
  emit(name, payload) {
    const listeners=this.#listeners.get(name),errors=[];
    for(const subscription of [...(listeners??[])]){
      if(!listeners.has(subscription))continue;
      try{subscription.listener(payload);}catch(error){errors.push(error);}
    }
    return errors;
  }
  clear(){this.#listeners.clear();}
}
