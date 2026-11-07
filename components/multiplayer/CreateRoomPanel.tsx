'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { SetupFields } from '@/components/setup/SetupFields';
import { Banner, Button, Panel, Segmented } from '@/components/ui';
import { requestRoom, toRoomSettings } from '@/lib/multiplayer/client';
import type { SeriesLength } from '@/lib/multiplayer/series';
import { ROOM_SPEEDS, type RoomSettings, type RoomSpeed } from '@/lib/multiplayer/settings';
import { defaultForm, loadLastSetup, validateSetup, type SetupForm } from '@/lib/setup';
import type { SymbolInfo } from '@/lib/types';

const SPEEDS = ROOM_SPEEDS.map((s) => ({ value: s, label: `${s}x` }));
const FORMATS = [
  { value: 1 as SeriesLength, label: 'Single game' },
  { value: 3 as SeriesLength, label: 'Best of 3' },
];
type Visibility = 'hidden' | 'open';
const VISIBILITY = [
  { value: 'hidden' as Visibility, label: 'Hidden until the end' },
  { value: 'open' as Visibility, label: 'Visible to both' },
];

type CreateRoomPanelProps = {
  index: SymbolInfo[];
  host: string;
  /** Injectable for tests. */
  create?: (host: string, settings: RoomSettings) => Promise<string>;
};

/** Room settings form. The server picks the random session, so neither player knows it first. */
export function CreateRoomPanel({ index, host, create = requestRoom }: CreateRoomPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState<SetupForm>(() => defaultForm(index, loadLastSetup()));
  const [speed, setSpeed] = useState<RoomSpeed>(1);
  const [series, setSeries] = useState<SeriesLength>(1);
  const [visibility, setVisibility] = useState<Visibility>('hidden');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateSetup(form, index);
  const valid = Object.keys(errors).length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = await create(host, toRoomSettings(form, speed, { series, openPositions: visibility === 'open' }));
      router.push(`/play/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the room.');
      setBusy(false);
    }
  };

  return (
    <Panel title="Create a room" description="You choose the market and the rules. The server picks a random session for both of you." icon={Users}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <SetupFields index={index} form={form} setForm={setForm} errors={errors} touched={touched} />
        <fieldset>
          <legend className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Replay speed</legend>
          <Segmented<RoomSpeed> label="Replay speed" options={SPEEDS} value={speed} onChange={setSpeed} className="w-full [&>button]:flex-1" />
          <p className="mt-1 text-[11px] text-faint">The same for both players. A shared clock runs the replay: no pause, step or jump.</p>
        </fieldset>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <fieldset>
            <legend className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Format</legend>
            <Segmented<SeriesLength> label="Format" options={FORMATS} value={series} onChange={setSeries} className="w-full [&>button]:flex-1" />
            <p className="mt-1 text-[11px] text-faint">{series === 3 ? 'First to 2 game wins. Each game is a new random session.' : 'One game. You can rematch after.'}</p>
          </fieldset>
          <fieldset>
            <legend className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Opponent positions</legend>
            <Segmented<Visibility> label="Opponent positions" options={VISIBILITY} value={visibility} onChange={setVisibility} className="w-full [&>button]:flex-1" />
            <p className="mt-1 text-[11px] text-faint">{visibility === 'open' ? 'Both see each other’s position and trades live. Stops and targets stay private.' : 'Only scores are shared until the end.'}</p>
          </fieldset>
        </div>
        {error && <Banner kind="error">{error}</Banner>}
        <div className="flex justify-end">
          <Button type="submit" disabled={!valid || busy} className="px-5 py-2.5">
            {busy ? 'Creating room…' : 'Create room'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
