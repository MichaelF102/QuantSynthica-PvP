import { describe, expect, it, vi } from 'vitest';
import { createFrameLoop, type FrameLoopDeps } from './clock';

/** A hand-cranked requestAnimationFrame. */
function fakeRaf() {
  let t = 0;
  let nextId = 1;
  const queue = new Map<number, FrameRequestCallback>();
  const deps: FrameLoopDeps = {
    raf: (cb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    },
    caf: (id) => void queue.delete(id),
    now: () => t,
  };
  const frame = (dt: number) => {
    t += dt;
    const cbs = [...queue.values()];
    queue.clear();
    cbs.forEach((cb) => cb(t));
  };
  return { deps, frame, pending: () => queue.size };
}

describe('createFrameLoop', () => {
  it('reports the time between frames', () => {
    const { deps, frame } = fakeRaf();
    const onFrame = vi.fn();
    const loop = createFrameLoop(onFrame, deps);
    loop.start();
    frame(16);
    frame(20);
    expect(onFrame.mock.calls.map((c) => c[0])).toEqual([16, 20]);
  });

  it('stops cleanly and starting twice does not double the loop', () => {
    const { deps, frame, pending } = fakeRaf();
    const onFrame = vi.fn();
    const loop = createFrameLoop(onFrame, deps);
    loop.start();
    loop.start();
    expect(pending()).toBe(1);
    loop.stop();
    expect(loop.running).toBe(false);
    frame(16);
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('does not count time spent stopped', () => {
    const { deps, frame } = fakeRaf();
    const onFrame = vi.fn();
    const loop = createFrameLoop(onFrame, deps);
    loop.start();
    frame(16);
    loop.stop();
    frame(5000); // paused for 5 s
    loop.start();
    frame(16);
    expect(onFrame.mock.calls.map((c) => c[0])).toEqual([16, 16]);
  });
});
