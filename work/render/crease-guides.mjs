import { tileHeight, tileGradualRate } from '../entities/tile-model.mjs';
import { foldStrokes } from '../tags/fold-geometry.mjs';
import { isPaper, paperSurface, DEFAULT_CREASE_DEPTH } from './paper-surface.mjs';

const EPSILON = 1e-9;
const normalize = values => {
  const length = Math.hypot(...values);
  return length ? values.map(value => value / length) : [0, 1, 0];
};
const interpolate = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

// Clip in the original, undeformed X/Z parameter space. Sampling those same
// mesh triangles follows a crease even when its normal also moves it sideways.
function clipPolygon(vertices, distance) {
  const result = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const da = distance(a), db = distance(b);
    if (da >= -EPSILON) result.push(a);
    if ((da >= 0) !== (db >= 0)) result.push(interpolate(a, b, da / (da - db)));
  }
  return result;
}

function cellBounds(points, width, height) {
  const xs = points.map(point => point[0]), zs = points.map(point => point[1]);
  return {
    c0: Math.max(0, Math.floor(Math.min(...xs) + .5)),
    c1: Math.min(width - 1, Math.floor(Math.max(...xs) + .5)),
    r0: Math.max(0, Math.floor(Math.min(...zs) + .5)),
    r1: Math.min(height - 1, Math.floor(Math.max(...zs) + .5)),
  };
}

function segmentInCell(a, b, r, c) {
  let from = 0, to = 1;
  for (const [axis, center] of [[0, c], [1, r]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < EPSILON) {
      if (a[axis] < center - .5 || a[axis] > center + .5) return null;
    } else {
      const bounds = [
        (center - .5 - a[axis]) / delta,
        (center + .5 - a[axis]) / delta,
      ].sort((x, y) => x - y);
      from = Math.max(from, bounds[0]);
      to = Math.min(to, bounds[1]);
    }
  }
  return to - from > EPSILON
    ? [interpolate(a, b, from), interpolate(a, b, to)]
    : null;
}

// Creased tiles refine the 5x5 transition grid into a uniform 33x33 one;
// the parameter grid lines differ, so sampling must follow the same layout.
const gridLines = (size, steps) =>
  size === steps.length
    ? steps
    : Array.from({ length: size }, (_, i) => i / (size - 1) - .5);
const indexInLines = (lines, value) => {
  let index = 0;
  while (index < lines.length - 2 && value > lines[index + 1] + EPSILON) index++;
  return index;
};

/**
 * Sampler over the shared paper surface: paper cells ride the deformed groove,
 * every other cell falls back to a flat plane just above the tabletop.
 * Render data only; fold placement and range stay untouched.
 */
function createSampler(map, {
  hidden = () => false,
  lift = .002,
  flatLift = .018,
  voidPlane = () => 0,
  showFolds = true,
  creaseDepth = DEFAULT_CREASE_DEPTH,
} = {}) {
  const width = map.width ?? map.tiles[0]?.length ?? 0,
    height = map.height ?? map.tiles.length,
    offset = [-(width - 1) / 2, 0, -(height - 1) / 2],
    cache = new Map(),
    foldCells = new Map();
  for (const marker of map.foldCells ?? []) {
    const key = marker.r + ',' + marker.c;
    if (!foldCells.has(key)) foldCells.set(key, []);
    foldCells.get(key).push(marker);
  }

  function cellSurface(r, c) {
    const key = r + ',' + c;
    if (cache.has(key)) return cache.get(key);
    const tile = map.tiles[r]?.[c];
    const surface = isPaper(tile)
      ? paperSurface({ ...map, foldCells: foldCells.get(key) ?? [] }, r, c, hidden, showFolds, creaseDepth)
      : null;
    const size = surface ? Math.sqrt(surface.points.length) : 0;
    const inner = .5 / (1 + tileGradualRate(tile));
    const steps = [-.5, -inner, 0, inner, .5];
    const value = {
      surface,
      size,
      lines: gridLines(size, steps),
      height: tile ? tileHeight(tile) : 0,
    };
    cache.set(key, value);
    return value;
  }

  function sample(r, c, point) {
    const { surface, size, lines, height: top } = cellSurface(r, c);
    if (!surface)
      return {
        position: [
          point[0] + c + offset[0],
          (voidPlane(r, c) ?? 0) + flatLift,
          point[1] + r + offset[2],
      ],
        normal: [0, 1, 0],
      };
    const x = indexInLines(lines, point[0]),
      z = indexInLines(lines, point[1]);
    const tx = (point[0] - lines[x]) / (lines[x + 1] - lines[x]),
      tz = (point[1] - lines[z]) / (lines[z + 1] - lines[z]);
    const a = z * size + x,
      b = a + 1,
      d = a + size,
      e = d + 1;
    const indices = tx + tz <= 1 ? [a, d, b] : [b, d, e];
    const weights =
      tx + tz <= 1 ? [1 - tx - tz, tz, tx] : [1 - tz, 1 - tx, tx + tz - 1];
    const blend = values =>
      [0, 1, 2].map(axis =>
        indices.reduce((sum, index, i) => sum + values[index][axis] * weights[i], 0),
      );
    const normal = normalize(blend(surface.normals));
    const position = blend(surface.points).map(
      (value, axis) => value + normal[axis] * lift + offset[axis],
    );
    position[0] += c;
    position[2] += r;
    return { position, normal };
  }

  return { width, height, offset, cache, cellSurface, sample };
}

