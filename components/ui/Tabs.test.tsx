import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

type T = 'positions' | 'orders' | 'history';

function Harness() {
  const [value, setValue] = useState<T>('positions');
  return (
    <Tabs<T>
      label="Account"
      idPrefix="acct"
      value={value}
      onChange={setValue}
      items={[
        { value: 'positions', label: 'Positions', count: 0 },
        { value: 'orders', label: 'Orders' },
        { value: 'history', label: 'History' },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('marks only the active tab as selected and focusable', () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('moves selection and focus with the arrow keys, wrapping around', async () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('selects a tab on click', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  });
});
