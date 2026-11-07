import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { StatTile } from './StatTile';

describe('EmptyState', () => {
  it('shows the title and hint', () => {
    render(<EmptyState title="No matches yet" hint="Start a practice match." />);
    expect(screen.getByText('No matches yet')).toBeInTheDocument();
    expect(screen.getByText('Start a practice match.')).toBeInTheDocument();
  });
});

describe('StatTile', () => {
  it('renders a missing value as a muted dash, not zero', () => {
    render(<StatTile label="Win rate" value="—" />);
    expect(screen.getByText('—')).toHaveClass('text-faint');
  });
});
