// The story of Coral Bay Heat, in five jobs. Marco Reyes owes the Vultures crew for his
// brother's debt; Vera Castellan, the fixer who holds the paper, works him instead — a
// wheelman paying in miles. Each mission is a short chain of objectives (steal, drive,
// collect, hold, escape, deliver) with a title card, a line or two of Vera's voice, a cash
// reward and, twice, scripted police heat. Between jobs the next meeting point glows on the
// map; after the last job the city stays open as a free roam with the chop shop paying.
import { reportCrime, clearWanted } from './police.js';
import { spawnThug } from './combat.js';

export const MISSION_DEFS = [
  { title: 'Cold Start', giver: 'Vera Castellan', blurb: 'Prove the old wheelman still has hands.' },
  { title: 'Harbor Run', giver: 'Vera Castellan', blurb: 'A crate off the docks, delivered quiet.' },
  { title: 'Neon Debt', giver: 'Vera Castellan', blurb: 'Three drops on the Strip owe Vera money.' },
  { title: 'Sirens at Sundown', giver: 'Vera Castellan', blurb: 'The marina cash office, emptied at dusk.' },
  { title: 'Last Ferry Out', giver: 'Vera Castellan', blurb: 'Get Vera to the last ferry. Do not be late.' },
];

export function createMissions() {
  return {
    index: 0, // next mission to play
    active: false,
    step: 0,
    data: {},
    wantedFloor: 0,
    storyDone: false,
  };
}

function meetPoint(world, index) {
  const L = world.city.landmarks;
  if (index === 3) return { ...L.hillsideOverlook, label: 'the hillside overlook' };
  if (index === 2 || index === 4) return { ...L.motel, label: 'the Motel Brisa' };
  return { ...L.veraMarina, label: 'the marina' };
}

/** Where the player should be heading right now, or null in free roam. */
export function currentObjective(world) {
  const m = world.missions;
  const L = world.city.landmarks;
  if (!m.active) {
    if (m.storyDone) return null;
    const meet = meetPoint(world, m.index);
    return { x: meet.x, y: meet.y, label: `Meet Vera at ${meet.label} — ${MISSION_DEFS[m.index].title}`, radius: 30 };
  }
  const d = m.data;
  switch (m.index) {
    case 0:
      if (m.step === 0) return { x: world.player.x, y: world.player.y, label: 'Steal a car (walk up and press E)', radius: 0, anywhere: true };
      return { x: L.docksCrate.x, y: L.docksCrate.y - 260, label: 'Drive to the marina lookout', radius: 64 };
    case 1:
      if (m.step === 0) return { x: L.docksCrate.x, y: L.docksCrate.y, label: 'Pick up the crate at the docks', radius: 34 };
      return { x: L.garage.x, y: L.garage.y, label: 'Deliver the crate to Reyes Auto', radius: 58 };
    case 2:
      if (m.step < 3) {
        const drop = L.stripDrops[m.step];
        return { x: drop.x, y: drop.y, label: `Collect drop ${m.step + 1} of 3 on the Strip`, radius: 28 };
      }
      if (m.step === 3) return { x: L.stripDrops[2].x, y: L.stripDrops[2].y, label: 'Survive the ambush — fight or run', radius: 0, anywhere: true };
      return { x: L.motel.x, y: L.motel.y, label: 'Report back to Vera at the Motel Brisa', radius: 32 };
    case 3:
      if (m.step === 0) return { x: L.cashOffice.x, y: L.cashOffice.y, label: 'Reach the Marina Cash Office', radius: 34 };
      if (m.step === 1) return { x: L.cashOffice.x, y: L.cashOffice.y, label: `Grab the cash — hold your ground (${Math.max(0, 4 - Math.floor(d.holdTimer || 0))}s)`, radius: 34 };
      return { x: world.player.x, y: world.player.y, label: 'Lose the heat — outrun them or duck into a hideout', radius: 0, anywhere: true };
    case 4:
      if (m.step === 0) return { x: L.motel.x, y: L.motel.y, label: 'Pick Vera up at the Motel Brisa', radius: 30 };
      return { x: L.ferryPier.x, y: L.ferryPier.y, label: `Drive Vera to the ferry pier — ${Math.max(0, Math.ceil(d.timer || 0))}s`, radius: 72 };
    default:
      return null;
  }
}

function startMission(world) {
  const m = world.missions;
  const def = MISSION_DEFS[m.index];
  m.active = true;
  m.step = 0;
  m.data = {};
  m.wantedFloor = 0;
  world.audio.phoneRing();
  world.showBanner(def.title, def.blurb, 4.2);
  if (m.index === 3) {
    world.showToast('Vera: "The office guards are Vultures. Come ready."', 5);
  } else if (m.index === 4) {
    world.showToast('Vera: "One last drive, Marco. Then the debt is ash."', 5);
  } else if (m.index === 0) {
    world.showToast('Vera: "Any car. They all owe me anyway."', 5);
  }
}

export function failMission(world, reason) {
  const m = world.missions;
  if (!m.active) return;
  m.active = false;
  m.step = 0;
  m.data = {};
  m.wantedFloor = 0;
  world.thugs.length = 0;
  world.showBanner('Mission failed', reason, 3.4);
  world.audio.fail();
}

