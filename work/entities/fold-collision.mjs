/**
 * Physical fold collision.
 *
 * A fold is a temporary render transform: the flap — every entity cell on the
 * player's side of the crease and inside the crease's reach — rotates about the
 * hinge line. It must never push through an entity that declares a collision
 * box, and it must never dip through the tabletop.
 *
 * Both constraints collapse to one two-dimensional question. Rotation about a
 * fixed axis preserves the coordinate along that axis, so inside the plane
 * perpendicular to the hinge every sampled point of the flap travels on a
 * circle centred on the hinge: (u, v) advances to (u cos a - v sin a,
 * u sin a + v cos a), where u is the signed distance from the crease and v
 * the height above it. Slicing a static collider with that same plane yields a
 * rectangle, so the largest safe angle is the first crossing between any such
 * circle and any such rectangle, solved in closed form per pair.
 *
 * Void carries no collision box. Whether hidden cells take part is the
 * caller's call: the editor only hands over cells that are currently drawn, so
 * a fold is never stopped by something the player cannot see.
 */

const EPS = 1e-6,
  TWO_PI = Math.PI * 2;
// A crossing only counts when the sweep really enters the box, so grazes pass.
const PROBE = 1e-3;
// Boxes are inset by a hair so faces shared with the flap are not "inside".
const SKIN = 1e-4;

/** Void is transparent scenery: it never carries a collision box. */
export const hasCollisionBox = (tile) => !!tile && tile.collision !== false;

const mod = (value, m) => ((value % m) + m) % m;
const inside = (rect, u, v) =>
  u > rect[0] + SKIN &&
  u < rect[2] - SKIN &&
  v > rect[1] + SKIN &&
  v < rect[3] - SKIN;

function unitXZ(x, z) {
  const length = Math.hypot(x, z);
  return length > EPS ? [x / length, z / length] : [1, 0];
}

function footprint(cell, wx, wz) {
  const x = wx(cell.c),
    z = wz(cell.r);
  return [
    [x - 0.5, z - 0.5],
    [x + 0.5, z - 0.5],
    [x + 0.5, z + 0.5],
    [x - 0.5, z + 0.5],
  ];
}

/**
 * Largest rotation, in radians, before the flap meets a collision box.
 *
 * @param {object} options
 * @param {{origin:number[],direction:number[],side?:number}} options.hinge
 * @param {Array<{r:number,c:number,partial?:boolean}>} options.flap cells that rotate
 * @param {Array<{r:number,c:number}>} options.colliders cells that stay put
 * @param {(c:number)=>number} options.wx cell centre -> local x
 * @param {(r:number)=>number} options.wz cell centre -> local z
 * @param {(r:number,c:number)=>number} options.top elevation of a cell's top face
 * @param {(r:number,c:number)=>number} options.depth how far a cell's box reaches down
 * @param {(r:number,c:number)=>object|null} options.tileAt tile data of a cell
 * @param {number|null} options.groundY tabletop elevation the flap may not cross
 * @param {number} [options.margin] angular gap kept between flap and contact
 * @param {number} [options.resolution] footprint subdivision, 1 keeps corners only
 * @param {number} [options.budget] cap on circle/rectangle checks per drag
 */
export function foldCollisionLimit(options = {}) {
  const {
    hinge,
    flap = [],
    colliders = [],
    wx = (c) => c,
    wz = (r) => r,
    top = () => 0,
    depth = () => 0,
    tileAt = () => null,
    groundY = null,
    margin = 0.02,
    resolution = 1,
    budget = 400000,
  } = options;
  if (!hinge || !flap.length) return Math.PI;
  const [ax, az] = unitXZ(hinge.direction?.[0] ?? 1, hinge.direction?.[2] ?? 0),
    side = hinge.side ?? 1,
    origin = hinge.origin ?? [0, 0, 0];
  const frame = (x, y, z) => {
    const dx = x - origin[0],
      dz = z - origin[2];
    return { u: (dx * az - dz * ax) * side, v: y - origin[1], t: dx * ax + dz * az };
  };
  const context = { wx, wz, top, depth, frame, resolution };
  const boxes = [];
  for (const cell of colliders) {
    const box = boxOf(cell, { ...context, tileAt });
    if (box) boxes.push(box);
  }
  let limit = Math.PI;
  const ordered = orderFlap(flap, context),
    // A crease spanning a whole 128x128 map would otherwise check hundreds of
    // millions of pairs inside a single pointer move.
    stride = Math.max(1, Math.ceil((ordered.length * Math.max(1, boxes.length)) / budget));
  for (let index = 0; index < ordered.length; index += stride) {
    const cell = ordered[index];
    for (const sample of samplesOf(cell, context)) {
      const radius = Math.hypot(sample.u, sample.v);
      if (radius < EPS) continue;
      const start = Math.atan2(sample.v, sample.u);
      for (const box of boxes) {
        // The arc keeps a fixed distance from the hinge, so a collider is only
        // reachable when its own distance band straddles that radius.
        if (box.near > radius || box.far < radius) continue;
        const slice = sliceAt(box, sample.t);
        if (!slice) continue;
        const rect = [slice[0], box.bottom, slice[1], box.top];
        if (inside(rect, sample.u, sample.v)) return 0;
        const angle = firstCrossing(rect, radius, start);
        if (angle !== null && angle < limit) limit = angle;
      }
      if (Number.isFinite(groundY)) {
        // The tabletop is a floor: nothing may fold down through it.
        const sinking = descendAngle(sample, groundY - origin[1]);
        if (sinking !== null && sinking < limit) limit = sinking;
      }
    }
  }
  // Landing on top of the far side is what a 180 degree fold means, so
  // contact exactly at the end of the sweep is not an obstruction.
  return limit >= Math.PI - margin ? Math.PI : Math.max(0, limit - margin);
}

