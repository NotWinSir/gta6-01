// The cars of Coral Bay: six civilian models with their own pace and toughness, plus the
// police Interceptor. This file owns what a car is, the arcade physics of the car the player
// drives, the collisions every car shares, and how a car is drawn — a rounded body, glass,
// wheels that visibly steer, and a light bar on the police cars.
import { BLOCK_SIZE, ROAD_WIDTH, blockOrigin, collideBuildings } from './city.js';

export const CAR_TYPES = {
  vireo: { name: 'Vireo Hatch', maxSpeed: 235, accel: 190, health: 80, value: 120, length: 62, width: 30 },
  sable: { name: 'Sable Sedan', maxSpeed: 285, accel: 215, health: 100, value: 220, length: 72, width: 32 },
  bruto: { name: 'Bruto Pickup', maxSpeed: 255, accel: 200, health: 150, value: 260, length: 78, width: 36 },
  kestrel: { name: 'Kestrel Coupe', maxSpeed: 345, accel: 275, health: 90, value: 420, length: 70, width: 32 },
  marlin: { name: 'Marlin GT', maxSpeed: 395, accel: 320, health: 85, value: 650, length: 74, width: 34 },
  tortuga: { name: 'Tortuga Van', maxSpeed: 215, accel: 165, health: 160, value: 200, length: 82, width: 38 },
  interceptor: { name: 'CBPD Interceptor', maxSpeed: 360, accel: 300, health: 170, value: 0, length: 76, width: 34 },
};

export const CAR_COLORS = ['#d94f30', '#e8a13a', '#3a7ca5', '#53a06b', '#e3ddcf', '#5b5f6e', '#8e44ad', '#c94f7c', '#2e86ab', '#f2f0d5'];
const CIVILIAN_TYPES = ['vireo', 'sable', 'bruto', 'kestrel', 'marlin', 'tortuga'];

let nextCarId = 1;

export function createCar(rng, typeKey, x, y, angle) {
  const type = CAR_TYPES[typeKey];
  return {
    id: nextCarId++,
    typeKey,
    typeName: type.name,
    x, y, angle,
    speed: 0,
    steerVis: 0,
    length: type.length,
    width: type.width,
    radius: type.length * 0.34,
    color: typeKey === 'interceptor' ? '#f2f4f6' : CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)],
    maxSpeed: type.maxSpeed,
    accel: type.accel,
    maxHealth: type.health,
    health: type.health,
    value: type.value,
    driver: null, // null = parked | 'player' | 'traffic' | 'police' | 'thug'
    police: typeKey === 'interceptor',
    traffic: null, // traffic.js route state, when driver is traffic
    cop: null, // police.js state, when driver is police
    honkCd: 0,
    wrecked: false,
    doorOpen: 0,
  };
}

export function randomCivilianType(rng) {
  const roll = rng.next();
  if (roll < 0.3) return 'vireo';
  if (roll < 0.55) return 'sable';
  if (roll < 0.68) return 'bruto';
  if (roll < 0.82) return 'kestrel';
  if (roll < 0.9) return 'marlin';
  return 'tortuga';
}

/**
 * The arcade drive model for the player's car. throttle is -1..1 (brake/reverse below 0),
 * steer is -1..1. Returns the impact strength of any building strike this step, else 0.
 */
export function driveCar(car, dt, throttle, steer, city) {
  const reversing = car.speed < -1;
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 12) car.speed -= 340 * dt; // braking
    else car.speed += car.accel * 0.55 * throttle * dt; // reverse
  }
  const drag = car.speed * 0.55 * dt;
  car.speed -= drag;
  if (throttle === 0) car.speed -= car.speed * 1.4 * dt;
  const maxReverse = -car.maxSpeed * 0.38;
  car.speed = Math.max(maxReverse, Math.min(car.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const steerAuthority = Math.max(-1, Math.min(1, car.speed / 90));
  car.angle += steer * 2.35 * steerAuthority * dt * (reversing ? -1 : 1) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.steerVis += (steer * 0.5 - car.steerVis) * Math.min(1, dt * 10);

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;

  // Buildings: probe the nose and the tail; a strike stops the car dead and costs health.
  let impact = 0;
  const probeR = car.width * 0.52;
  for (const sign of [1, -1]) {
    const px = car.x + Math.cos(car.angle) * (car.length / 2 - 4) * sign;
    const py = car.y + Math.sin(car.angle) * (car.length / 2 - 4) * sign;
    const fixed = collideBuildings(city, px, py, probeR);
    if (Math.abs(fixed.x - px) > 0.01 || Math.abs(fixed.y - py) > 0.01) {
      car.x += fixed.x - px;
      car.y += fixed.y - py;
      impact = Math.max(impact, Math.abs(car.speed));
    }
  }
  if (impact > 0) {
    car.health -= impact * 0.045;
    car.speed = impact > 130 ? -car.speed * 0.18 : 0;
  }
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.health = 0;
  }
  return impact;
}

