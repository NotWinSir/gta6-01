// A tiny seeded random number generator (mulberry32) so a city built from a seed is the same
// city every time: the screenshot scenes and the saved game both rely on that promise.
export function createRng(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of the array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** A shuffled copy of the array. */
    shuffled(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const hold = copy[i];
        copy[i] = copy[j];
        copy[j] = hold;
      }
      return copy;
    },
  };
}