function completeMission(world, reward) {
  const m = world.missions;
  const def = MISSION_DEFS[m.index];
  world.money += reward;
  world.respect += 1;
  world.audio.success();
  world.audio.cash();
  world.showBanner(`${def.title} — complete`, `+$${reward} · Respect ${world.respect}`, 4.2);
  m.active = false;
  m.step = 0;
  m.data = {};
  m.wantedFloor = 0;
  world.thugs.length = 0;
  m.index += 1;
  if (m.index >= MISSION_DEFS.length) {
    m.storyDone = true;
    world.showBanner('Story complete', 'The debt is ash. Coral Bay is yours — the chop shop still pays for clean cars.', 6);
  }
  world.saveSoon();
}

function near(world, point, radius, needCar) {
  const focus = world.player.inCar || world.player;
  if (needCar && !world.player.inCar) return false;
  return Math.hypot(focus.x - point.x, focus.y - point.y) < radius;
}

export function notifyThugDown(world) {
  const m = world.missions;
  if (m.active && m.index === 2 && m.step === 3) {
    m.data.ambushDown = (m.data.ambushDown || 0) + 1;
  }
}

export function updateMissions(world, dt) {
  const m = world.missions;
  const L = world.city.landmarks;
  if (!m.active) {
    if (!m.storyDone) {
      const meet = meetPoint(world, m.index);
      if (near(world, meet, 30, false)) startMission(world);
    }
    return;
  }
  const d = m.data;
  switch (m.index) {
    case 0: {
      if (m.step === 0 && world.player.inCar) {
        m.step = 1;
        world.showToast('Vera: "Good. Now let the bay see you — the lookout, north of the docks."', 4.5);
      } else if (m.step === 1 && near(world, { x: L.docksCrate.x, y: L.docksCrate.y - 260 }, 64, true)) {
        completeMission(world, 150);
      }
      break;
    }
    case 1: {
      if (m.step === 0 && near(world, L.docksCrate, 34, false)) {
        m.step = 1;
        d.heatTimer = 16;
        world.showToast('Crate loaded. Vera: "Reyes Auto. And Marco — no sirens."', 4.5);
        world.audio.pickup();
      } else if (m.step === 1) {
        d.heatTimer -= dt;
        if (d.heatTimer <= 0 && !d.heatSet) {
          d.heatSet = true;
          m.wantedFloor = 2;
          reportCrime(world, 2);
          world.showToast('A patrol clocked the crate. Two stars — lose them after the drop.', 4.5);
        }
        if (near(world, L.garage, 58, true)) {
          m.wantedFloor = 0;
          completeMission(world, 300);
        }
      }
      break;
    }
    case 2: {
      if (m.step < 3) {
        const drop = L.stripDrops[m.step];
        if (near(world, drop, 28, false)) {
          world.money += 120;
          world.audio.cash();
          world.floatText(drop.x, drop.y - 16, '+$120 drop', '#8be08b');
          m.step += 1;
          if (m.step === 3) {
            d.ambushDown = 0;
            spawnThug(world, drop.x + 60, drop.y - 40);
            spawnThug(world, drop.x - 70, drop.y + 30);
            world.showToast('Vultures! "Vera sends a debt collector? Cute."', 4.5);
            scareAndReport(world, drop);
          }
        }
      } else if (m.step === 3) {
        const drop = L.stripDrops[2];
        const escaped = Math.hypot(world.player.x - drop.x, world.player.y - drop.y) > 300;
        if ((d.ambushDown || 0) >= 2 || escaped) m.step = 4;
      } else if (m.step === 4 && near(world, L.motel, 32, false)) {
        completeMission(world, 250);
      }
      break;
    }
    case 3: {
      if (m.step === 0 && near(world, L.cashOffice, 34, false)) {
        m.step = 1;
        d.holdTimer = 0;
        spawnThug(world, L.cashOffice.x - 90, L.cashOffice.y - 60);
        spawnThug(world, L.cashOffice.x + 95, L.cashOffice.y - 30);
        spawnThug(world, L.cashOffice.x + 10, L.cashOffice.y - 120);
        world.showToast('The guards noticed you. Hold the door!', 4);
      } else if (m.step === 1) {
        if (near(world, L.cashOffice, 40, false)) d.holdTimer += dt;
        if (d.holdTimer >= 4) {
          m.step = 2;
          m.wantedFloor = 3;
          reportCrime(world, 3);
          world.money += 200;
          world.showToast('Cash grabbed. Now vanish — hideouts are green on the map.', 5);
        }
      } else if (m.step === 2 && world.police.stars === 0) {
        clearWanted(world);
        completeMission(world, 600);
      }
      break;
    }
    case 4: {
      if (m.step === 0 && near(world, L.motel, 30, false)) {
        m.step = 1;
        d.timer = 150;
        d.halfWarned = false;
        m.wantedFloor = 2;
        reportCrime(world, 2);
        world.showToast('Vera is in. "Pier at the north-east point. Drive like you mean it."', 5);
      } else if (m.step === 1) {
        d.timer -= dt;
        if (d.timer < 75 && !d.halfWarned) {
          d.halfWarned = true;
          m.wantedFloor = 3;
          reportCrime(world, 3);
          world.showToast('Radios spike — three stars. The ferry will not wait.', 4.5);
        }
        if (d.timer <= 0) {
          failMission(world, 'The ferry left without her. Vera is not pleased.');
          break;
        }
        if (near(world, L.ferryPier, 72, true)) {
          m.wantedFloor = 0;
          clearWanted(world);
          completeMission(world, 900);
        }
      }
      break;
    }
    default:
      break;
  }
}

function scareAndReport(world, point) {
  reportCrime(world, 1);
  void point;
}