/** Circle collision between two cars: push apart, trade momentum, share the damage. */
export function collideCarPair(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = a.radius + b.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDist * minDist || d2 === 0) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (minDist - d) / 2;
  const aMovable = a.driver !== null || true;
  void aMovable;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const closing = Math.abs(a.speed) + Math.abs(b.speed);
  const impact = closing * (1 - d / minDist) + Math.min(a.speed !== 0 || b.speed !== 0 ? 26 : 0, 26);
  if (impact > 24) {
    const dmg = (impact - 24) * 0.06;
    a.health -= dmg;
    b.health -= dmg;
    const swap = (a.speed + b.speed) / 2;
    a.speed = swap * 0.6;
    b.speed = swap * 0.6;
    if (a.health <= 0) a.wrecked = true;
    if (b.health <= 0) b.wrecked = true;
    return impact;
  }
  return 0;
}

/** Parked cars along the kerbs: a spread of civilian models waiting to be borrowed. */
export function spawnParkedCars(city, rng) {
  const cars = [];
  const attempts = 90;
  for (let n = 0; n < attempts && cars.length < 30; n += 1) {
    const col = rng.int(0, 15);
    const row = rng.int(0, 11);
    const origin = blockOrigin(col, row);
    const side = rng.int(0, 3);
    let x;
    let y;
    let angle;
    if (side === 0) {
      x = origin.x + rng.range(20, BLOCK_SIZE - 20);
      y = origin.y - ROAD_WIDTH / 2 + 10;
      angle = 0;
    } else if (side === 1) {
      x = origin.x + rng.range(20, BLOCK_SIZE - 20);
      y = origin.y + BLOCK_SIZE + ROAD_WIDTH / 2 - 10;
      angle = Math.PI;
    } else if (side === 2) {
      x = origin.x - ROAD_WIDTH / 2 + 10;
      y = origin.y + rng.range(20, BLOCK_SIZE - 20);
      angle = Math.PI / 2;
    } else {
      x = origin.x + BLOCK_SIZE + ROAD_WIDTH / 2 - 10;
      y = origin.y + rng.range(20, BLOCK_SIZE - 20);
      angle = -Math.PI / 2;
    }
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 70)) continue;
    cars.push(createCar(rng, randomCivilianType(rng), x, y, angle));
  }
  return cars;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw one car, top-down, nose pointing along +x before rotation. */
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.length;
  const W = car.width;
  // Shadow
  ctx.fillStyle = 'rgba(20, 16, 8, 0.30)';
  roundRectPath(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 9);
  ctx.fill();
  // Body
  ctx.fillStyle = car.wrecked ? '#3d3a36' : car.color;
  roundRectPath(ctx, -L / 2, -W / 2, L, W, 9);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#20303e';
    roundRectPath(ctx, -L * 0.18, -W / 2, L * 0.4, W, 4);
    ctx.fill();
    ctx.fillStyle = '#f2f4f6';
    roundRectPath(ctx, -L / 2, -W / 2, L * 0.3, W, 9);
    ctx.fill();
    roundRectPath(ctx, L * 0.24, -W / 2, L * 0.26, W, 9);
    ctx.fill();
  }
  // Cabin glass
  ctx.fillStyle = 'rgba(24, 42, 56, 0.92)';
  roundRectPath(ctx, -L * 0.16, -W / 2 + 4, L * 0.34, W - 8, 5);
  ctx.fill();
  // Windshield shine
  ctx.fillStyle = 'rgba(190, 230, 245, 0.5)';
  roundRectPath(ctx, L * 0.1, -W / 2 + 5, L * 0.07, W - 10, 3);
  ctx.fill();
  // Roof
  ctx.fillStyle = car.wrecked ? '#2f2c28' : car.color;
  roundRectPath(ctx, -L * 0.13, -W / 2 + 6, L * 0.22, W - 12, 4);
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#15161a';
  const wy = W / 2 - 2;
  const wx = L / 2 - 11;
  for (const [sx, sy, steered] of [[1, -1, true], [1, 1, true], [-1, -1, false], [-1, 1, false]]) {
    ctx.save();
    ctx.translate(sx * wx, sy * wy);
    if (steered) ctx.rotate(car.steerVis);
    ctx.fillRect(-6, -3, 12, 6);
    ctx.restore();
  }
  // Headlights and tail lights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 6);
  ctx.fillRect(L / 2 - 3, W / 2 - 10, 3, 6);
  ctx.fillStyle = '#d23b2e';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 6);
  ctx.fillRect(-L / 2, W / 2 - 10, 3, 6);
  // Police light bar: alternating red and blue, strobing with time.
  if (car.police && !car.wrecked) {
    const phase = Math.floor(time * 6 + car.id) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5e2b97';
    roundRectPath(ctx, -8, -W / 2 + 5, 7, W - 10, 2);
    ctx.fill();
    ctx.fillStyle = phase ? '#2b6cff' : '#971f1f';
    roundRectPath(ctx, 1, -W / 2 + 5, 7, W - 10, 2);
    ctx.fill();
    ctx.fillStyle = phase ? 'rgba(255,59,48,0.20)' : 'rgba(43,108,255,0.20)';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
