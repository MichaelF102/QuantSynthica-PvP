import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders a real <button> with type="button" by default', () => {
    render(<Button>Buy</Button>);
    const btn = screen.getByRole('button', { name: 'Buy' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Buy</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Buy' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="sell" disabled onClick={onClick}>
        Sell
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Sell' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the variant classes', () => {
    render(<Button variant="buy">Buy</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-emerald-600');
  });
});
