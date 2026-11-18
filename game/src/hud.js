// Everything drawn over the world: the HUD (money, respect, health, the wanted stars, the
// objective banner with its distance, Vera's phone toasts, mission title cards, context
// prompts, the busted meter, the crosshair) and the full screens — title, pause, busted,
// wasted. If it is text or a bar, it lives here; the world itself is render.js's business.
import { drawMinimap, MINIMAP_W, MINIMAP_H } from './minimap.js';
import { MISSION_DEFS } from './missions.js';

const RESPECT_TITLES = ['Nobody', 'Runner', 'Wheelman', 'Operator', "The Fixer's Hand", 'Made Man of Coral Bay'];

export function respectTitle(respect) {
  return RESPECT_TITLES[Math.min(respect, RESPECT_TITLES.length - 1)];
}

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffcd40';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(10, 14, 18, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back || 'rgba(10, 16, 20, 0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, Math.max(2, (w - 3) * Math.min(1, frac)), h - 3, (h - 3) / 2);
    ctx.fill();
  }
}

function pill(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(10, 16, 20, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawHud(ctx, world, objective, input) {
  const view = world.view;
  const player = world.player;
  const police = world.police;

  // Money and respect, top-left.
  ctx.textAlign = 'left';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#8be08b';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 5;
  ctx.fillText(`$${world.money.toLocaleString('en-US')}`, 16, 32);
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(`MARCO REYES · ${respectTitle(world.respect).toUpperCase()}`, 16, 52);
  ctx.shadowBlur = 0;

  // Wanted stars, top-right; they blink while the heat cools.
  const cooling = police.stars > 0 && police.lastSeenTimer > 2.5;
  const blink = cooling && Math.floor(world.time * 3) % 2 === 0;
  for (let i = 0; i < 5; i += 1) {
    const filled = i < police.stars && !blink;
    star(ctx, view.w - 30 - (4 - i) * 32, 28, 12, filled);
  }
  if (police.stars > 0) {
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(cooling ? 'LOSING THEM…' : 'CBPD PURSUIT', view.w - 14, 54);
  }

  // Health (and the car's integrity while driving), bottom-left.
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('MARCO', 16, view.h - 44);
  bar(ctx, 16, view.h - 38, 168, 13, player.health / player.maxHealth, player.health > 30 ? '#5ac878' : '#e2574c');
  if (player.inCar) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(player.inCar.typeName.toUpperCase(), 16, view.h - 76);
    bar(ctx, 16, view.h - 70, 168, 9, player.inCar.health / player.inCar.maxHealth, '#7fd4f2');
  }

  // Pistol state, bottom-right above the minimap.
  ctx.textAlign = 'right';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const ammoText = world.combat.reloadTimer > 0 ? 'RELOADING…' : `PISTOL · ${world.combat.shotsInMag} / ∞`;
  ctx.fillText(player.inCar ? player.inCar.typeName.toUpperCase() : ammoText, view.w - 16, view.h - MINIMAP_H - 34);
  drawMinimap(ctx, world, objective, view.w - MINIMAP_W - 14, view.h - MINIMAP_H - 14);

  // Objective banner, top-centre, with the distance in metres.
  if (objective) {
    const dist = objective.anywhere ? 0 : Math.round(Math.hypot(objective.x - player.x, objective.y - player.y) / 10);
    const label = objective.anywhere ? objective.label : `${objective.label} · ${dist}m`;
    ctx.font = '600 14px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 30;
    pill(ctx, (view.w - w) / 2, 14, w, 30, 0.66);
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(label, view.w / 2, 34);
  }

  // Mission title card.
  if (world.banner) {
    const remain = world.banner.until - world.time;
    const alpha = Math.min(1, remain / 0.7);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(world.banner.title, view.w / 2, view.h * 0.3);
    ctx.font = '500 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(world.banner.sub, view.w / 2, view.h * 0.3 + 30);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Vera's phone toast, bottom-centre.
  if (world.toast) {
    ctx.font = '500 14px system-ui, sans-serif';
    const w = Math.min(view.w - 80, ctx.measureText(world.toast.text).width + 34);
    pill(ctx, (view.w - w) / 2, view.h - 92, w, 32, 0.78);
    ctx.fillStyle = '#cfe8ff';
    ctx.textAlign = 'center';
    ctx.fillText(world.toast.text, view.w / 2, view.h - 71);
  }

  // Context prompt, above the toast.
  const prompt = contextPrompt(world);
  if (prompt) {
    ctx.font = '600 13px system-ui, sans-serif';
    const w = ctx.measureText(prompt).width + 26;
    pill(ctx, (view.w - w) / 2, view.h - 128, w, 26, 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, view.w / 2, view.h - 110);
  }

  // Busted meter.
  if (police.bustMeter > 0.02) {
    ctx.textAlign = 'center';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText('BUSTED', view.w / 2, view.h - 150);
    bar(ctx, view.w / 2 - 90, view.h - 142, 180, 10, police.bustMeter, '#e2574c');
  }

  // Crosshair while aiming on foot.
  if (!player.inCar && input.mouse.down) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(input.mouse.x, input.mouse.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.mouse.x - 14, input.mouse.y);
    ctx.lineTo(input.mouse.x - 4, input.mouse.y);
    ctx.moveTo(input.mouse.x + 4, input.mouse.y);
    ctx.lineTo(input.mouse.x + 14, input.mouse.y);
    ctx.stroke();
  }
}

function contextPrompt(world) {
  const player = world.player;
  const L = world.city.landmarks;
  if (player.inCar) {
    if (Math.hypot(player.inCar.x - L.garage.x, player.inCar.y - L.garage.y) < 62 && !player.inCar.police) {
      const payout = Math.round(player.inCar.value * Math.max(0.15, player.inCar.health / player.inCar.maxHealth));
      return `F — Sell the ${player.inCar.typeName} to Reyes Auto (+$${payout}) · E — Get out`;
    }
    return 'E — Get out · WASD — Drive';
  }
  let nearest = null;
  let nearestDist = 52;
  for (const car of world.cars) {
    if (car.driver === 'police' || car.driver === 'player') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = car;
    }
  }
  if (nearest) return `E — Get in the ${nearest.typeName}`;
  if (world.police.stars > 0) {
    for (const h of L.hideouts) {
      if (Math.hypot(player.x - h.x, player.y - h.y) < 60) return `${h.name} — the heat clears here`;
    }
  }
  return null;
}

