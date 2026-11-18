// Coral Bay itself: a sun-soaked coastal city on a strict street grid, generated from a seed.
// Sixteen by twelve city blocks sit between wide avenues; each district dresses its blocks
// differently — glass towers downtown, neon mid-rises on the Strip, brick walk-ups in the Old
// Town, warehouses by the Marina, houses in the Hillside and open sand at Playa Verde. Every
// building is an axis-aligned box the rest of the game collides with, and the landmarks the
// story needs (the marina, the cash office, the ferry pier, Vera's corners, the hideouts)
// are placed here, once, so missions, police and the minimap all agree where things are.
export const ROAD_WIDTH = 64;
export const BLOCK_SIZE = 176;
export const PITCH = ROAD_WIDTH + BLOCK_SIZE;
export const COLS = 16;
export const ROWS = 12;
export const WORLD_W = COLS * PITCH + ROAD_WIDTH;
export const WORLD_H = ROWS * PITCH + ROAD_WIDTH;
export const SIDEWALK = 13;

const DISTRICT_PALETTES = {
  downtown: { walls: ['#7fb2c9', '#94c3d4', '#6f9db8', '#a8ccd9'], roofs: ['#4d6b7a', '#5d7d8c'], trim: '#dff2f7' },
  strip: { walls: ['#f2a65a', '#e8836b', '#f7c873', '#d96f9e', '#7fc8bc'], roofs: ['#8c4a3a', '#6e4a5e'], trim: '#fff3b0' },
  oldtown: { walls: ['#c96f4a', '#b85c48', '#d98e5f', '#a84f3d'], roofs: ['#7a3b2e', '#8c4636'], trim: '#f7e0c3' },
  marina: { walls: ['#9db4a0', '#8aa393', '#b0bf9d', '#7d9484'], roofs: ['#5e7263', '#6b7f6e'], trim: '#e8f0e0' },
  industrial: { walls: ['#a89a83', '#97876d', '#b3a58d'], roofs: ['#6e6350', '#7d7260'], trim: '#e5dcc8' },
  hillside: { walls: ['#f2e3c6', '#ecd9ae', '#e8cfa0', '#f5ecd7'], roofs: ['#b85c48', '#a84f3d', '#c96f4a'], trim: '#ffffff' },
  midtown: { walls: ['#e8d8b0', '#dcc491', '#cfe0d8', '#e3c9a8'], roofs: ['#8c7a5a', '#77683f'], trim: '#fdf6e0' },
  playa: { walls: ['#f7e8c9', '#f2dcae'], roofs: ['#c96f4a'], trim: '#ffffff' },
};

const BUILDING_NAMES = [
  'Hotel Marisol', 'Café Brisa', 'Banco del Sol', 'Torre Coral', 'Mercado Azul', 'Club Sirena',
  'Farmacia Luz', 'Hotel Brisa Grande', 'Cine Alba', 'Joyeria Perla', 'Torre Miramar', 'Café Ola',
  'Hotel Palma Real', 'Banco Coral', 'Mercado Central', 'Club Tiburón', 'Librería Alba', 'Hotel Dunas',
];

export function districtAt(col, row) {
  if (col >= 14 && row >= 3 && row <= 6) return 'playa';
  if (row >= 10 && col >= 10) return 'marina';
  if (row >= 3 && col <= 3 && row <= 5) return 'industrial';
  if (col >= 5 && col <= 9 && row >= 4 && row <= 7) return 'downtown';
  if (row === 6 && col >= 10 && col <= 13) return 'strip';
  if (col >= 1 && col <= 4 && row >= 7 && row <= 10) return 'oldtown';
  if (row <= 2) return 'hillside';
  return 'midtown';
}

/** The centre line of vertical road i and horizontal road j. */
export function roadCenterX(i) {
  return ROAD_WIDTH / 2 + i * PITCH;
}
export function roadCenterY(j) {
  return ROAD_WIDTH / 2 + j * PITCH;
}
/** The top-left corner of block (col, row). */
export function blockOrigin(col, row) {
  return { x: ROAD_WIDTH + col * PITCH, y: ROAD_WIDTH + row * PITCH };
}

function makeBuilding(rng, x, y, w, h, district, kind, heightPx, name) {
  const palette = DISTRICT_PALETTES[district];
  return {
    x, y, w, h, district, kind,
    height: heightPx,
    color: palette.walls[Math.floor(rng.next() * palette.walls.length)],
    roof: palette.roofs[Math.floor(rng.next() * palette.roofs.length)],
    trim: palette.trim,
    name: name || null,
    windowsSeed: Math.floor(rng.next() * 1e9),
  };
}

