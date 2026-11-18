// Combat: Marco's pistol against the Vultures crew. Shooting is mouse-aimed from the
// shoulder — hold the button and he turns to the cursor and fires, twelve rounds and a
// reload. The crew fights back from mid-range, strafing and firing in bursts. Every shot is
// a fast tracer that buildings and cars stop; every public shot is also a crime the police
// file away. Particles — muzzle flash, dust, sparks, smoke — live here too, since most of
// them are born from violence.
import { buildingAt } from './city.js';
import { createPed, scarePeds } from './pedestrians.js';
import { reportCrime } from './police.js';

const BULLET_SPEED = 780;
const BULLET_RANGE = 470;
const MAG_SIZE = 12;

export function createCombat() {
  return { fireCd: 0, shotsInMag: MAG_SIZE, reloadTimer: 0 };
}

export function spawnThug(world, x, y) {
  const thug = createPed(world.rng, x, y, null);
  thug.gun = true;
  thug.shirt = '#3a3f4a';
  thug.hat = false;
  thug.health = 60;
  thug.state = 'fight';
  thug.shootCd = world.rng.range(0.4, 1.4);
  thug.strafeDir = world.rng.chance(0.5) ? 1 : -1;
  thug.strafeTimer = world.rng.range(1, 2.4);
  world.thugs.push(thug);
  return thug;
}

export function burstParticles(world, x, y, options) {
  const { count, color, speed, life, size, spread } = options;
  for (let i = 0; i < count; i += 1) {
    const angle = world.rng.range(0, Math.PI * 2);
    const v = world.rng.range(speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: world.rng.range(life * 0.5, life),
      maxLife: life,
      color,
      size: world.rng.range(size * 0.6, size * 1.3),
      spread: spread || 0,
    });
  }
}

export function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      world.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
    if (p.rise) p.y -= 26 * dt;
  }
}

function fireBullet(world, from, x, y, angle, spread) {
  const a = angle + world.rng.range(-spread, spread);
  world.bullets.push({
    x, y,
    vx: Math.cos(a) * BULLET_SPEED,
    vy: Math.sin(a) * BULLET_SPEED,
    life: BULLET_RANGE / BULLET_SPEED,
    from,
  });
  burstParticles(world, x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, {
    count: 3, color: '#ffd76a', speed: 60, life: 0.12, size: 3,
  });
}

function playerShoot(world, input, dt) {
  const combat = world.combat;
  const player = world.player;
  player.aiming = !player.inCar && input.mouse.down;
  if (player.inCar) return;
  combat.fireCd -= dt;
  if (combat.reloadTimer > 0) {
    combat.reloadTimer -= dt;
    if (combat.reloadTimer <= 0) combat.shotsInMag = MAG_SIZE;
    return;
  }
  if (!input.mouse.down) return;
  if (combat.fireCd > 0) return;
  if (combat.shotsInMag <= 0) {
    world.audio.dryFire();
    combat.reloadTimer = 0.95;
    combat.fireCd = 0.3;
    return;
  }
  combat.fireCd = 0.155;
  combat.shotsInMag -= 1;
  const muzzleX = player.x + Math.cos(player.angle) * 16;
  const muzzleY = player.y + Math.sin(player.angle) * 16;
  fireBullet(world, 'player', muzzleX, muzzleY, player.angle, 0.035);
  world.audio.shot();
  scarePeds(world, player.x, player.y, 240);
  // A shot fired in public is a two-star crime when anyone is around to hear it.
  const witnessed = world.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - player.x, c.y - player.y) < 420)
    || world.peds.some((p) => Math.hypot(p.x - player.x, p.y - player.y) < 260);
  if (witnessed) reportCrime(world, 2);
}

function thugShoot(world, thug, dt) {
  thug.shootCd -= dt;
  const player = world.player;
  const dist = Math.hypot(player.x - thug.x, player.y - thug.y);
  if (thug.shootCd > 0 || dist > 300) return;
  thug.shootCd = world.rng.range(0.85, 1.6);
  const angle = Math.atan2(player.y - thug.y, player.x - thug.x);
  fireBullet(world, 'thug', thug.x + Math.cos(angle) * 14, thug.y + Math.sin(angle) * 14, angle, 0.085);
  world.audio.shot();
}

