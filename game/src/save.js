// The save file: one JSON record in localStorage holding the story progress, the money, the
// respect rank and where Marco was standing, so Continue picks the run back up. Storage can
// be unavailable (private windows, blocked cookies); every call here then quietly no-ops and
// the game simply lasts for the visit.
const SAVE_KEY = 'coral-bay-heat.save.v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(world) {
  try {
    const player = world.player;
    const data = {
      money: Math.round(world.money),
      missionIndex: world.missions.index,
      storyDone: world.missions.storyDone,
      respect: world.respect,
      player: { x: Math.round(player.x), y: Math.round(player.y) },
      playSeconds: Math.round(world.playSeconds),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Saving is a courtesy, never a requirement: ignore a full or blocked store.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear if storage itself is unavailable.
  }
}
