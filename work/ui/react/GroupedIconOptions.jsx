import React from 'react';
/** Generic titled groups; selection behaviour is supplied by the caller. */
export function GroupedIconOptions({groups,renderOptions}){
  return groups.filter(group=>group.items.length).map(group=>(
    <section className="icon-option-group" key={group.id} aria-label={group.name}>
      <h3 className="icon-option-group-title">{group.name}</h3>
      <div className="prefab-grid icon-select-grid">{renderOptions(group.items)}</div>
    </section>
  ));
}