function stepThug(world, thug, dt) {
  if (thug.state === 'down') {
    thug.stateTimer -= dt;
    return;
  }
  const player = world.player;
  const dist = Math.hypot(player.x - thug.x, player.y - thug.y);
  thug.walkPhase += dt * 8;
  thug.strafeTimer -= dt;
  if (thug.strafeTimer <= 0) {
    thug.strafeDir *= -1;
    thug.strafeTimer = world.rng.range(0.9, 2.2);
  }
  // Hold a fighting distance: close in past 190, back off inside 105, strafe between.
  let mx = 0;
  let my = 0;
  const toward = Math.atan2(player.y - thug.y, player.x - thug.x);
  if (dist > 190) {
    mx = Math.cos(toward);
    my = Math.sin(toward);
  } else if (dist < 105) {
    mx = -Math.cos(toward);
    my = -Math.sin(toward);
  }
  mx += Math.cos(toward + Math.PI / 2) * thug.strafeDir * 0.7;
  my += Math.sin(toward + Math.PI / 2) * thug.strafeDir * 0.7;
  const len = Math.hypot(mx, my) || 1;
  thug.x += (mx / len) * 92 * dt;
  thug.y += (my / len) * 92 * dt;
  thug.angle = toward;
  thugShoot(world, thug, dt);
}

function hurtPlayer(world, damage) {
  const player = world.player;
  if (player.inCar) {
    player.inCar.health -= damage * 0.55;
    if (player.inCar.health <= 0) player.inCar.wrecked = true;
    return;
  }
  player.health -= damage;
  player.hurtTimer = 0.25;
  player.sinceHurt = 0;
  world.audio.thud();
  if (player.health <= 0) {
    player.health = 0;
    world.wasted = true;
  }
}

function stepBullet(world, bullet, dt) {
  bullet.life -= dt;
  if (bullet.life <= 0) return false;
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
  if (buildingAt(world.city, bullet.x, bullet.y)) {
    burstParticles(world, bullet.x, bullet.y, { count: 4, color: '#e8dcc0', speed: 90, life: 0.3, size: 2.4 });
    return false;
  }
  // Cars are cover for everyone.
  for (const car of world.cars) {
    if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < car.radius) {
      car.health -= bullet.from === 'player' ? 9 : 6;
      if (car.health <= 0) car.wrecked = true;
      burstParticles(world, bullet.x, bullet.y, { count: 5, color: '#ffd76a', speed: 120, life: 0.25, size: 2.2 });
      if (bullet.from === 'player' && car.police) reportCrime(world, 4);
      world.audio.scrape();
      return false;
    }
  }
  if (bullet.from === 'player') {
    for (const thug of world.thugs) {
      if (thug.state !== 'down' && Math.hypot(thug.x - bullet.x, thug.y - bullet.y) < 11) {
        thug.health -= 34;
        burstParticles(world, bullet.x, bullet.y, { count: 6, color: '#c94f4f', speed: 80, life: 0.35, size: 2.6 });
        if (thug.health <= 0) {
          thug.state = 'down';
          thug.stateTimer = 30;
          world.audio.thud();
          if (world.rng.chance(0.45)) {
            world.pickups.push({ x: thug.x, y: thug.y, kind: 'cash', value: world.rng.int(30, 90), bob: world.rng.range(0, 6) });
          }
          world.onThugDown(thug);
        }
        return false;
      }
    }
    for (const ped of world.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 9) {
        ped.state = 'down';
        ped.stateTimer = 26;
        ped.health = 0;
        reportCrime(world, 3);
        scarePeds(world, bullet.x, bullet.y, 260);
        return false;
      }
    }
  } else if (!world.player.inCar) {
    const player = world.player;
    if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < 11) {
      hurtPlayer(world, world.rng.range(5, 10));
      burstParticles(world, bullet.x, bullet.y, { count: 5, color: '#c94f4f', speed: 70, life: 0.3, size: 2.4 });
      return false;
    }
  } else {
    const car = world.player.inCar;
    if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < car.radius) {
      hurtPlayer(world, world.rng.range(5, 10));
      return false;
    }
  }
  return true;
}

export function updateCombat(world, dt, input) {
  playerShoot(world, input, dt);
  for (const thug of world.thugs) stepThug(world, thug, dt);
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    if (!stepBullet(world, world.bullets[i], dt)) world.bullets.splice(i, 1);
  }
  // Pickups: walk or drive over cash and aid to collect them.
  const focus = world.player.inCar || world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    if (Math.hypot(pickup.x - focus.x, pickup.y - focus.y) < (world.player.inCar ? 40 : 20)) {
      if (pickup.kind === 'cash') {
        world.money += pickup.value;
        world.audio.cash();
        world.floatText(pickup.x, pickup.y - 14, `+$${pickup.value}`, '#8be08b');
      } else {
        world.player.health = Math.min(world.player.maxHealth, world.player.health + 35);
        world.audio.pickup();
        world.floatText(pickup.x, pickup.y - 14, '+35 HP', '#7fd4f2');
      }
      world.pickups.splice(i, 1);
    }
  }
  updateParticles(world, dt);
  for (let i = world.texts.length - 1; i >= 0; i -= 1) {
    const text = world.texts[i];
    text.life -= dt;
    text.y -= 26 * dt;
    if (text.life <= 0) world.texts.splice(i, 1);
  }
}