/** Parameters where a stroke crosses mesh triangle boundaries inside one cell. */
function strokeBreaks(a, b, r, c, cellSurface) {
  const { surface, size } = cellSurface(r, c),
    breaks = [0, 1];
  if (surface) {
    const count = size - 1,
      axes = [
        [a[0], b[0], -.5, .5],
        [a[1], b[1], -.5, .5],
        [a[0] + a[1], b[0] + b[1], -1, 1],
      ];
    for (const [from, to, min, max] of axes) {
      if (Math.abs(to - from) < EPSILON) continue;
      for (let value = min; value <= max + EPSILON; value += 1 / count) {
        const t = (value - from) / (to - from);
        if (t > EPSILON && t < 1 - EPSILON) breaks.push(t);
      }
    }
  }
  return breaks
    .sort((x, y) => x - y)
    .filter((value, i, all) => i === 0 || value - all[i - 1] > EPSILON);
}

/**
 * Dash/dot crease hints that hug the physical groove: paper cells sample the
 * deformed surface, void cells fall back to a flat plane just above the table.
 * A selected crease is handed over to creaseSelection, so its dashes are left
 * out here and only the highlight is drawn.
 * Render data only; fold placement and range are unchanged.
 */
export function creaseGuides(map, groups, {
  hidden = () => false,
  lift = .002,
  flatLift = .018,
  dotRadius = .035 / 3,
  showFolds = true,
  voidPlane = () => 0,
  selected = null,
  creaseDepth = DEFAULT_CREASE_DEPTH,
} = {}) {
  const { width, height, cellSurface, sample } = createSampler(map, {
    hidden,
    lift,
    flatLift,
    voidPlane,
    showFolds,
    creaseDepth,
  });
  const positions = [], lineCells = [], dots = [];

  function addLine(a, b, r, c) {
    const localA = [a[0] - c, a[1] - r],
      localB = [b[0] - c, b[1] - r],
      breaks = strokeBreaks(localA, localB, r, c, cellSurface);
    for (let i = 1; i < breaks.length; i++) {
      positions.push(
        ...sample(r, c, interpolate(localA, localB, breaks[i - 1])).position,
        ...sample(r, c, interpolate(localA, localB, breaks[i])).position,
      );
      lineCells.push({ r, c });
    }
  }

  function addDot(center) {
    const polygon = Array.from({ length: 24 }, (_, i) => {
      const angle = (i * Math.PI) / 12;
      return [
        center[0] + Math.cos(angle) * dotRadius,
        center[1] + Math.sin(angle) * dotRadius,
      ];
    });
    const box = cellBounds(polygon, width, height);
    for (let r = box.r0; r <= box.r1; r++)
      for (let c = box.c0; c <= box.c1; c++) {
        if (hidden(r, c)) continue;
        let part = polygon.map((point) => [point[0] - c, point[1] - r]);
        for (const distance of [
          (p) => p[0] + .5,
          (p) => .5 - p[0],
          (p) => p[1] + .5,
          (p) => .5 - p[1],
        ])
          part = clipPolygon(part, distance);
        if (part.length < 3) continue;
        const { surface, size, lines } = cellSurface(r, c),
          triangles = [];
        function append(vertices) {
          for (let i = 1; i < vertices.length - 1; i++)
            // Counterclockwise parameter X/Z is clockwise when viewed from +Y.
            for (const point of [vertices[0], vertices[i + 1], vertices[i]])
              triangles.push(...sample(r, c, point).position);
        }
        if (!surface) append(part);
        else {
          const xs = part.map((p) => p[0]),
            zs = part.map((p) => p[1]);
          const x0 = indexInLines(lines, Math.min(...xs)),
          x1 = indexInLines(lines, Math.max(...xs));
          const z0 = indexInLines(lines, Math.min(...zs)),
          z1 = indexInLines(lines, Math.max(...zs));
          for (let z = z0; z <= z1 + 1; z++)
            for (let x = x0; x <= x1 + 1; x++) {
              const diagonal = (p) =>
                (p[0] - lines[x]) / (lines[x + 1] - lines[x]) +
                (p[1] - lines[z]) / (lines[z + 1] - lines[z]) -
                1;
              let square = part;
              for (const distance of [
                (p) => p[0] - lines[x],
                (p) => lines[x + 1] - p[0],
                (p) => p[1] - lines[z],
                (p) => lines[z + 1] - p[1],
              ])
                square = clipPolygon(square, distance);
              append(clipPolygon(square, diagonal));
              append(clipPolygon(square, (p) => -diagonal(p)));
            }
        }
        if (triangles.length) {
          const localCenter = [
            Math.max(-.5, Math.min(.5, center[0] - c)),
            Math.max(-.5, Math.min(.5, center[1] - r)),
          ];
          dots.push({
            ...sample(r, c, localCenter),
            positions: triangles,
            cell: { r, c },
          });
        }
      }
  }

  for (const group of groups) {
    // The selected crease is drawn by creaseSelection, so skip its dashes.
    if (selected && group.type === selected.type &&
      group.cells.some(p => p.r === selected.r && p.c === selected.c)) continue;
    for (const [from, to] of foldStrokes(group)) {
      const a = [from.c, from.r],
        b = [to.c, to.r];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .04) {
        addDot(interpolate(a, b, .5));
      continue;
    }
    const box = cellBounds([a, b], width, height);
    for (let r = box.r0; r <= box.r1; r++)
      for (let c = box.c0; c <= box.c1; c++) {
        if (hidden(r, c)) continue;
        const segment = segmentInCell(a, b, r, c);
        if (segment) addLine(segment[0], segment[1], r, c);
      }
    }
  }
  return { positions, lineCells, dots, dotRadius };
}