// Widest sweeping cells first, so a partial scan still sees the nearest contact.
function orderFlap(flap, { wx, wz, frame }) {
  return [...flap].sort(
    (a, b) =>
      Math.abs(frame(wx(b.c), 0, wz(b.r)).u) -
      Math.abs(frame(wx(a.c), 0, wz(a.r)).u),
  );
}

// Samples the silhouette of one flap cell: its footprint outline, subdivided
// when asked, taken on both the top and the bottom face.
function samplesOf(cell, ctx) {
  const { wx, wz, top, depth, frame, resolution } = ctx;
  const surface = top(cell.r, cell.c),
    floor = surface - depth(cell.r, cell.c),
    steps = Math.max(1, Math.round(resolution)),
    outline = footprint(cell, wx, wz).map(([x, z]) => frame(x, 0, z));
  const points = [];
  for (let i = 0; i <= steps; i++)
    for (let j = 0; j <= steps; j++) {
      if (steps > 1 && i > 0 && i < steps && j > 0 && j < steps) continue;
      const x = wx(cell.c) - 0.5 + i / steps,
        z = wz(cell.r) - 0.5 + j / steps;
      for (const y of [surface, floor]) {
        const point = frame(x, y, z);
        // A crease cell leaves its fixed half behind, so only the half on
        // the lifting side rides the rotation.
        if (cell.partial && point.u <= 0) continue;
        points.push(point);
      }
    }
  return points;
}

// One collider as seen inside the hinge plane: its u/t footprint plus the band
// of distances from the hinge, which prunes circles that can never reach it.
function boxOf(cell, ctx) {
  const tile = ctx.tileAt(cell.r, cell.c);
  if (!hasCollisionBox(tile)) return null;
  const surface = ctx.top(cell.r, cell.c),
    depth = ctx.depth(cell.r, cell.c),
    corners = footprint(cell, ctx.wx, ctx.wz).map(([x, z]) => ctx.frame(x, 0, z));
  let near = Infinity,
    far = 0;
  for (const corner of corners)
    for (const height of [surface, surface - depth]) {
      const distance = Math.hypot(corner.u, ctx.frame(0, height, 0).v);
      if (distance < near) near = distance;
      if (distance > far) far = distance;
    }
  return {
    corners,
    near,
    far,
    top: ctx.frame(0, surface, 0).v,
    bottom: ctx.frame(0, surface - depth, 0).v,
  };
}

// The u-range of a collider inside the rotating plane of one sample point.
function sliceAt(box, t) {
  const corners = box.corners,
    values = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length],
      dt = b.t - a.t;
    if (Math.abs(dt) <= EPS) {
      if (Math.abs(a.t - t) <= EPS) values.push(a.u, b.u);
      continue;
    }
    const s = (t - a.t) / dt;
    if (s >= -EPS && s <= 1 + EPS) values.push(a.u + (b.u - a.u) * s);
  }
  if (!values.length) return null;
  const min = Math.min(...values),
    max = Math.max(...values);
  return max > min ? [min, max] : null;
}

// First rotation that carries a circle of the given radius onto a box edge.
function firstCrossing(rect, radius, start) {
  const [u0, v0, u1, v1] = rect,
    edges = [
      [
        [u0, v0],
        [u1, v0],
      ],
      [
        [u1, v0],
        [u1, v1],
      ],
      [
        [u1, v1],
        [u0, v1],
      ],
      [
        [u0, v1],
        [u0, v0],
      ],
    ];
  let best = null;
  for (const [a, b] of edges)
    for (const point of circleSegment(radius, a, b)) {
      const angle = mod(Math.atan2(point[1], point[0]) - start, TWO_PI);
      // Only a crossing inside the sweep counts, and it has to be a real
      // entry into the box rather than a graze along its surface.
      if (angle <= EPS || angle > Math.PI) continue;
      const ahead = start + angle + PROBE;
      if (!inside(rect, radius * Math.cos(ahead), radius * Math.sin(ahead))) continue;
      if (best === null || angle < best) best = angle;
    }
  return best;
}

function circleSegment(radius, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    A = dx * dx + dy * dy;
  if (A <= EPS) return [];
  const B = 2 * (a[0] * dx + a[1] * dy),
    C = a[0] * a[0] + a[1] * a[1] - radius * radius,
    discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return [];
  const root = Math.sqrt(discriminant),
    points = [];
  for (const s of [(-B - root) / (2 * A), (-B + root) / (2 * A)])
      if (s >= -EPS && s <= 1 + EPS) points.push([a[0] + dx * s, a[1] + dy * s]);
  return points;
}

// Angle at which the descending arc sinks below a horizontal surface.
function descendAngle(sample, level) {
  const radius = Math.hypot(sample.u, sample.v);
  if (radius < EPS) return null;
  // Anything already under the surface can never be folded through it.
  if (sample.v < level) return 0;
  const ratio = level / radius;
  // The sweep only touches the surface when the circle spans that height.
  if (ratio < -1) return null;
  const delta = mod(
    Math.PI - Math.asin(Math.max(-1, Math.min(1, ratio))) -
      Math.atan2(sample.v, sample.u),
    TWO_PI,
  );
  if (delta <= EPS) return 0;
  return delta <= Math.PI ? delta : null;
}
