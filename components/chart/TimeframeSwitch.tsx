import { Segmented } from '@/components/ui';
import { TIMEFRAMES } from '@/lib/config';
import type { Timeframe } from '@/lib/types';

const OPTIONS = TIMEFRAMES.map((tf) => ({ value: tf as Timeframe, label: tf }));

export function TimeframeSwitch({ value, onChange, disabled, only }: { value: Timeframe; onChange: (tf: Timeframe) => void; disabled?: boolean; only?: readonly Timeframe[] }) {
  const options = only ? OPTIONS.filter((o) => only.includes(o.value)) : OPTIONS;
  return <Segmented<Timeframe> label="Timeframe" options={options} value={value} onChange={onChange} disabled={disabled} />;
}
