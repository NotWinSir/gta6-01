// The world: one object holding the whole simulation — the city, Marco, every car, pedestrian,
// thug, bullet and dollar — and the step that advances it. The systems live in their own files
// (traffic, police, combat, missions); this file owns the interactions between them: getting
// in and out of cars, carjacking, running someone over, selling a car to the chop shop, and
// what happens when the chase ends with Marco busted or wasted.
import { createRng } from './rng.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCar, driveCar, collideCarPair, spawnParkedCars } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians, spawnFleeingDriver, hitPedByCar } from './pedestrians.js';
import { createPolice, updatePolice, reportCrime, clearWanted } from './police.js';
import { createCombat, updateCombat, burstParticles } from './combat.js';
import { createMissions, updateMissions, failMission, notifyThugDown } from './missions.js';
import { writeSave } from './save.js';

export function createWorld(seed) {
  const rng = createRng(seed);
  const city = createCity(rng);
  const spawn = city.landmarks.spawn;
  const world = {
    seed,
    rng,
    city,
    audio: createAudio(),
    time: 0,
    playSeconds: 0,
    player: createPlayer(spawn.x, spawn.y),
    cars: [],
    peds: [],
    thugs: [],
    bullets: [],
    particles: [],
    pickups: [],
    texts: [],
    traffic: createTraffic(),
    pedsManager: createPedestrians(),
    police: createPolice(),
    combat: createCombat(),
    missions: createMissions(),
    money: 40,
    respect: 0,
    camera: { x: spawn.x - 640, y: spawn.y - 360 },
    view: { w: 1280, h: 720 },
    banner: null,
    toast: null,
    busted: false,
    wasted: false,
    saveTimer: 12,
    smokeTimer: 0,

    screenToWorld(sx, sy) {
      return { x: sx + world.camera.x, y: sy + world.camera.y };
    },
    showBanner(title, sub, seconds) {
      world.banner = { title, sub, until: world.time + seconds };
    },
    showToast(text, seconds) {
      world.toast = { text, until: world.time + seconds };
    },
    floatText(x, y, text, color) {
      world.texts.push({ x, y, text, color, life: 1.15 });
    },
    addFleeingDriver(car) {
      spawnFleeingDriver(world, car);
    },
    onThugDown() {
      notifyThugDown(world);
    },
    saveSoon() {
      world.saveTimer = Math.min(world.saveTimer, 2);
    },
    /** Advance the whole simulation one step (the loop in main.js, the scenes in shots.js). */
    update(dt, input) {
      updateWorld(world, dt, input);
    },
  };
  for (const car of spawnParkedCars(city, rng)) world.cars.push(car);
  return world;
}

function nearestEnterableCar(world) {
  const player = world.player;
  let best = null;
  let bestDist = 52;
  for (const car of world.cars) {
    if (car.driver === 'player' || car.driver === 'police') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

function enterCar(world, car) {
  const player = world.player;
  if (car.driver === 'traffic') {
    // Carjacking: the driver bails and runs, and the street remembers.
    spawnFleeingDriver(world, car);
    car.traffic = null;
    const witnessed = world.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - car.x, c.y - car.y) < 460) || world.rng.chance(0.45);
    if (witnessed) reportCrime(world, 1);
    world.showToast(`Carjacked the ${car.typeName}.`, 2.2);
  } else if (world.rng.chance(0.18)) {
    const witnessed = world.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - car.x, c.y - car.y) < 460);
    if (witnessed) reportCrime(world, 1);
  }
  car.driver = 'player';
  player.inCar = car;
  world.audio.doorSlam();
}

function exitCar(world) {
  const player = world.player;
  const car = player.inCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  player.inCar = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * (car.width / 2 + 14);
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * (car.width / 2 + 14);
  world.audio.doorSlam();
  world.audio.setEngine(false, 0, 0);
}

function sellCarToChopShop(world) {
  const player = world.player;
  const car = player.inCar;
  const garage = world.city.landmarks.garage;
  if (!car || car.police) return;
  if (Math.hypot(car.x - garage.x, car.y - garage.y) > 62) return;
  const payout = Math.round(car.value * Math.max(0.15, car.health / car.maxHealth));
  exitCar(world);
  world.cars.splice(world.cars.indexOf(car), 1);
  world.money += payout;
  world.audio.cash();
  world.showToast(`Reyes Auto took the ${car.typeName}: +$${payout}.`, 3);
  world.saveSoon();
}

