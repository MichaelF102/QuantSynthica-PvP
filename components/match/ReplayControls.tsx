'use client';

import { Pause, Play, StepForward } from 'lucide-react';
import { Button, Segmented } from '@/components/ui';
import { SPEEDS } from '@/lib/config';
import { currentCandle, replayProgress, sessionEndTime } from '@/lib/engine';
import { fmtDateTime } from '@/lib/format';
import { useMatchStore, type Speed } from '@/store/matchStore';
import { JumpMenu } from './JumpMenu';

const SPEED_OPTIONS = SPEEDS.map((s) => ({ value: s as Speed, label: `${s}x` }));

/** Play/pause, step, speed and jump, driven by the match store (CLAUDE.md §1, plan M4). */
export function ReplayControls() {
  const match = useMatchStore((s) => s.match);
  const speed = useMatchStore((s) => s.speed);
  const togglePlay = useMatchStore((s) => s.togglePlay);
  const step = useMatchStore((s) => s.step);
  const setSpeed = useMatchStore((s) => s.setSpeed);
  const jumpBy = useMatchStore((s) => s.jumpBy);
  const jumpToTime = useMatchStore((s) => s.jumpToTime);

  if (!match) return null;
  const ended = match.status === 'ended';
  const running = match.status === 'running';
  const { revealed, total } = replayProgress(match);
  const now = currentCandle(match).time;
  const last = sessionEndTime(match);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={running ? 'secondary' : 'primary'}
        onClick={togglePlay}
        disabled={ended}
        aria-label={running ? 'Pause replay' : match.status === 'idle' ? 'Start replay' : 'Resume replay'}
        aria-keyshortcuts="Space"
        className="min-w-[88px] max-sm:min-h-10"
      >
        {running ? <Pause className="w-3.5 h-3.5" aria-hidden /> : <Play className="w-3.5 h-3.5" aria-hidden />}
        {running ? 'Pause' : match.status === 'idle' ? 'Start' : 'Play'}
      </Button>
      <Button variant="secondary" onClick={step} disabled={ended} aria-label="Step one candle" aria-keyshortcuts="ArrowRight" className="max-sm:min-h-10">
        <StepForward className="w-3.5 h-3.5" aria-hidden /> Step
      </Button>
      <Segmented<Speed> label="Replay speed" options={SPEED_OPTIONS} value={speed} onChange={setSpeed} disabled={ended} />
      <JumpMenu disabled={ended} currentTime={now} lastTime={last} onJumpBy={jumpBy} onJumpTo={jumpToTime} />
      <div className="ml-auto flex flex-col items-end text-[11px] font-mono leading-tight">
        <span className="text-slate-300">
          Candle <span className="text-white">{revealed.toLocaleString('en-US')}</span> / {total.toLocaleString('en-US')}
        </span>
        <span className="text-faint">{fmtDateTime(now)}</span>
      </div>
    </div>
  );
}
