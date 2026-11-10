import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CloudUser } from '@/lib/cloud/types';
import { IDLE_SYNC, authStore } from '@/store/authStore';
import { AccountButton } from './AccountButton';
import { ProfileView } from './ProfileView';

// Plans M14 A8 and M16. The Firebase SDK is never loaded here: the store is set directly.

const USER: CloudUser = { uid: 'u1', name: 'Ann Example', email: 'ann@example.com', photoURL: null, provider: 'google', emailVerified: true };
const set = (patch: Partial<ReturnType<typeof authStore.getState>>) => act(() => authStore.setState(patch));

beforeEach(() => {
  localStorage.clear();
  set({ status: 'loading', user: null, sync: IDLE_SYNC, error: null, notice: null });
});

describe('AccountButton', () => {
  it('is hidden when the site has no Firebase config', () => {
    set({ status: 'off' });
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the sign-in dialog, signs in with Google, then links to the profile', async () => {
    const signIn = vi.fn(async () => {});
    set({ status: 'signed_out', signIn });
    const { rerender } = render(<AccountButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign in to QuantSynthica' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Continue with Google/ }));
    expect(signIn).toHaveBeenCalled();
    set({ status: 'signed_in', user: USER });
    rerender(<AccountButton />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute('href', '/profile');
  });
});

describe('SignInForm (plan M16)', () => {
  it('signs in with email and password', async () => {
    const signInEmail = vi.fn(async () => true);
    set({ status: 'signed_out', signInEmail });
    render(<ProfileView />);
    await userEvent.type(screen.getByLabelText('Email'), 'ann@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(signInEmail).toHaveBeenCalledWith('ann@example.com', 'secret-pass');
  });

  it('asks for the missing field before calling the service', async () => {
    const signInEmail = vi.fn(async () => true);
    set({ status: 'signed_out', signInEmail });
    render(<ProfileView />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('creates an account only with a long enough password', async () => {
    const signUpEmail = vi.fn(async () => true);
    set({ status: 'signed_out', signUpEmail });
    render(<ProfileView />);
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    await userEvent.type(screen.getByLabelText(/Name/), 'Ann');
    await userEvent.type(screen.getByLabelText('Email'), 'ann@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText(/at least 8 characters for the password/)).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Password'), '-but-longer');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(signUpEmail).toHaveBeenCalledWith('Ann', 'ann@example.com', 'short-but-longer');
  });

  it('sends a reset link and shows the service error', async () => {
    const resetPassword = vi.fn(async () => true);
    set({ status: 'signed_out', resetPassword, error: 'Too many attempts. Wait a few minutes and try again.' });
    render(<ProfileView />);
    expect(screen.getByText(/Too many attempts/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'ann@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(resetPassword).toHaveBeenCalledWith('ann@example.com');
  });
});

describe('ProfileView', () => {
  it('shows the account, sync status, nickname and the account actions', async () => {
    const syncNow = vi.fn(async () => {});
    const signOut = vi.fn(async () => {});
    const deleteAccount = vi.fn(async () => true);
    set({ status: 'signed_in', user: USER, sync: { state: 'done', at: Date.UTC(2026, 10, 7, 12), error: null, results: 12, duels: 3 }, syncNow, signOut, deleteAccount });
    render(<ProfileView />);
    expect(screen.getByText('Ann Example')).toBeInTheDocument();
    expect(screen.getByText(/Signed in with Google/)).toBeInTheDocument();
    expect(screen.getByText('12 practice results · 3 1v1 results')).toBeInTheDocument();
    expect(screen.queryByText(/Verify your email/)).not.toBeInTheDocument();

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

  it('asks an unverified email account to verify, and can resend or re-check', async () => {
    const resendVerification = vi.fn(async () => {});
    const refreshUser = vi.fn(async () => {});
    set({ status: 'signed_in', user: { ...USER, name: null, provider: 'password', emailVerified: false }, resendVerification, refreshUser });
    render(<ProfileView />);
    expect(screen.getByText('Verify your email to turn on cloud sync')).toBeInTheDocument();
    expect(screen.getByText(/Signed in with email and password/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send the email again' }));
    expect(resendVerification).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: "I've verified it" }));
    expect(refreshUser).toHaveBeenCalled();
  });

  it('says when the site has no accounts', () => {
    set({ status: 'off' });
    render(<ProfileView />);
    expect(screen.getByText('Accounts are not set up on this site')).toBeInTheDocument();
  });
});
