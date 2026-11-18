// Traffic: the civilian cars that keep Coral Bay's avenues alive. Each one follows the road
// graph from intersection to intersection in the right-hand lane, brakes for whatever is in
// front of it, honks when the player blocks the road, and flees its car if it is wrecked or
// carjacked. The manager keeps a bubble of cars around the player and recycles the far ones.
import { PITCH } from './city.js';
import { chooseNextNode, lanePosition, nearestNode, nodePosition } from './roads.js';
import { createCar, randomCivilianType } from './vehicles.js';

const TARGET_COUNT = 13;
const DESPAWN_DIST = 1250;
const SPAWN_MIN_DIST = 620;
const SPAWN_MAX_DIST = 1150;

function startEdge(rng, car, i, j) {
  const next = chooseNextNode(rng, i, j, i, j);
  car.traffic = { fi: i, fj: j, ti: next.i, tj: next.j, t: 0, cruise: 0, panic: 0 };
  car.traffic.cruise = rng.range(105, 165);
}

export function createTraffic() {
  return { timer: 0 };
}

function spawnTrafficCar(world, px, py) {
  for (let tries = 0; tries < 12; tries += 1) {
    const node = nearestNode(px + world.rng.range(-SPAWN_MAX_DIST, SPAWN_MAX_DIST), py + world.rng.range(-SPAWN_MAX_DIST, SPAWN_MAX_DIST));
    const pos = nodePosition(node.i, node.j);
    const dist = Math.hypot(pos.x - px, pos.y - py);
    if (dist < SPAWN_MIN_DIST || dist > SPAWN_MAX_DIST + 200) continue;
    const car = createCar(world.rng, randomCivilianType(world.rng), pos.x, pos.y, 0);
    car.driver = 'traffic';
    startEdge(world.rng, car, node.i, node.j);
    world.cars.push(car);
    return true;
  }
  return false;
}

export function updateTraffic(world, dt) {
  const player = world.player;
  const focus = player.inCar || player;
  let active = 0;
  for (const car of world.cars) {
    if (car.driver !== 'traffic') continue;
    const dist = Math.hypot(car.x - focus.x, car.y - focus.y);
    if (dist > DESPAWN_DIST || car.wrecked) {
      if (car.wrecked && dist < 700) world.addFleeingDriver(car);
      car.driver = null;
      car.traffic = null;
      continue;
    }
    active += 1;
    driveTrafficCar(world, car, dt);
  }
  world.traffic.timer -= dt;
  if (active < TARGET_COUNT && world.traffic.timer <= 0) {
    if (spawnTrafficCar(world, focus.x, focus.y)) world.traffic.timer = 0.4;
    else world.traffic.timer = 1.2;
  }
}

function driveTrafficCar(world, car, dt) {
  const tr = car.traffic;
  const from = lanePosition(tr.fi, tr.fj, tr.ti, tr.tj, 0);
  const to = lanePosition(tr.fi, tr.fj, tr.ti, tr.tj, 1);
  const edgeLen = Math.hypot(to.x - from.x, to.y - from.y) || PITCH;

  // Look ahead: anything solid in my lane slows me down, a horn's length from it.
  let target = tr.panic > 0 ? tr.cruise * 1.7 : tr.cruise;
  tr.panic = Math.max(0, tr.panic - dt);
  const aheadX = car.x + Math.cos(car.angle) * 52;
  const aheadY = car.y + Math.sin(car.angle) * 52;
  for (const other of world.cars) {
    if (other === car) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < other.radius + 16) {
      target = 0;
      if (other.driver === 'player' && world.rng.chance(0.008)) world.audio.honk();
      break;
    }
  }
  const player = world.player;
  if (!player.inCar && Math.hypot(player.x - aheadX, player.y - aheadY) < 30) target = 0;

  car.speed += Math.max(-320 * dt, Math.min(190 * dt, target - car.speed));
  if (car.speed < 0) car.speed = 0;
  tr.t += (car.speed * dt) / edgeLen;
  if (tr.t >= 1) {
    const arrived = { i: tr.ti, j: tr.tj };
    const next = chooseNextNode(world.rng, arrived.i, arrived.j, tr.fi, tr.fj);
    car.traffic = { fi: arrived.i, fj: arrived.j, ti: next.i, tj: next.j, t: 0, cruise: tr.cruise, panic: tr.panic };
  }
  const pos = lanePosition(car.traffic.fi, car.traffic.fj, car.traffic.ti, car.traffic.tj, car.traffic.t);
  car.x = pos.x;
  car.y = pos.y;
  const turn = pos.angle - car.angle;
  car.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 8);
  car.steerVis = Math.max(-0.4, Math.min(0.4, Math.atan2(Math.sin(turn), Math.cos(turn))));
}
