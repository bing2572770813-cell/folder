// Broken paper removes the cell's support and dependent render/entry projections.
module.exports={isBrokenCell:(world,nodes)=>nodes.some(node=>node.components.fragile&&world.runtime(node.id,'fragile').broken===true)};