function fillBlock(rng, block, namePool) {
  const { col, row, district } = block;
  const inset = SIDEWALK + 6;
  const inner = BLOCK_SIZE - inset * 2;
  const bx = block.x + inset;
  const by = block.y + inset;
  const buildings = [];
  if (district === 'downtown') {
    if (rng.chance(0.45)) {
      buildings.push(makeBuilding(rng, bx + 8, by + 8, inner - 16, inner - 16, district, 'tower', rng.range(64, 110), namePool.pop()));
    } else {
      const w = (inner - 10) / 2;
      buildings.push(makeBuilding(rng, bx, by, w, inner, district, 'tower', rng.range(48, 88), namePool.pop()));
      buildings.push(makeBuilding(rng, bx + w + 10, by, w, inner, district, 'tower', rng.range(48, 88), namePool.pop()));
    }
  } else if (district === 'industrial' || district === 'marina') {
    const w = (inner - 10) / 2;
    buildings.push(makeBuilding(rng, bx, by + 6, inner, inner * 0.52, district, 'warehouse', rng.range(16, 24), null));
    buildings.push(makeBuilding(rng, bx, by + inner * 0.52 + 10, w, inner * 0.4, district, 'warehouse', rng.range(14, 22), null));
    buildings.push(makeBuilding(rng, bx + w + 10, by + inner * 0.52 + 10, w, inner * 0.4, district, 'warehouse', rng.range(14, 22), null));
  } else if (district === 'hillside' || district === 'oldtown') {
    const w = (inner - 8) / 2;
    const h = (inner - 8) / 2;
    for (let qx = 0; qx < 2; qx += 1) {
      for (let qy = 0; qy < 2; qy += 1) {
        buildings.push(makeBuilding(rng, bx + qx * (w + 8), by + qy * (h + 8), w, h, district, district === 'hillside' ? 'house' : 'walkup', rng.range(12, 26), null));
      }
    }
  } else if (district === 'playa') {
    if (rng.chance(0.6)) {
      buildings.push(makeBuilding(rng, bx + inner * 0.2, by + inner * 0.25, inner * 0.34, inner * 0.3, district, 'kiosk', 10, 'Puesto de Mariscos'));
    }
  } else {
    const w = (inner - 10) / 2;
    const h = (inner - 10) / 2;
    buildings.push(makeBuilding(rng, bx, by, w, h, district, 'block', rng.range(24, 46), namePool.pop()));
    buildings.push(makeBuilding(rng, bx + w + 10, by, w, h, district, 'block', rng.range(24, 46), null));
    buildings.push(makeBuilding(rng, bx, by + h + 10, w, h, district, 'block', rng.range(24, 46), null));
    buildings.push(makeBuilding(rng, bx + w + 10, by + h + 10, w, h, district, 'block', rng.range(24, 46), namePool.pop()));
  }
  void col;
  void row;
  return buildings;
}

