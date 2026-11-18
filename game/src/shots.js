// The screenshot scenes behind ?shot=cover|chase|foot|mission. Each one builds the real
// world from the seed, places Marco and the city into a moment the game itself could reach —
// a drive downtown mid-job, a four-star chase on the Strip, a crowded sidewalk, a firefight
// at the marina cash office — then plays the real rules forward for a fixed number of steps
// with a scripted driver, so the frame is the game, honestly rendered, and the same seed
// always gives the same frame.
import { COLS, blockOrigin, roadCenterX, roadCenterY } from './city.js';
import { chooseNextNode, lanePosition } from './roads.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { spawnThug } from './combat.js';

const STEP = 1 / 60;

function scriptedInput(axis, mouse) {
  return {
    mouse: mouse || { x: 900, y: 340, down: false, pressed: false, rightDown: false },
    down: () => false,
    pressed: () => false,
    axis: () => axis,
    endFrame: () => {},
  };
}

function runSteps(world, steps, input) {
  for (let i = 0; i < steps; i += 1) world.update(STEP, input);
}

function putPlayerInCar(world, typeKey, x, y, angle, speed) {
  const car = createCar(world.rng, typeKey, x, y, angle);
  car.driver = 'player';
  car.speed = speed;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = x;
  world.player.y = y;
  return car;
}

function addTrafficCar(world, i, j) {
  const node = { i, j };
  const next = chooseNextNode(world.rng, i, j, i, j);
  const pos = lanePosition(node.i, node.j, next.i, next.j, world.rng.range(0.1, 0.5));
  const types = ['sable', 'vireo', 'kestrel', 'bruto', 'tortuga'];
  const car = createCar(world.rng, types[Math.floor(world.rng.next() * types.length)], pos.x, pos.y, pos.angle);
  car.driver = 'traffic';
  car.traffic = { fi: node.i, fj: node.j, ti: next.i, tj: next.j, t: 0.3, cruise: world.rng.range(110, 160), panic: 0 };
  const placed = lanePosition(node.i, node.j, next.i, next.j, car.traffic.t);
  car.x = placed.x;
  car.y = placed.y;
  car.angle = placed.angle;
  world.cars.push(car);
  return car;
}

function addCop(world, x, y, angle) {
  const car = createCar(world.rng, 'interceptor', x, y, angle);
  car.driver = 'police';
  car.cop = { stuckTimer: 0, lastX: x, lastY: y };
  world.cars.push(car);
  return car;
}

function addPedOnSidewalk(world, blockCol, blockRow, fx, fy) {
  const origin = blockOrigin(blockCol, blockRow);
  const block = world.city.blocks[blockRow * COLS + blockCol];
  const ped = createPed(world.rng, origin.x + fx, origin.y + fy, block);
  ped.wp = Math.floor(world.rng.next() * 4);
  world.peds.push(ped);
  return ped;
}

/** 1-cover: Marco in a Marlin GT on a downtown avenue, mid-delivery, traffic all around. */
function stageCover(world) {
  const avenueX = roadCenterX(7);
  world.missions.index = 1;
  world.missions.active = true;
  world.missions.step = 1;
  world.missions.data = { heatTimer: 999, heatSet: true };
  world.money = 430;
  world.respect = 1;
  // Start mid-block, well clear of the crossing, so the frame catches the car in motion
  // with same-lane traffic ahead instead of a jam at the lights.
  putPlayerInCar(world, 'marlin', avenueX + 12, 1690, -Math.PI / 2, 215);
  addTrafficCar(world, 7, 6);
  addTrafficCar(world, 7, 7);
  addTrafficCar(world, 8, 6);
  addTrafficCar(world, 6, 6);
  addTrafficCar(world, 8, 5);
  addPedOnSidewalk(world, 6, 5, 30, 20);
  addPedOnSidewalk(world, 7, 5, 150, 160);
  runSteps(world, 62, scriptedInput({ x: 0, y: -1 }));
  // The cover is a clean drive: whatever the traffic did, Marco starts the frame unhunted.
  world.police.stars = 0;
  world.police.lastSeenTimer = 0;
}

