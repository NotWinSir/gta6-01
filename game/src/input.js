// Keyboard and mouse state for the game: which keys are held, which were pressed this frame
// (an edge, consumed once), and where the mouse points. The world code asks questions of this
// object; it never touches DOM events itself.
export function createInput(canvas) {
  const held = new Set();
  const pressedEdges = new Set();
  const mouse = { x: 0, y: 0, down: false, pressed: false, rightDown: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    pressedEdges.add(event.code);
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.pressed = true;
    }
    if (event.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** True while the key is held down. */
    down(code) {
      return held.has(code);
    },
    /** True once, on the frame the key went down; reading it consumes the edge. */
    pressed(code) {
      if (!pressedEdges.has(code)) return false;
      pressedEdges.delete(code);
      return true;
    },
    /** The WASD / arrow-key movement axis, normalised, in screen space (y down). */
    axis() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = Math.SQRT1_2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Call at the end of a frame: clears the mouse's one-frame press flag. */
    endFrame() {
      mouse.pressed = false;
    },
  };
}