function sunsetBackdrop(ctx, view) {
  const grad = ctx.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, '#2b1d3a');
  grad.addColorStop(0.45, '#8c3b54');
  grad.addColorStop(0.75, '#e2703a');
  grad.addColorStop(1, '#f2a65a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);
  // Sun and skyline silhouettes.
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(view.w * 0.72, view.h * 0.52, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(24, 16, 30, 0.88)';
  const base = view.h * 0.78;
  const towers = [0.02, 0.1, 0.2, 0.3, 0.42, 0.55, 0.66, 0.78, 0.88, 0.96];
  for (let i = 0; i < towers.length; i += 1) {
    const w = view.w * 0.07;
    const h = view.h * (0.14 + ((i * 37) % 10) * 0.022);
    ctx.fillRect(view.w * towers[i], base - h, w, h);
  }
  ctx.fillRect(0, base, view.w, view.h - base);
}

export function drawTitleScreen(ctx, world, hasSave) {
  const view = world.view;
  sunsetBackdrop(ctx, view);
  ctx.textAlign = 'center';
  ctx.font = '900 74px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 14;
  ctx.fillText('CORAL BAY HEAT', view.w / 2, view.h * 0.34);
  ctx.shadowBlur = 0;
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('An original open-world crime story in the city of Coral Bay', view.w / 2, view.h * 0.34 + 34);
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  const story = [
    'Marco Reyes swore he was done driving. Then his brother\'s debt came due,',
    'and Vera Castellan — the fixer who holds the paper — offered him a way out:',
    'five jobs, one wheelman, and a city that never looks away.',
  ];
  story.forEach((line, i) => ctx.fillText(line, view.w / 2, view.h * 0.47 + i * 22));
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  if (hasSave) {
    ctx.fillText('ENTER — New game        C — Continue', view.w / 2, view.h * 0.66);
  } else {
    ctx.fillText('ENTER — Start the story', view.w / 2, view.h * 0.66);
  }
  ctx.font = '500 13.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const controls = [
    'WASD / Arrows — move & drive · SHIFT — run · E — enter / exit car · F — sell car at Reyes Auto',
    'MOUSE — aim, hold to shoot · M — music · P / ESC — pause',
    'Steal cars, run Vera\'s jobs, dodge the CBPD — and duck into a green H hideout to lose the heat.',
  ];
  controls.forEach((line, i) => ctx.fillText(line, view.w / 2, view.h * 0.74 + i * 20));
  if (world.missions.storyDone) {
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#8be08b';
    ctx.fillText('STORY COMPLETE — free roam: the chop shop still pays', view.w / 2, view.h * 0.9);
  }
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(`Next job: ${MISSION_DEFS[Math.min(world.missions.index, MISSION_DEFS.length - 1)].title} · $${world.money} · Respect: ${respectTitle(world.respect)}`, view.w / 2, view.h * 0.94);
}

export function drawPauseScreen(ctx, world) {
  const view = world.view;
  ctx.fillStyle = 'rgba(8, 12, 16, 0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', view.w / 2, view.h * 0.4);
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('P / ESC — Resume · M — Toggle music', view.w / 2, view.h * 0.4 + 36);
  ctx.fillText(`Job ${Math.min(world.missions.index + 1, MISSION_DEFS.length)} of ${MISSION_DEFS.length}: ${MISSION_DEFS[Math.min(world.missions.index, MISSION_DEFS.length - 1)].title} · $${world.money}`, view.w / 2, view.h * 0.4 + 62);
}

export function drawIncidentScreen(ctx, world, kind) {
  const view = world.view;
  ctx.fillStyle = kind === 'busted' ? 'rgba(20, 30, 60, 0.55)' : 'rgba(60, 12, 8, 0.55)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.fillStyle = kind === 'busted' ? '#7fd4f2' : '#ff6b5e';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', view.w / 2, view.h * 0.44);
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(kind === 'busted' ? 'The CBPD took Marco in. The fine stings; Vera will not wait.' : 'Marco wakes up at St. Marina General, patched and poorer.', view.w / 2, view.h * 0.44 + 34);
}