function drivePlayer(world, dt, input) {
  const player = world.player;
  const car = player.inCar;
  const axis = input.axis();
  const throttle = -axis.y;
  const steer = axis.x;
  const impact = driveCar(car, dt, throttle, steer, world.city);
  if (impact > 120) {
    world.audio.crash(Math.min(1, impact / 320));
    burstParticles(world, car.x, car.y, { count: 8, color: '#e8dcc0', speed: 130, life: 0.4, size: 3 });
    if (impact > 210) reportCrime(world, 1);
  }
  world.audio.setEngine(true, Math.abs(throttle), Math.abs(car.speed) / car.maxSpeed);
  // Wheels meet people.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.radius + 7) {
      if (hitPedByCar(world, ped, car)) {
        world.audio.thud();
        car.speed *= 0.8;
        reportCrime(world, 2);
        burstParticles(world, ped.x, ped.y, { count: 6, color: '#c94f4f', speed: 80, life: 0.35, size: 2.6 });
      }
    }
  }
  for (const thug of world.thugs) {
    if (thug.state === 'down') continue;
    if (Math.hypot(thug.x - car.x, thug.y - car.y) < car.radius + 7 && Math.abs(car.speed) > 120) {
      thug.state = 'down';
      thug.stateTimer = 30;
      thug.health = 0;
      world.onThugDown(thug);
      world.audio.thud();
    }
  }
}

export function updateWorld(world, dt, input) {
  if (world.busted || world.wasted) return;
  world.time += dt;
  world.playSeconds += dt;
  const player = world.player;

  if (input.pressed('KeyE')) {
    if (player.inCar) exitCar(world);
    else {
      const car = nearestEnterableCar(world);
      if (car) enterCar(world, car);
    }
  }
  if (input.pressed('KeyF') && player.inCar) sellCarToChopShop(world);

  updatePlayer(world, dt, input);
  if (player.inCar) drivePlayer(world, dt, input);
  else world.audio.setEngine(false, 0, 0);

  // Car on car: every pair, pushed apart with shared damage.
  for (let i = 0; i < world.cars.length; i += 1) {
    for (let j = i + 1; j < world.cars.length; j += 1) {
      const a = world.cars[i];
      const b = world.cars[j];
      if (Math.abs(a.x - b.x) > 130 || Math.abs(a.y - b.y) > 130) continue;
      const impact = collideCarPair(a, b);
      if (impact > 40) {
        world.audio.crash(Math.min(1, impact / 260));
        if ((a.driver === 'player' && b.police) || (b.driver === 'player' && a.police)) reportCrime(world, 3);
        else if (a.driver === 'player' || b.driver === 'player') reportCrime(world, 1);
      }
    }
  }

  // Gunfire panics nearby traffic.
  if (world.bullets.length > 0) {
    for (const car of world.cars) {
      if (car.driver === 'traffic' && Math.hypot(car.x - player.x, car.y - player.y) < 250) car.traffic.panic = 1.4;
    }
  }

  updateTraffic(world, dt);
  updatePedestrians(world, dt);
  updatePolice(world, dt);
  updateCombat(world, dt, input);
  updateMissions(world, dt);

  // Damaged cars smoke.
  world.smokeTimer -= dt;
  if (world.smokeTimer <= 0) {
    world.smokeTimer = 0.12;
    for (const car of world.cars) {
      if (car.health < car.maxHealth * 0.45 && Math.hypot(car.x - player.x, car.y - player.y) < 800) {
        world.particles.push({
          x: car.x + world.rng.range(-8, 8), y: car.y + world.rng.range(-8, 8),
          vx: 0, vy: 0, life: world.rng.range(0.5, 0.9), maxLife: 0.9,
          color: car.wrecked ? '#2c2c2c' : '#9a9a92', size: world.rng.range(5, 9), rise: true,
        });
      }
    }
  }

  // Camera: follow the man or the car, leaning into the motion.
  const focus = player.inCar || player;
  const lead = player.inCar ? 0.42 : 0.18;
  const tx = focus.x + Math.cos(focus.angle) * (focus.speed || 0) * lead - world.view.w / 2;
  const ty = focus.y + Math.sin(focus.angle) * (focus.speed || 0) * lead - world.view.h / 2;
  const ease = Math.min(1, dt * 5);
  world.camera.x += (Math.max(0, Math.min(world.city.width - world.view.w, tx)) - world.camera.x) * ease;
  world.camera.y += (Math.max(0, Math.min(world.city.height - world.view.h, ty)) - world.camera.y) * ease;

  if (world.banner && world.time > world.banner.until) world.banner = null;
  if (world.toast && world.time > world.toast.until) world.toast = null;

  world.saveTimer -= dt;
  if (world.saveTimer <= 0) {
    world.saveTimer = 25;
    writeSave(world);
  }
}

/** After a bust or a wasting: Marco wakes at the station or the hospital, poorer and free. */
export function respawnAfterIncident(world, kind) {
  const player = world.player;
  const L = world.city.landmarks;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  const fine = kind === 'busted' ? 150 : 120;
  world.money = Math.max(0, world.money - fine);
  const spot = kind === 'busted' ? L.policeHQ : L.hospital;
  player.x = spot.x;
  player.y = spot.y;
  player.health = player.maxHealth;
  player.sinceHurt = 99;
  clearWanted(world);
  failMission(world, kind === 'busted' ? 'The CBPD took you in.' : 'You woke up at St. Marina General.');
  world.busted = false;
  world.wasted = false;
  world.audio.setEngine(false, 0, 0);
  world.audio.setSiren(0);
  world.saveSoon();
}
