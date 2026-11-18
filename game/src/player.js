// Marco Reyes, on foot: the ex-wheelman the player walks around Coral Bay when he is not
// behind a wheel. He walks and runs on the keyboard axis, turns toward the mouse when he is
// aiming, and is drawn as a man in a teal shirt and a ball cap — distinct from the crowd at
// a glance, which matters when the police are describing him.
import { collideBuildings } from './city.js';

export const PLAYER_RADIUS = 10;
const WALK_SPEED = 152;
const RUN_SPEED = 242;

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: PLAYER_RADIUS,
    health: 100,
    maxHealth: 100,
    inCar: null,
    walkPhase: 0,
    moving: false,
    hurtTimer: 0,
    sinceHurt: 99,
  };
}

/**
 * Move Marco for one step. When he is driving, his position is his car's; this only runs on
 * foot. Aiming (mouse held) turns him toward the cursor; otherwise he faces his movement.
 */
export function updatePlayer(world, dt, input) {
  const player = world.player;
  if (player.inCar) {
    player.x = player.inCar.x;
    player.y = player.inCar.y;
    player.angle = player.inCar.angle;
    return;
  }
  player.sinceHurt += dt;
  if (player.sinceHurt > 6 && player.health > 0 && player.health < player.maxHealth) {
    player.health = Math.min(player.maxHealth, player.health + dt * 3.2);
  }
  const axis = input.axis();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  player.moving = axis.x !== 0 || axis.y !== 0;
  if (player.moving) {
    const nx = player.x + axis.x * speed * dt;
    const ny = player.y + axis.y * speed * dt;
    const fixed = collideBuildings(world.city, nx, ny, PLAYER_RADIUS);
    player.x = fixed.x;
    player.y = fixed.y;
    player.walkPhase += dt * (running ? 12.5 : 9);
    if (!input.mouse.down) player.angle = Math.atan2(axis.y, axis.x);
  }
  if (input.mouse.down) {
    const worldMouse = world.screenToWorld(input.mouse.x, input.mouse.y);
    player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);
  }
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
}

export function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  // Shadow
  ctx.fillStyle = 'rgba(20,16,8,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const swing = player.moving ? Math.sin(player.walkPhase) * 4.4 : 0;
  // Legs — dark jeans
  ctx.fillStyle = '#26303c';
  ctx.fillRect(-2 + swing * 0.4, -5, 6.6, 3.8);
  ctx.fillRect(-2 - swing * 0.4, 1.2, 6.6, 3.8);
  // Body — teal shirt, Marco's signature
  ctx.fillStyle = player.hurtTimer > 0 ? '#b8402f' : '#12808a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms: one reaches forward when aiming with the mouse held
  ctx.fillStyle = '#d9a066';
  if (player.aiming) {
    ctx.fillRect(4, 2.6, 8, 3);
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(11, 2.8, 9, 2.6);
  }
  // Head and cap
  ctx.fillStyle = '#a9744f';
  ctx.beginPath();
  ctx.arc(3.6, 0, 4.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2574c';
  ctx.beginPath();
  ctx.arc(3.2, 0, 4.4, Math.PI * 0.75, Math.PI * 1.85);
  ctx.fill();
  ctx.fillRect(4.5, -4.6, 4.6, 2.6);
  void time;
  ctx.restore();
}
