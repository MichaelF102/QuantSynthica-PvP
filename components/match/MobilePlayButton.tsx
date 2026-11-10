'use client';

import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui';
import { useMatchStore } from '@/store/matchStore';

/** The replay toggle for the phone action bar (practice only: 1v1 has no pause). */
export function MobilePlayButton() {
  const status = useMatchStore((s) => s.match?.status);
  const togglePlay = useMatchStore((s) => s.togglePlay);
  if (!status || status === 'ended') return null;
  const running = status === 'running';
  return (
    <Button variant={running ? 'secondary' : 'primary'} className="min-h-11 min-w-11 px-0" onClick={togglePlay} aria-label={running ? 'Pause replay' : status === 'idle' ? 'Start replay' : 'Resume replay'}>
      {running ? <Pause className="w-4 h-4" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />}
    </Button>
  );
}
