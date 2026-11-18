// The people of Coral Bay: they stroll the sidewalks block by block in little loops, in
// holiday shirts and sun hats, and they run when the day turns violent — a shot fired, a car
// on the kerb, a wreck beside them. Drivers whose cars are stolen or wrecked climb out and
// flee the same way. A person who is hit goes down and stays down a while before the city
// quietly recycles them somewhere calmer.
import { BLOCK_SIZE, SIDEWALK, collideBuildings } from './city.js';

const SHIRTS = ['#e2574c', '#f2b134', '#4f9da6', '#f7f0e1', '#7fb069', '#ef8354', '#6c5b7b', '#2e86ab'];
const SKINS = ['#f2c79b', '#d9a066', '#a9744f', '#7a4b2a', '#5d3a1f'];
const TARGET_COUNT = 42;
const RECYCLE_DIST = 1150;

let nextPedId = 1;

export function createPed(rng, x, y, block) {
  return {
    id: nextPedId++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(48, 82),
    state: 'walk', // walk | flee | down | exit (climbing out of a car)
    block: block || null,
    wp: 0,
    health: 100,
    shirt: SHIRTS[Math.floor(rng.next() * SHIRTS.length)],
    skin: SKINS[Math.floor(rng.next() * SKINS.length)],
    hat: rng.chance(0.35),
    walkPhase: rng.range(0, 6),
    stateTimer: 0,
    fleeFrom: null,
    gun: false,
  };
}

function blockWaypoints(block) {
  const inset = SIDEWALK / 2 + 1;
  return [
    { x: block.x + inset, y: block.y + inset },
    { x: block.x + BLOCK_SIZE - inset, y: block.y + inset },
    { x: block.x + BLOCK_SIZE - inset, y: block.y + BLOCK_SIZE - inset },
    { x: block.x + inset, y: block.y + BLOCK_SIZE - inset },
  ];
}

export function spawnPedNear(world, focusX, focusY) {
  const blocks = world.city.blocks;
  for (let tries = 0; tries < 10; tries += 1) {
    const block = blocks[Math.floor(world.rng.next() * blocks.length)];
    const cx = block.x + BLOCK_SIZE / 2;
    const cy = block.y + BLOCK_SIZE / 2;
    const dist = Math.hypot(cx - focusX, cy - focusY);
    if (dist < 480 || dist > 1050) continue;
    const wps = blockWaypoints(block);
    const start = wps[Math.floor(world.rng.next() * wps.length)];
    const ped = createPed(world.rng, start.x, start.y, block);
    ped.wp = Math.floor(world.rng.next() * wps.length);
    world.peds.push(ped);
    return true;
  }
  return false;
}

/** A driver bailing out of a stolen or wrecked car, running from whoever caused it. */
export function spawnFleeingDriver(world, car) {
  const ped = createPed(world.rng, car.x + 14, car.y + 10, null);
  ped.state = 'flee';
  ped.stateTimer = 4;
  ped.fleeFrom = { x: world.player.x, y: world.player.y };
  world.peds.push(ped);
}

export function createPedestrians() {
  return { timer: 0 };
}

export function updatePedestrians(world, dt) {
  const focus = world.player.inCar || world.player;
  let walking = 0;
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    const dist = Math.hypot(ped.x - focus.x, ped.y - focus.y);
    if (dist > RECYCLE_DIST && ped.state !== 'down') {
      world.peds.splice(i, 1);
      continue;
    }
    if (ped.state !== 'down') walking += 1;
    stepPed(world, ped, dt);
  }
  world.pedsManager.timer -= dt;
  if (walking < TARGET_COUNT && world.pedsManager.timer <= 0) {
    if (spawnPedNear(world, focus.x, focus.y)) world.pedsManager.timer = 0.25;
    else world.pedsManager.timer = 0.9;
  }
}

function stepPed(world, ped, dt) {
  if (ped.state === 'down') {
    ped.stateTimer -= dt;
    return;
  }
  ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);
  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.state === 'flee') {
    ped.stateTimer -= dt;
    const from = ped.fleeFrom || world.player;
    const away = Math.atan2(ped.y - from.y, ped.x - from.x);
    tx = ped.x + Math.cos(away) * 90;
    ty = ped.y + Math.sin(away) * 90;
    speed = 195;
    if (ped.stateTimer <= 0) {
      ped.state = 'walk';
      ped.block = nearestBlock(world, ped.x, ped.y);
      ped.wp = 0;
    }
  } else {
    if (!ped.block) ped.block = nearestBlock(world, ped.x, ped.y);
    const wps = blockWaypoints(ped.block);
    const target = wps[ped.wp % wps.length];
    tx = target.x;
    ty = target.y;
    if (Math.hypot(tx - ped.x, ty - ped.y) < 6) {
      ped.wp = (ped.wp + 1) % wps.length;
      return;
    }
  }
  const angle = Math.atan2(ty - ped.y, tx - ped.x);
  ped.angle = angle;
  const nx = ped.x + Math.cos(angle) * speed * dt;
  const ny = ped.y + Math.sin(angle) * speed * dt;
  const fixed = collideBuildings(world.city, nx, ny, 8);
  ped.x = fixed.x;
  ped.y = fixed.y;
}

function nearestBlock(world, x, y) {
  let best = world.city.blocks[0];
  let bestDist = Infinity;
  for (const block of world.city.blocks) {
    const d = Math.hypot(block.x + BLOCK_SIZE / 2 - x, block.y + BLOCK_SIZE / 2 - y);
    if (d < bestDist) {
      bestDist = d;
      best = block;
    }
  }
  return best;
}

/** Something frightening happened at (x, y): everyone close runs from it. */
export function scarePeds(world, x, y, radius) {
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.stateTimer = world.rng.range(2.2, 3.6);
      ped.fleeFrom = { x, y };
    }
  }
}

/** A car met a person. Fast enough, the person goes down; slow, they shove off and run. */
export function hitPedByCar(world, ped, car) {
  if (ped.state === 'down') return false;
  if (Math.abs(car.speed) > 55) {
    ped.state = 'down';
    ped.stateTimer = 26;
    ped.health = 0;
    return true;
  }
  ped.state = 'flee';
  ped.stateTimer = 2.5;
  ped.fleeFrom = { x: car.x, y: car.y };
  return false;
}

export function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(20,16,8,0.25)';
    ctx.fillRect(-11, 3, 22, 7);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-10, -3, 20, 7);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(ped.angle);
  // Shadow
  ctx.fillStyle = 'rgba(20,16,8,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 8, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs, swinging with the walk cycle
  const swing = Math.sin(ped.walkPhase) * 4;
  ctx.fillStyle = '#33404f';
  ctx.fillRect(-2 + swing * 0.4, -4.5, 6, 3.4);
  ctx.fillRect(-2 - swing * 0.4, 1.1, 6, 3.4);
  // Body
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.4, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(3.4, 0, 3.9, 0, Math.PI * 2);
  ctx.fill();
  if (ped.hat) {
    ctx.fillStyle = '#f7f0e1';
    ctx.beginPath();
    ctx.arc(3.4, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(4.2, 0, 3.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // A gun in hand marks a hostile; the renderer of combat draws the same people.
  if (ped.gun) {
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(6, 2.5, 9, 2.4);
  }
  void time;
  ctx.restore();
}