export function createCity(rng) {
  const blocks = [];
  const buildings = [];
  const namePool = rng.shuffled(BUILDING_NAMES.slice());
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const origin = blockOrigin(col, row);
      const district = districtAt(col, row);
      const block = { col, row, x: origin.x, y: origin.y, w: BLOCK_SIZE, h: BLOCK_SIZE, district, buildings: [] };
      block.buildings = fillBlock(rng, block, namePool);
      for (const building of block.buildings) buildings.push(building);
      blocks.push(block);
    }
  }

  // Named landmarks overwrite whatever the filler put on their footprint: the story needs
  // these exact places, so their buildings are placed by hand on their blocks.
  function landmark(col, row, name, kind, heightPx) {
    const block = blocks[row * COLS + col];
    const inset = SIDEWALK + 10;
    const building = makeBuilding(rng, block.x + inset, block.y + inset, BLOCK_SIZE - inset * 2, BLOCK_SIZE - inset * 2, block.district, kind, heightPx, name);
    block.buildings = [building];
    return building;
  }
  // Rebuild the flat list after landmark surgery so it always matches the blocks.
  function refreshBuildings() {
    buildings.length = 0;
    for (const block of blocks) for (const building of block.buildings) buildings.push(building);
  }
  const pd = landmark(6, 5, 'Coral Bay Police HQ', 'tower', 58);
  const hospital = landmark(2, 8, 'St. Marina General Hospital', 'block', 30);
  const garage = landmark(1, 4, 'Reyes Auto & Chop', 'warehouse', 18);
  const cashOffice = landmark(12, 10, 'Marina Cash Office', 'warehouse', 20);
  const motel = landmark(12, 6, 'Motel Brisa', 'block', 22);
  refreshBuildings();
  void pd;
  void hospital;

  function frontOf(building, side = 'south') {
    const cx = building.x + building.w / 2;
    const cy = building.y + building.h / 2;
    if (side === 'south') return { x: cx, y: building.y + building.h + SIDEWALK + 8 };
    if (side === 'north') return { x: cx, y: building.y - SIDEWALK - 8 };
    if (side === 'east') return { x: building.x + building.w + SIDEWALK + 8, y: cy };
    return { x: building.x - SIDEWALK - 8, y: cy };
  }

  const marinaBlock = blocks[10 * COLS + 13];
  const pierBlock = blocks[0 * COLS + 15];
  const landmarks = {
    policeHQ: frontOf(pd),
    hospital: frontOf(hospital),
    garage: frontOf(garage),
    cashOffice: frontOf(cashOffice, 'north'),
    motel: frontOf(motel),
    veraMarina: { x: marinaBlock.x + BLOCK_SIZE / 2, y: marinaBlock.y - SIDEWALK - 6 },
    docksCrate: { x: marinaBlock.x + BLOCK_SIZE * 0.72, y: marinaBlock.y + BLOCK_SIZE * 0.62 },
    ferryPier: { x: pierBlock.x + BLOCK_SIZE * 0.55, y: pierBlock.y + BLOCK_SIZE * 0.4 },
    hillsideOverlook: { x: blockOrigin(3, 1).x + 30, y: blockOrigin(3, 1).y - SIDEWALK - 6 },
    stripDrops: [
      { x: roadCenterX(11), y: roadCenterY(6) - ROAD_WIDTH / 2 - 8 },
      { x: blockOrigin(12, 6).x + BLOCK_SIZE / 2, y: blockOrigin(12, 6).y - SIDEWALK - 6 },
      { x: roadCenterX(14), y: roadCenterY(7) + ROAD_WIDTH / 2 + 8 },
    ],
    hideouts: [
      { name: 'Motel Brisa room 6', x: frontOf(motel).x + 26, y: frontOf(motel).y },
      { name: 'Hillside safehouse', x: blockOrigin(2, 1).x + BLOCK_SIZE / 2, y: blockOrigin(2, 1).y - SIDEWALK - 6 },
    ],
    spawn: { x: marinaBlock.x + BLOCK_SIZE / 2, y: marinaBlock.y - ROAD_WIDTH / 2 },
  };

  // Palm trees and lamps, scattered deterministically: palms crowd the Playa and the Strip,
  // lamps stand at intersection corners all over the city. Props are scenery only.
  const props = [];
  for (const block of blocks) {
    if (block.district === 'playa' || block.district === 'strip') {
      const count = block.district === 'playa' ? 7 : 3;
      for (let i = 0; i < count; i += 1) {
        props.push({
          kind: 'palm',
          x: block.x + rng.range(8, BLOCK_SIZE - 8),
          y: block.y + rng.range(8, BLOCK_SIZE - 8),
          lean: rng.range(-0.16, 0.16),
          size: rng.range(0.8, 1.25),
        });
      }
    }
    if (block.district === 'hillside') {
      for (let i = 0; i < 3; i += 1) {
        props.push({ kind: 'tree', x: block.x + rng.range(10, BLOCK_SIZE - 10), y: block.y + rng.range(10, BLOCK_SIZE - 10), size: rng.range(0.8, 1.2) });
      }
    }
  }
  for (let i = 0; i <= COLS; i += 2) {
    for (let j = 0; j <= ROWS; j += 2) {
      props.push({ kind: 'lamp', x: roadCenterX(i) + ROAD_WIDTH / 2 - 5, y: roadCenterY(j) + ROAD_WIDTH / 2 - 5 });
    }
  }

  return {
    width: WORLD_W,
    height: WORLD_H,
    blocks,
    buildings,
    props,
    landmarks,
    districtAt,
  };
}

/** True when the point sits on a road band (either direction), kerbs included. */
export function isOnRoad(x, y) {
  const mx = ((x % PITCH) + PITCH) % PITCH;
  const my = ((y % PITCH) + PITCH) % PITCH;
  return mx < ROAD_WIDTH || my < ROAD_WIDTH;
}

/** True on the sand of Playa Verde or the shore strip at the east edge. */
export function isSand(city, x, y) {
  if (x > city.width - PITCH - ROAD_WIDTH && y > 3 * PITCH && y < 7 * PITCH) return true;
  const col = Math.floor((x - ROAD_WIDTH) / PITCH);
  const row = Math.floor((y - ROAD_WIDTH) / PITCH);
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
  return city.districtAt(col, row) === 'playa';
}

/** The building whose box contains the point, or null. */
export function buildingAt(city, x, y) {
  for (const building of city.buildings) {
    if (x >= building.x && x <= building.x + building.w && y >= building.y && y <= building.y + building.h) return building;
  }
  return null;
}

/**
 * Push a circle out of every building it overlaps and clamp it inside the world. Returns the
 * corrected position; the caller keeps the one it had if it prefers to slide on its own.
 */
export function collideBuildings(city, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx;
    const dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        py = ny + (dy / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const left = px - (b.x - radius);
        const right = b.x + b.w + radius - px;
        const top = py - (b.y - radius);
        const bottom = b.y + b.h + radius - py;
        const min = Math.min(left, right, top, bottom);
        if (min === left) px = b.x - radius;
        else if (min === right) px = b.x + b.w + radius;
        else if (min === top) py = b.y - radius;
        else py = b.y + b.h + radius;
      }
    }
  }
  px = Math.max(radius, Math.min(city.width - radius, px));
  py = Math.max(radius, Math.min(city.height - radius, py));
  return { x: px, y: py };
}
