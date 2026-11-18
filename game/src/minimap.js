// The minimap: the whole of Coral Bay squeezed into a corner card — ocean, avenues, the
// sand of Playa Verde — with the blips that matter: Marco's white arrow, the gold objective,
// Vera's cyan meeting point, the green hideouts, the orange chop shop, and police cruisers
// flashing red and blue. It is drawn from the same city data as the world, so it never lies.
import { COLS, PITCH, ROAD_WIDTH, ROWS } from './city.js';

export const MINIMAP_W = 198;
export const MINIMAP_H = 150;

export function drawMinimap(ctx, world, objective, x, y) {
  const city = world.city;
  const sx = MINIMAP_W / city.width;
  const sy = MINIMAP_H / city.height;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, MINIMAP_W, MINIMAP_H, 8);
  ctx.clip();
  // Ocean and land.
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(x, y, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = '#d8cb9e';
  ctx.fillRect(x, y, MINIMAP_W - ROAD_WIDTH * sx, MINIMAP_H - ROAD_WIDTH * sy);
  // Playa Verde sand.
  ctx.fillStyle = '#eed9a4';
  ctx.fillRect(x + (city.width - PITCH - ROAD_WIDTH) * sx, y + 3 * PITCH * sy, (PITCH + ROAD_WIDTH) * sx, 4 * PITCH * sy);
  // Hillside green.
  ctx.fillStyle = 'rgba(120, 160, 90, 0.55)';
  ctx.fillRect(x, y, city.width * sx, 2 * PITCH * sy);
  // Avenues.
  ctx.strokeStyle = 'rgba(52, 56, 62, 0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= COLS; i += 1) {
    const rx = x + (ROAD_WIDTH / 2 + i * PITCH) * sx;
    ctx.moveTo(rx, y);
    ctx.lineTo(rx, y + MINIMAP_H);
  }
  for (let j = 0; j <= ROWS; j += 1) {
    const ry = y + (ROAD_WIDTH / 2 + j * PITCH) * sy;
    ctx.moveTo(x, ry);
    ctx.lineTo(x + MINIMAP_W, ry);
  }
  ctx.stroke();

  const L = city.landmarks;
  // Hideouts and the chop shop.
  ctx.fillStyle = '#5ac878';
  for (const h of L.hideouts) ctx.fillRect(x + h.x * sx - 2, y + h.y * sy - 2, 4, 4);
  ctx.fillStyle = '#f2a03a';
  ctx.fillRect(x + L.garage.x * sx - 2.5, y + L.garage.y * sy - 2.5, 5, 5);
  // Police cruisers flash.
  const flash = Math.floor(world.time * 5) % 2 === 0;
  for (const car of world.cars) {
    if (car.driver !== 'police') continue;
    ctx.fillStyle = flash ? '#ff3b30' : '#2b6cff';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The objective, gold and pulsing.
  if (objective && !objective.anywhere) {
    ctx.fillStyle = '#ffcd40';
    ctx.beginPath();
    ctx.arc(x + objective.x * sx, y + objective.y * sy, 3.4 + Math.sin(world.time * 4) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,64,0.7)';
    ctx.beginPath();
    ctx.arc(x + objective.x * sx, y + objective.y * sy, 6.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Marco: a white arrow that turns with him.
  const focus = world.player.inCar || world.player;
  ctx.translate(x + focus.x * sx, y + focus.y * sy);
  ctx.rotate(focus.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3.6);
  ctx.lineTo(-4, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Frame and caption.
  ctx.strokeStyle = 'rgba(10, 20, 26, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, MINIMAP_W, MINIMAP_H, 8);
  ctx.stroke();
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('CORAL BAY', x + 7, y + 12);
}
