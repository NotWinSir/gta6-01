// How Coral Bay looks: a warm, sun-soaked top-down city. The ocean frames the east and south
// edges, avenues carry dashed centre lines, sidewalks edge every block, and buildings rise
// off their footprints with a south facade of windows and a long afternoon shadow — the
// taller the tower, the longer the shadow. Everything is drawn from the city data each
// frame; there are no images. The draw order is ground, roads, blocks, props, markers,
// people, cars, effects, so the player always reads on top of the street.
import { BLOCK_SIZE, COLS, PITCH, ROAD_WIDTH, ROWS, isSand } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';

const DISTRICT_GROUND = {
  downtown: '#b9b3a4',
  strip: '#c2b498',
  oldtown: '#bfab90',
  marina: '#a8a08e',
  industrial: '#ada088',
  hillside: '#8fae6a',
  midtown: '#bdb096',
  playa: '#eed9a4',
};

function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawWorld(ctx, world, objective) {
  const city = world.city;
  const cam = world.camera;
  const view = world.view;
  const time = world.time;

  // Ocean first, everywhere; the city is drawn over it.
  const oceanGrad = ctx.createLinearGradient(0, 0, view.w, view.h);
  oceanGrad.addColorStop(0, '#2e86ab');
  oceanGrad.addColorStop(1, '#1d6f8e');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Animated wave sparkle near the shore lines (east and south edges).
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i += 1) {
    const wy = (i * 173 + Math.sin(time * 0.9 + i) * 8) % (city.height + 300);
    const wx = city.width + 26 + Math.sin(time * 0.7 + i * 2.1) * 10 + (i % 4) * 22;
    if (wx > cam.x - 40 && wx < cam.x + view.w + 60 && wy > cam.y - 20 && wy < cam.y + view.h + 20) {
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 26, wy);
      ctx.stroke();
    }
    const sx = (i * 211 + Math.cos(time * 0.8 + i) * 8) % (city.width + 300);
    const sy = city.height + 26 + Math.cos(time * 0.6 + i * 1.7) * 10 + (i % 4) * 22;
    if (sx > cam.x - 20 && sx < cam.x + view.w + 20 && sy > cam.y - 40 && sy < cam.y + view.h + 60) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 26, sy);
      ctx.stroke();
    }
  }

  // City ground slab.
  ctx.fillStyle = '#cfc4a5';
  ctx.fillRect(0, 0, city.width, city.height);
  // Sand shore strip along the east edge.
  ctx.fillStyle = '#eed9a4';
  ctx.fillRect(city.width - ROAD_WIDTH, 3 * PITCH, ROAD_WIDTH, 4 * PITCH);

  drawRoads(ctx, city, cam, view);
  drawBlocks(ctx, world, cam, view);
  drawProps(ctx, world, cam, view, time);
  drawMarkers(ctx, world, objective, time);
  for (const pickup of world.pickups) drawPickup(ctx, pickup, time);
  for (const ped of world.peds) {
    if (inView(ped.x, ped.y, cam, view, 40)) drawPed(ctx, ped, time);
  }
  for (const thug of world.thugs) {
    if (inView(thug.x, thug.y, cam, view, 40)) drawPed(ctx, thug, time);
  }
  // Cars sorted so southern cars overlap northern ones naturally.
  const sortedCars = world.cars.filter((c) => inView(c.x, c.y, cam, view, 90)).sort((a, b) => a.y - b.y);
  for (const car of sortedCars) drawCar(ctx, car, time);
  if (!world.player.inCar) drawPlayer(ctx, world.player, time);

  // Bullets as short bright tracers.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const bullet of world.bullets) {
    ctx.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
    ctx.lineTo(bullet.x, bullet.y);
  }
  ctx.stroke();

  // Particles.
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating feedback text (+$120, +35 HP).
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const text of world.texts) {
    ctx.globalAlpha = Math.min(1, text.life);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Warm sunlight wash and a soft vignette, in screen space.
  const sun = ctx.createRadialGradient(view.w * 0.22, view.h * 0.12, 60, view.w * 0.22, view.h * 0.12, view.w * 0.9);
  sun.addColorStop(0, 'rgba(255, 196, 110, 0.13)');
  sun.addColorStop(1, 'rgba(255, 140, 66, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, view.w, view.h);
  const vig = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.42, view.w / 2, view.h / 2, view.h * 0.95);
  vig.addColorStop(0, 'rgba(30, 16, 4, 0)');
  vig.addColorStop(1, 'rgba(30, 16, 4, 0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, view.w, view.h);
}

function inView(x, y, cam, view, pad) {
  return x > cam.x - pad && x < cam.x + view.w + pad && y > cam.y - pad && y < cam.y + view.h + pad;
}

function drawRoads(ctx, city, cam, view) {
  ctx.fillStyle = '#43484f';
  const x0 = Math.max(0, cam.x - 80);
  const x1 = Math.min(city.width, cam.x + view.w + 80);
  const y0 = Math.max(0, cam.y - 80);
  const y1 = Math.min(city.height, cam.y + view.h + 80);
  for (let i = 0; i <= COLS; i += 1) {
    const cx = (ROAD_WIDTH / 2 + i * PITCH) - ROAD_WIDTH / 2;
    if (cx + ROAD_WIDTH < x0 || cx > x1) continue;
    ctx.fillRect(cx, 0, ROAD_WIDTH, city.height);
  }
  for (let j = 0; j <= ROWS; j += 1) {
    const cy = (ROAD_WIDTH / 2 + j * PITCH) - ROAD_WIDTH / 2;
    if (cy + ROAD_WIDTH < y0 || cy > y1) continue;
    ctx.fillRect(0, cy, city.width, ROAD_WIDTH);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8c95a';
  for (let i = 0; i <= COLS; i += 1) {
    const cx = ROAD_WIDTH / 2 + i * PITCH;
    if (cx < x0 - 10 || cx > x1 + 10) continue;
    for (let y = 8; y < city.height; y += 44) {
      if (y > y0 - 30 && y < y1 + 10) ctx.fillRect(cx - 1.5, y, 3, 22);
    }
  }
  for (let j = 0; j <= ROWS; j += 1) {
    const cy = ROAD_WIDTH / 2 + j * PITCH;
    if (cy < y0 - 10 || cy > y1 + 10) continue;
    for (let x = 8; x < city.width; x += 44) {
      if (x > x0 - 30 && x < x1 + 10) ctx.fillRect(x, cy - 1.5, 22, 3);
    }
  }
}

function drawBlocks(ctx, world, cam, view) {
  const city = world.city;
  for (const block of city.blocks) {
    if (!inView(block.x + BLOCK_SIZE / 2, block.y + BLOCK_SIZE / 2, cam, view, BLOCK_SIZE)) continue;
    const sandy = isSand(city, block.x + 4, block.y + 4);
    ctx.fillStyle = sandy ? '#eed9a4' : DISTRICT_GROUND[block.district];
    ctx.fillRect(block.x, block.y, BLOCK_SIZE, BLOCK_SIZE);
    // Sidewalk rim.
    ctx.strokeStyle = 'rgba(240, 234, 214, 0.65)';
    ctx.lineWidth = 3;
    ctx.strokeRect(block.x + 1.5, block.y + 1.5, BLOCK_SIZE - 3, BLOCK_SIZE - 3);
    for (const building of block.buildings) drawBuilding(ctx, building);
  }
}

function drawBuilding(ctx, b) {
  const lift = b.height * 0.5;
  // Long afternoon shadow to the south-east.
  ctx.fillStyle = 'rgba(30, 22, 10, 0.22)';
  ctx.fillRect(b.x + b.height * 0.32, b.y + b.height * 0.32, b.w, b.h);
  // Footprint walls.
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // South facade with window rows, between the roof's bottom edge and the pavement.
  const roofY = b.y - lift;
  ctx.fillStyle = shade(b.color, -18);
  ctx.fillRect(b.x, b.y + b.h - lift - 2, b.w, lift + 2);
  const cols = Math.max(2, Math.floor(b.w / 15));
  const rows = Math.max(1, Math.floor(lift / 13));
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      const lit = hash01(b.windowsSeed + cx * 31 + cy * 57) > 0.42;
      ctx.fillStyle = lit ? 'rgba(255, 224, 138, 0.9)' : 'rgba(38, 54, 66, 0.75)';
      ctx.fillRect(b.x + 5 + cx * 15, b.y + b.h - lift + 3 + cy * 13, 8, 7);
    }
  }
  // Roof, lifted by the building's height.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, roofY, b.w, b.h);
  ctx.strokeStyle = b.trim;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, roofY + 1, b.w - 2, b.h - 2);
  // Roof clutter: a water tank or AC box on the bigger roofs.
  if (b.w > 60 && b.h > 60) {
    ctx.fillStyle = shade(b.roof, -22);
    const cx = b.x + b.w * (0.25 + hash01(b.windowsSeed) * 0.4);
    const cy = roofY + b.h * (0.25 + hash01(b.windowsSeed + 9) * 0.4);
    ctx.fillRect(cx, cy, 16, 12);
  }
  if (b.name) {
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(24, 26, 30, 0.72)';
    ctx.fillText(b.name, b.x + b.w / 2, roofY + 14);
  }
}