/**
 * Continuous surface-conforming ribbon for the selected crease itself.
 * Area fills are separate geometry; no bounding rectangle is drawn.
 *
 * Render data only; fold placement and range stay unchanged.
 */
export function creaseSelection(map, group, {
  hidden = () => false,
  lift = .004,
  flatLift = .024,
  voidPlane = () => 0,
  showFolds = true,
  width = .085,
  creaseDepth = DEFAULT_CREASE_DEPTH,
} = {}) {
  const { width: cols, height: rows, cellSurface, sample } = createSampler(map, {
    hidden,
    lift,
    flatLift,
    voidPlane,
    showFolds,
    creaseDepth,
  });
  const positions = [],
    cells = [];

  function emit(r, c, corners) {
    const p = corners.map((point) => sample(r, c, point).position);
    for (const [a, b, d] of [
      [p[0], p[1], p[2]],
      [p[0], p[2], p[3]],
    ]) {
      positions.push(...a, ...b, ...d);
      cells.push({ r, c });
    }
  }

  // Widen a straight stroke into a ribbon of quads and split it at every mesh
  // triangle edge, so the band hugs slopes instead of cutting through them.
  function stroke(a, b, half) {
    const box = cellBounds([a, b], cols, rows);
    for (let r = box.r0; r <= box.r1; r++)
      for (let c = box.c0; c <= box.c1; c++) {
        if (hidden(r, c)) continue;
        const piece = segmentInCell(a, b, r, c);
        if (!piece) continue;
        const localA = [piece[0][0] - c, piece[0][1] - r],
          localB = [piece[1][0] - c, piece[1][1] - r],
          breaks = strokeBreaks(localA, localB, r, c, cellSurface);
        for (let i = 1; i < breaks.length; i++) {
          const p0 = interpolate(localA, localB, breaks[i - 1]),
            p1 = interpolate(localA, localB, breaks[i]);
          const dx = p1[0] - p0[0],
          dz = p1[1] - p0[1],
          length = Math.hypot(dx, dz);
          if (length < EPSILON) continue;
          const nx = (-dz / length) * half,
            nz = (dx / length) * half;
          emit(r, c, [
            [p0[0] + nx, p0[1] + nz],
            [p1[0] + nx, p1[1] + nz],
            [p1[0] - nx, p1[1] - nz],
            [p0[0] - nx, p0[1] - nz],
          ]);
        }
      }
  }

  if (!group?.cells?.length) return { positions, cells };
  stroke([group.from.c, group.from.r], [group.to.c, group.to.r], width / 2);
  return { positions, cells };
}

