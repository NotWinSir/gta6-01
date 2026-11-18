// The Coral Bay Police Department: a wanted level of one to five stars, cruisers that spawn
// on the avenues around you and hunt by the road grid, and the two ways a chase ends — you
// lose them (out of sight long enough, or duck into a hideout), or they stop you and the
// busted meter fills. Cruisers ram a fleeing car and crowd a fleeing man; they never shoot.
import { routeWaypoint, nearestNode, nodePosition } from './roads.js';
import { createCar, driveCar } from './vehicles.js';

const COPS_BY_STARS = [0, 1, 2, 3, 5, 7];
const SIGHT_RANGE = 340;
const COOL_PER_STAR = 8;

export function createPolice() {
  return {
    stars: 0,
    lastSeenTimer: 99, // seconds since any cruiser had eyes on the player
    bustMeter: 0,
    spawnTimer: 0,
    coolTimer: 0,
    lostHeatEvent: false,
  };
}

/** Raise the wanted level (never lowers it); crimes call this with their star value. */
export function reportCrime(world, stars) {
  const police = world.police;
  if (stars > police.stars) {
    police.stars = Math.min(5, stars);
    police.coolTimer = 0;
  }
}

/** Drop the heat entirely — a hideout, a mission beat, or being busted/wasted. */
export function clearWanted(world) {
  world.police.stars = 0;
  world.police.bustMeter = 0;
  world.police.coolTimer = 0;
}

function desiredCops(world) {
  return COPS_BY_STARS[world.police.stars] || 0;
}

function spawnCop(world) {
  const focus = world.player.inCar || world.player;
  for (let tries = 0; tries < 10; tries += 1) {
    const angle = world.rng.range(0, Math.PI * 2);
    const dist = world.rng.range(540, 760);
    const node = nearestNode(focus.x + Math.cos(angle) * dist, focus.y + Math.sin(angle) * dist);
    const pos = nodePosition(node.i, node.j);
    if (Math.hypot(pos.x - focus.x, pos.y - focus.y) < 430) continue;
    const car = createCar(world.rng, 'interceptor', pos.x, pos.y, angle);
    car.driver = 'police';
    car.cop = { stuckTimer: 0, lastX: pos.x, lastY: pos.y };
    world.cars.push(car);
    return true;
  }
  return false;
}

export function updatePolice(world, dt) {
  const police = world.police;
  const player = world.player;
  const focus = player.inCar || player;
  police.lostHeatEvent = false;

  // Eyes on the player?
  let seen = false;
  let nearestCopDist = Infinity;
  for (const car of world.cars) {
    if (car.driver !== 'police') continue;
    const d = Math.hypot(car.x - focus.x, car.y - focus.y);
    if (d < nearestCopDist) nearestCopDist = d;
    if (d < SIGHT_RANGE) seen = true;
  }
  if (seen) {
    police.lastSeenTimer = 0;
    police.coolTimer = 0;
  } else {
    police.lastSeenTimer += dt;
  }

  // Hideouts: duck in unseen and the heat is gone.
  if (police.stars > 0 && nearestCopDist > 150) {
    for (const hideout of world.city.landmarks.hideouts) {
      if (Math.hypot(player.x - hideout.x, player.y - hideout.y) < 34) {
        clearWanted(world);
        police.lostHeatEvent = true;
        world.audio.success();
        break;
      }
    }
  }

  // Cooling off: out of sight, one star fades every COOL_PER_STAR seconds, down to the
  // floor a mission sets while its heat is scripted.
  const floor = world.missions.wantedFloor || 0;
  if (police.stars > floor && !seen && police.lastSeenTimer > 2.5) {
    police.coolTimer += dt;
    if (police.coolTimer >= COOL_PER_STAR) {
      police.coolTimer = 0;
      police.stars -= 1;
      if (police.stars <= floor) police.lostHeatEvent = floor === 0;
    }
  }

  // Spawn and retire cruisers to match the wanted level.
  police.spawnTimer -= dt;
  const cops = world.cars.filter((c) => c.driver === 'police');
  if (cops.length < desiredCops(world) && police.spawnTimer <= 0) {
    if (spawnCop(world)) police.spawnTimer = 0.8;
    else police.spawnTimer = 1.6;
  }
  for (const car of cops) {
    const d = Math.hypot(car.x - focus.x, car.y - focus.y);
    if ((police.stars === 0 && d > 200) || d > 1250) {
      car.driver = null;
      car.cop = null;
      car.police = false;
      car.typeKey = 'sable';
      car.color = '#5b5f6e';
    }
  }

  // Drive the hunt.
  let bustPressure = false;
  for (const car of world.cars) {
    if (car.driver !== 'police') continue;
    driveCop(world, car, dt);
    const d = Math.hypot(car.x - focus.x, car.y - focus.y);
    if (!player.inCar && d < 34) bustPressure = true;
    if (player.inCar && d < car.radius + player.inCar.radius + 8 && Math.abs(player.inCar.speed) < 16) bustPressure = true;
  }
  if (bustPressure && police.stars > 0) {
    police.bustMeter += dt / (player.inCar ? 1.7 : 1.15);
    if (police.bustMeter >= 1) world.busted = true;
  } else {
    police.bustMeter = Math.max(0, police.bustMeter - dt * 0.7);
  }

  // Siren loudness follows the nearest cruiser.
  if (police.stars > 0 && nearestCopDist < 620) world.audio.setSiren(1 - nearestCopDist / 620);
  else world.audio.setSiren(0);
}

function driveCop(world, car, dt) {
  const player = world.player;
  const target = player.inCar || player;
  // Aim where the player will be, through the road grid.
  const lead = 0.35;
  const tx = target.x + Math.cos(target.angle) * (target.speed || 0) * lead;
  const ty = target.y + Math.sin(target.angle) * (target.speed || 0) * lead;
  const wp = routeWaypoint(car.x, car.y, tx, ty);
  const distToPlayer = Math.hypot(target.x - car.x, target.y - car.y);
  const aimX = distToPlayer < 130 ? target.x : wp.x;
  const aimY = distToPlayer < 130 ? target.y : wp.y;
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.1));
  let throttle = Math.abs(diff) > 1.25 ? 0.25 : 1;
  // Back out when nose-to-nose and barely moving: a stuck cruiser reverses and comes again.
  car.cop.stuckTimer += dt;
  if (car.cop.stuckTimer > 0.7) {
    const moved = Math.hypot(car.x - car.cop.lastX, car.y - car.cop.lastY);
    if (moved < 4 && Math.abs(car.speed) < 8) throttle = -1;
    car.cop.lastX = car.x;
    car.cop.lastY = car.y;
    car.cop.stuckTimer = 0;
  }
  if (car.wrecked) throttle = 0;
  driveCar(car, dt, throttle, steer, world.city);
}