function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawProps(ctx, world, cam, view, time) {
  for (const prop of world.city.props) {
    if (!inView(prop.x, prop.y, cam, view, 50)) continue;
    if (prop.kind === 'lamp') {
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(prop.x - 1.5, prop.y - 1.5, 3, 3);
      ctx.fillStyle = 'rgba(255, 220, 130, 0.9)';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'palm') {
      const s = prop.size;
      ctx.strokeStyle = '#8a6b42';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.quadraticCurveTo(prop.x + prop.lean * 26, prop.y - 8 * s, prop.x + prop.lean * 44, prop.y - 13 * s);
      ctx.stroke();
      const tx = prop.x + prop.lean * 44;
      const ty = prop.y - 13 * s;
      ctx.strokeStyle = '#3f7d3a';
      ctx.lineWidth = 2.4 * s;
      for (let f = 0; f < 6; f += 1) {
        const a = (f / 6) * Math.PI * 2 + prop.lean * 3 + Math.sin(time * 1.3 + prop.x) * 0.05;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 11 * s, ty + Math.sin(a) * 7 * s - 2, tx + Math.cos(a) * 17 * s, ty + Math.sin(a) * 11 * s + 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,22,10,0.2)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 3, prop.y + 2, 8 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'tree') {
      ctx.fillStyle = 'rgba(30,22,10,0.2)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 3, prop.y + 3, 11 * prop.size, 6 * prop.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4d7d3a';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 11 * prop.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5f9147';
      ctx.beginPath();
      ctx.arc(prop.x - 3, prop.y - 3, 7 * prop.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMarkers(ctx, world, objective, time) {
  // Hideouts glow faint green so a hot player can plan an escape.
  for (const hideout of world.city.landmarks.hideouts) {
    ctx.strokeStyle = 'rgba(90, 200, 120, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hideout.x, hideout.y, 15 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(30, 90, 45, 0.9)';
    ctx.fillText('H', hideout.x, hideout.y + 4);
  }
  if (!objective || objective.anywhere) return;
  const pulse = 0.75 + Math.sin(time * 4) * 0.25;
  const grad = ctx.createLinearGradient(0, objective.y - 190, 0, objective.y);
  grad.addColorStop(0, 'rgba(255, 205, 64, 0)');
  grad.addColorStop(1, `rgba(255, 205, 64, ${0.5 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(objective.x - 13, objective.y - 190, 26, 190);
  ctx.strokeStyle = `rgba(255, 205, 64, ${0.95 * pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, 20 + Math.sin(time * 4) * 3, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPickup(ctx, pickup, time) {
  const bobY = Math.sin(time * 3 + pickup.bob) * 3;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bobY);
  if (pickup.kind === 'cash') {
    ctx.fillStyle = '#3f9e4d';
    ctx.fillRect(-9, -6, 18, 12);
    ctx.fillStyle = '#8be08b';
    ctx.fillRect(-9, -2, 18, 4);
    ctx.fillStyle = '#eaffea';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 3.5);
  } else {
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#d23b2e';
    ctx.fillRect(-2.5, -6, 5, 12);
    ctx.fillRect(-6, -2.5, 12, 5);
  }
  ctx.restore();
}