/** Top-surface fills for controller-classified fold cells, including axis halves. */
export function creaseAreaSelection(map, region, group, {
  hidden = () => false,
  showFolds = true,
  creaseDepth = DEFAULT_CREASE_DEPTH,
  lift = .008,
  striped = false,
} = {}) {
  const positions = [], cells = [], stripes = [], stripeCells = [];
  const offset = [-(map.width - 1) / 2, 0, -(map.height - 1) / 2];
  const dr = group?.to.r - group?.from.r, dc = group?.to.c - group?.from.c;
  const emit = (polygon, output, metadata, cell, extraLift = 0) => {
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const p of [polygon[0], polygon[i], polygon[i + 1]])
        output.push(p[0] + offset[0], p[1] + lift + extraLift, p[2] + offset[2]);
      metadata.push({r:cell.r,c:cell.c});
    }
  };
  for (const cell of region) {
    const {r,c,half} = cell, tile = map.tiles[r]?.[c];
    if (!tile || hidden(r,c)) continue;
    const surface = paperSurface(map,r,c,hidden,showFolds,creaseDepth);
    const triangles = [];
    if (surface) {
      // Top/bottom triangles are paired; the final ring closes the side walls.
      const end = surface.positions.length - surface.boundary.length * 18;
      for(let i=0;i<end;i+=18)triangles.push([
        surface.positions.slice(i,i+3),surface.positions.slice(i+3,i+6),surface.positions.slice(i+6,i+9),
      ]);
    } else {
      const y=tileHeight(tile);
      triangles.push([[-.5,y,-.5],[-.5,y,.5],[.5,y,-.5]],[[.5,y,-.5],[-.5,y,.5],[.5,y,.5]]);
    }
    for (const triangle of triangles) {
      let polygon = triangle.map(p=>[p[0]+c,p[1],p[2]+r]);
      if(half)polygon=clipPolygon(polygon,p=>((p[0]-group.center.c)*dr-(p[2]-group.center.r)*dc)*half);
      if(polygon.length<3)continue;
      emit(polygon,positions,cells,cell);
      if(!striped)continue;
      const values=polygon.map(p=>p[0]+p[2]),period=.3,width=.035;
      for(let band=Math.floor(Math.min(...values)/period);band*period<=Math.max(...values);band++){
        const start=band*period;
        const stripe=clipPolygon(clipPolygon(polygon,p=>p[0]+p[2]-start),p=>start+width-p[0]-p[2]);
        emit(stripe,stripes,stripeCells,cell,.002);
      }
    }
  }
  return {positions,cells,stripes,stripeCells};
}
