// A requestAnimationFrame loop with no React in it. The store decides what a frame does.

export type FrameLoopDeps = {
  raf: (cb: FrameRequestCallback) => number;
  caf: (id: number) => void;
  now: () => number;
};

export type FrameLoop = { start: () => void; stop: () => void; readonly running: boolean };

const browserDeps = (): FrameLoopDeps => ({
  raf: (cb) => window.requestAnimationFrame(cb),
  caf: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
});

export function createFrameLoop(onFrame: (dtMs: number) => void, deps: FrameLoopDeps = browserDeps()): FrameLoop {
  let id: number | null = null;
  let last = 0;

  const loop = () => {
    const now = deps.now();
    const dt = now - last;
    last = now;
    id = deps.raf(loop);
    onFrame(dt);
  };

  return {
    start() {
      if (id !== null) return;
      last = deps.now();
      id = deps.raf(loop);
    },
    stop() {
      if (id === null) return;
      deps.caf(id);
      id = null;
    },
    get running() {
      return id !== null;
    },
  };
}