/** 2-chase: four stars on the Strip, cruisers on the bumper, the heat objective on the HUD. */
function stageChase(world) {
  const stripY = roadCenterY(7);
  world.missions.index = 3;
  world.missions.active = true;
  world.missions.step = 2;
  world.missions.wantedFloor = 3;
  world.money = 1060;
  world.respect = 3;
  world.police.stars = 4;
  const car = putPlayerInCar(world, 'kestrel', roadCenterX(10) + 60, stripY + 12, 0, 265);
  void car;
  addCop(world, roadCenterX(10) - 60, stripY + 12, 0);
  addCop(world, roadCenterX(10) - 170, stripY - 12, 0);
  addCop(world, roadCenterX(9) + 40, stripY + 12, 0);
  addTrafficCar(world, 12, 7);
  addTrafficCar(world, 13, 6);
  addPedOnSidewalk(world, 11, 6, 40, 170);
  runSteps(world, 80, scriptedInput({ x: 0, y: -1 }));
  world.police.stars = 4;
}

/** 3-foot: Marco on a crowded Strip sidewalk at golden hour, Vera waiting at the motel. */
function stageFoot(world) {
  const origin = blockOrigin(11, 6);
  world.missions.index = 2;
  world.money = 690;
  world.respect = 2;
  world.player.x = origin.x + 92;
  world.player.y = origin.y - 10;
  world.player.angle = 0.3;
  // A knot of strollers on Marco's own stretch of pavement, more across the street.
  addPedOnSidewalk(world, 11, 6, 30, 14);
  addPedOnSidewalk(world, 11, 6, 62, 6);
  addPedOnSidewalk(world, 11, 6, 128, 16);
  addPedOnSidewalk(world, 11, 6, 150, 8);
  addPedOnSidewalk(world, 11, 6, 176, 90);
  addPedOnSidewalk(world, 12, 6, 24, 168);
  addPedOnSidewalk(world, 11, 5, 90, 168);
  addPedOnSidewalk(world, 12, 5, 40, 160);
  addPedOnSidewalk(world, 10, 6, 160, 12);
  addPedOnSidewalk(world, 12, 6, 90, 176);
  runSteps(world, 55, scriptedInput({ x: 0, y: 0 }));
}

/** 4-mission: the cash-office grab — Marco in a firefight with the Vultures, mid-hold. */
function stageMission(world) {
  const office = world.city.landmarks.cashOffice;
  world.missions.index = 3;
  world.missions.active = true;
  world.missions.step = 1;
  world.missions.data = { holdTimer: 2.2 };
  world.money = 860;
  world.respect = 3;
  world.player.x = office.x - 26;
  world.player.y = office.y + 6;
  world.player.angle = 0.15;
  // The guards close in on the pavement south of the office, in plain sight of the camera.
  spawnThug(world, office.x + 62, office.y + 30);
  spawnThug(world, office.x + 96, office.y + 58);
  spawnThug(world, office.x + 30, office.y + 74);
  // Settle the fight for a second, then fire one aimed shot in the final step so the
  // frame catches the muzzle flash and the tracer on their way out.
  runSteps(world, 42, scriptedInput({ x: 0, y: 0 }, { x: 1010, y: 330, down: false, pressed: false, rightDown: false }));
  const aim = { x: 1080, y: 350, down: true, pressed: true, rightDown: false };
  runSteps(world, 1, scriptedInput({ x: 0, y: 0 }, aim));
  world.player.health = 62;
  world.police.stars = 2;
  world.police.lastSeenTimer = 0;
}

/** Set the world to the named scene; any other name is the cover. */
export function stageShot(world, name) {
  if (name === 'chase') stageChase(world);
  else if (name === 'foot') stageFoot(world);
  else if (name === 'mission') stageMission(world);
  else stageCover(world);
  // Centre the camera on the action before the first painted frame.
  const focus = world.player.inCar || world.player;
  world.camera.x = Math.max(0, Math.min(world.city.width - world.view.w, focus.x - world.view.w / 2));
  world.camera.y = Math.max(0, Math.min(world.city.height - world.view.h, focus.y - world.view.h / 2));
}
