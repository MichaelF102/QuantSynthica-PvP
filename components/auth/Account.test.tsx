import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDLE_SYNC, authStore } from '@/store/authStore';
import { AccountButton } from './AccountButton';
import { ProfileView } from './ProfileView';

// Plan M14 A8. The Firebase SDK is never loaded here: the store is set directly.

const USER = { uid: 'u1', name: 'Ann Example', email: 'ann@example.com', photoURL: null };
const set = (patch: Partial<ReturnType<typeof authStore.getState>>) => act(() => authStore.setState(patch));

beforeEach(() => {
  localStorage.clear();
  set({ status: 'loading', user: null, sync: IDLE_SYNC, error: null });
});

describe('AccountButton', () => {
  it('is hidden when the site has no Firebase config', () => {
    set({ status: 'off' });
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('signs in, then links to the profile', async () => {
    const signIn = vi.fn(async () => {});
    set({ status: 'signed_out', signIn });
    const { rerender } = render(<AccountButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(signIn).toHaveBeenCalled();
    set({ status: 'signed_in', user: USER });
    rerender(<AccountButton />);
    expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute('href', '/profile');
  });
});

describe('ProfileView', () => {
  it('explains accounts when signed out and shows sign-in errors', () => {
    set({ status: 'signed_out', error: 'Sign-in failed. Try again.' });
    render(<ProfileView />);
    expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
    expect(screen.getByText('Sign-in failed. Try again.')).toBeInTheDocument();
  });

  it('shows the account, sync status, nickname and the account actions', async () => {
    const syncNow = vi.fn(async () => {});
    const signOut = vi.fn(async () => {});
    const deleteAccount = vi.fn(async () => true);
    set({ status: 'signed_in', user: USER, sync: { state: 'done', at: Date.UTC(2026, 10, 7, 12), error: null, results: 12, duels: 3 }, syncNow, signOut, deleteAccount });
    render(<ProfileView />);
    expect(screen.getByText('Ann Example')).toBeInTheDocument();
    expect(screen.getByText('12 practice results · 3 1v1 results')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Your name'), 'Annie');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(localStorage.getItem('qs-pvp:nickname')).toBe('Annie');

    await userEvent.click(screen.getByRole('button', { name: /Sync now/ }));
    expect(syncNow).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    expect(signOut).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Delete account/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!);
    expect(deleteAccount).toHaveBeenCalled();
  });

  it('says when the site has no accounts', () => {
    set({ status: 'off' });
    render(<ProfileView />);
    expect(screen.getByText('Accounts are not set up on this site')).toBeInTheDocument();
  });
});
