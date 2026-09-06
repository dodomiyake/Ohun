import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';
import authStyles from './shells/AuthShell.module.css';

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('web shells', () => {
  it('renders the authentication shell by default', () => {
    renderRoute('/auth');

    expect(screen.getByRole('heading', { level: 1, name: 'Ohun' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('keeps a persistent password label with a descriptive placeholder', () => {
    renderRoute('/auth');

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('placeholder', 'Enter your password');
    expect(password).not.toHaveAttribute('placeholder', '••••••••');
  });

  it('renders the tablet shell with a single Chats h1', () => {
    renderRoute('/tablet');

    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('Chats');
    expect(screen.getByRole('heading', { level: 2, name: 'Conversation' })).toBeInTheDocument();
  });

  it('renders the desktop three-panel shell with Chats as h1', () => {
    renderRoute('/desktop');

    expect(screen.getByRole('navigation', { name: 'Desktop primary' })).toBeInTheDocument();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('Chats');
    expect(screen.getByRole('heading', { level: 2, name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('places the milestone banner inside the header landmark', () => {
    renderRoute('/auth');

    const banner = screen.getByText(/Milestone 1 static shells/i);
    expect(banner.closest('header')).not.toBeNull();
  });

  it('does not activate disabled auth actions', () => {
    renderRoute('/auth');

    const signIn = screen.getByRole('button', { name: 'Sign in' });
    expect(signIn).toBeDisabled();
    fireEvent.click(signIn);
    expect(screen.getByRole('heading', { level: 1, name: 'Ohun' })).toBeInTheDocument();
  });

  it('exposes a skip link that targets main', () => {
    renderRoute('/auth');

    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
  });

  it('does not expose public-room or dark-theme controls', () => {
    renderRoute('/auth');

    expect(screen.queryByText(/Select a Room/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dark mode|toggle dark/i })).not.toBeInTheDocument();
  });

  it('applies the Nunito brand token to the Ohun heading', () => {
    renderRoute('/auth');

    const heading = screen.getByRole('heading', { level: 1, name: 'Ohun' });
    expect(heading.className).toContain(authStyles.title);
    // CSS Modules + tokens: brand face is Nunito ExtraBold (800).
    expect(authStyles.title).toBeTruthy();
  });

  it('keeps body copy off the brand font class', () => {
    renderRoute('/auth');

    const subtitle = screen.getByText(/Sign in to continue private conversations/i);
    expect(subtitle.className).toContain(authStyles.subtitle);
    expect(subtitle.className).not.toContain(authStyles.title);
  });
});
