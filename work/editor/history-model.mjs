import {copy} from './selection-model.mjs';

// Editor history contains map + selection only. Player history stays in player.cjs.
export function createEditSnapshot(map, rect, selectedCells) {
  return {map: copy(map), rect: rect ? {...rect} : null, selectedCells: copy(selectedCells)};
}

// Keep one large snapshot so a 128x128 map still has an undo point.
export function trimHistory(history) {
  const cost = item => item.map ? item.map.width * item.map.height : 1;
  let cells = history.reduce((total, item) => total + cost(item), 0);
  while (history.length > 150 || (history.length > 1 && cells > 100000)) {
    cells -= cost(history.shift());
  }
}
