// The road network as a graph: intersections are nodes on the avenue/street grid, and every
// driver in Coral Bay — traffic, police, and the route helpers the missions use — thinks in
// these nodes and the lanes between them. Traffic keeps to the right-hand lane; the lane
// offset below is what puts two streams of cars past each other without meeting.
import { COLS, PITCH, ROWS, ROAD_WIDTH, roadCenterX, roadCenterY } from './city.js';

export const LANE_OFFSET = 12;

/** The world position of intersection node (i, j). */
export function nodePosition(i, j) {
  return { x: roadCenterX(i), y: roadCenterY(j) };
}

/** The nearest intersection indices to a world point, clamped to the grid. */
export function nearestNode(x, y) {
  const i = Math.max(0, Math.min(COLS, Math.round((x - ROAD_WIDTH / 2) / PITCH)));
  const j = Math.max(0, Math.min(ROWS, Math.round((y - ROAD_WIDTH / 2) / PITCH)));
  return { i, j };
}

/**
 * The position along the lane from node (fi, fj) to adjacent node (ti, tj), t in 0..1,
 * riding the right-hand lane for that direction of travel.
 */
export function lanePosition(fi, fj, ti, tj, t) {
  const from = nodePosition(fi, fj);
  const to = nodePosition(ti, tj);
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  // Right of travel in screen space (y down): facing east the right hand is south.
  const rx = -dy;
  const ry = dx;
  return {
    x: from.x + (to.x - from.x) * t + rx * LANE_OFFSET,
    y: from.y + (to.y - from.y) * t + ry * LANE_OFFSET,
    angle: Math.atan2(dy, dx),
  };
}

/**
 * Pick the next intersection for a driver arriving at (i, j) from (fromI, fromJ): mostly
 * straight on, sometimes a turn, almost never a U-turn. Keeps traffic flowing and varied.
 */
export function chooseNextNode(rng, i, j, fromI, fromJ) {
  const options = [];
  const dirs = [
    { i: i + 1, j, straight: fromI === i - 1 },
    { i: i - 1, j, straight: fromI === i + 1 },
    { i, j: j + 1, straight: fromJ === j - 1 },
    { i, j: j - 1, straight: fromJ === j + 1 },
  ];
  for (const d of dirs) {
    if (d.i < 0 || d.i > COLS || d.j < 0 || d.j > ROWS) continue;
    if (d.i === fromI && d.j === fromJ) continue;
    options.push(d);
  }
  if (options.length === 0) return { i: fromI, j: fromJ };
  const straight = options.find((d) => d.straight);
  if (straight && rng.chance(0.62)) return { i: straight.i, j: straight.j };
  const pick = options[Math.floor(rng.next() * options.length)];
  return { i: pick.i, j: pick.j };
}

/**
 * A driving waypoint from (x, y) toward (tx, ty) that respects the grid: drive along your
 * own avenue to the target's street, then along that street to the target. When both points
 * already share an avenue or a street, the waypoint is the target itself. Police steering
 * calls this every frame; reaching within a car length of the waypoint advances the route.
 */
export function routeWaypoint(x, y, tx, ty) {
  const self = nearestNode(x, y);
  const goal = nearestNode(tx, ty);
  const selfPos = nodePosition(self.i, self.j);
  const onSameAvenue = Math.abs(x - roadCenterX(goal.i)) < ROAD_WIDTH * 0.75 && Math.abs(tx - x) < ROAD_WIDTH;
  const onSameStreet = Math.abs(y - roadCenterY(goal.j)) < ROAD_WIDTH * 0.75 && Math.abs(ty - y) < ROAD_WIDTH;
  if (onSameAvenue || onSameStreet) return { x: tx, y: ty, final: true };
  // Head to the intersection of my avenue and the target's street.
  const corner = { x: selfPos.x, y: roadCenterY(goal.j) };
  const distToCorner = Math.hypot(corner.x - x, corner.y - y);
  if (distToCorner > 46) return { x: corner.x, y: corner.y, final: false };
  const corner2 = { x: roadCenterX(goal.i), y: roadCenterY(goal.j) };
  const distToCorner2 = Math.hypot(corner2.x - x, corner2.y - y);
  if (distToCorner2 > 46) return { x: corner2.x, y: corner2.y, final: false };
  return { x: tx, y: ty, final: true };
}

/** Distance in a straight line; named so call sites read as intent. */
export function distanceBetween(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
