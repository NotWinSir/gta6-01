// Boot and the one loop for Coral Bay Heat. The world advances in fixed 1/60 s steps; the
// screens are title, play, pause and the busted/wasted incident card, after which Marco
// respawns at the station or the hospital. The first key press or click unlocks the audio
// and starts the music, as browsers require a gesture. A run continues from the localStorage
// save when the player asks for it, in the same seeded city every time.
//
// ?seed=N fixes the city seed. ?shot=cover|chase|foot|mission (with &seed=N) stages that
// screenshot scene instead of running the loop, paints it twice and sets window.__shotReady.
import { createInput } from './input.js';
import { createWorld, respawnAfterIncident } from './world.js';
import { drawWorld } from './render.js';
import { drawHud, drawTitleScreen, drawPauseScreen, drawIncidentScreen } from './hud.js';
import { currentObjective } from './missions.js';
import { loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const GAME_SEED = 20261118;
const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : GAME_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

function fitCanvas(world) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (world) world.view = { w: canvas.width, h: canvas.height };
}

function runShot(name) {
  const world = createWorld(seed);
  fitCanvas(world);
  stageShot(world, name);
  const input = createInput(canvas);
  const objective = currentObjective(world);
  let painted = 0;
  function paint() {
    drawWorld(ctx, world, objective);
    drawHud(ctx, world, objective, input);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function applySave(world, save) {
  world.money = save.money;
  world.respect = save.respect || 0;
  world.missions.index = Math.min(save.missionIndex, 5);
  world.missions.storyDone = Boolean(save.storyDone);
  world.playSeconds = save.playSeconds || 0;
  if (save.player && Number.isFinite(save.player.x) && Number.isFinite(save.player.y)) {
    world.player.x = save.player.x;
    world.player.y = save.player.y;
  }
  world.camera.x = world.player.x - world.view.w / 2;
  world.camera.y = world.player.y - world.view.h / 2;
}

function runGame() {
  const input = createInput(canvas);
  let world = createWorld(GAME_SEED);
  fitCanvas(world);
  window.addEventListener('resize', () => fitCanvas(world));
  let screen = 'title'; // title | play | pause | incident
  let incidentKind = null;
  let incidentTimer = 0;
  let accumulator = 0;
  let last = performance.now();
  let audioStarted = false;

  function announce(message) {
    status.textContent = message;
  }

  function beginAudio() {
    world.audio.unlock();
    if (!audioStarted) {
      audioStarted = true;
      world.audio.setMusic(true);
    }
  }
  window.addEventListener('keydown', beginAudio);
  window.addEventListener('mousedown', beginAudio);

  function startNew() {
    clearSave();
    world = createWorld(GAME_SEED);
    fitCanvas(world);
    screen = 'play';
    announce('A new story in Coral Bay. Meet Vera at the marina.');
  }

  function startContinue() {
    const save = loadSave();
    world = createWorld(GAME_SEED);
    fitCanvas(world);
    if (save) applySave(world, save);
    screen = 'play';
    announce('Welcome back to Coral Bay.');
  }

  function handleScreenKeys() {
    if (screen === 'title') {
      if (input.pressed('Enter')) startNew();
      else if (input.pressed('KeyC') && loadSave()) startContinue();
    } else if (screen === 'play') {
      if (input.pressed('KeyP') || input.pressed('Escape')) {
        screen = 'pause';
        announce('Paused.');
      }
    } else if (screen === 'pause') {
      if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) {
        screen = 'play';
        announce('Playing.');
      }
    }
    if ((screen === 'play' || screen === 'pause') && input.pressed('KeyM')) {
      world.audio.setMusic(!world.audio.musicOn);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleScreenKeys();

    if (screen === 'play') {
      accumulator += frameSeconds;
      while (accumulator >= STEP && screen === 'play') {
        world.update(STEP, input);
        accumulator -= STEP;
        if (world.busted || world.wasted) {
          incidentKind = world.busted ? 'busted' : 'wasted';
          screen = 'incident';
          incidentTimer = 2.8;
          if (incidentKind === 'busted') world.audio.busted();
          else world.audio.fail();
          announce(incidentKind === 'busted' ? 'Busted.' : 'Wasted.');
        }
      }
    } else if (screen === 'incident') {
      incidentTimer -= frameSeconds;
      if (incidentTimer <= 0) {
        respawnAfterIncident(world, incidentKind);
        screen = 'play';
        announce('Back on the street.');
      }
    } else {
      accumulator = 0;
    }

    const objective = currentObjective(world);
    if (screen === 'title') {
      drawTitleScreen(ctx, world, Boolean(loadSave()));
    } else {
      drawWorld(ctx, world, objective);
      if (screen === 'play') drawHud(ctx, world, objective, input);
      else if (screen === 'pause') drawPauseScreen(ctx, world);
      else if (screen === 'incident') drawIncidentScreen(ctx, world, incidentKind);
    }
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      announce('Paused.');
    }
  });

  announce('Coral Bay Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
