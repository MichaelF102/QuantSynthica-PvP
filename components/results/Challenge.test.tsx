import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { decodeChallenge } from '@/lib/challenge';
import type { MatchResult } from '@/lib/results';
import { ChallengeButton } from './ChallengeButton';
import { ChallengeCompare } from './ChallengeCompare';

// Plan M13 C1, C5. TEST FIXTURE: a hand-written result, not a real match.

const result = {
  id: 'r1',
  symbol: 'NQ=F',
  sessionStart: 1_791_293_400,
  config: { symbol: 'NQ=F', currency: 'USD', interval: '1m', durationMs: 600_000, startingBalance: 100_000, maxDrawdownPct: 5, lotStep: 1 },
  stats: { returnPct: 1.5, trades: 4, winRate: 75, maxDrawdownPct: 0.6 },
  challenge: { from: 'Ann', score: { returnPct: 0.8, trades: 2, winRate: 50, maxDrawdownPct: 0.9 } },
} as unknown as MatchResult;

describe('ChallengeCompare', () => {
  it('shows both scores and who won', () => {
    render(<ChallengeCompare result={result} />);
    expect(screen.getByText('You beat Ann')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Return/ });
    expect(within(row).getByText('+1.50%')).toBeInTheDocument();
    expect(within(row).getByText('+0.80%')).toBeInTheDocument();
    expect(screen.getByText(/not verified/)).toBeInTheDocument();
  });

  it('renders nothing for a result without a challenge', () => {
    const { container } = render(<ChallengeCompare result={{ ...result, challenge: undefined }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ChallengeButton', () => {
  it('copies a link carrying this session, the rules, the name and the score', async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ChallengeButton result={result} />);
    await userEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }));
    await userEvent.type(screen.getByLabelText('Your name in the link'), 'Bo');
    await userEvent.click(screen.getByRole('button', { name: 'Copy challenge link' }));
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
    const url = new URL(writeText.mock.calls[0][0]);
    expect(url.pathname).toBe('/practice');
    expect(decodeChallenge(url.searchParams.get('challenge'))).toMatchObject({ symbol: 'NQ=F', start: 1_791_293_400, durationMin: 10, from: 'Bo', score: { returnPct: 1.5 } });
  });
});
