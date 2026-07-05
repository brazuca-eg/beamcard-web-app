import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { useAuthStore } from '../stores/authStore';

function renderAt(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<div>App home</div>} />
        <Route path="/signup" element={<div>Signup</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('shows the marketing pitch and CTAs to anonymous visitors', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /one link/i, level: 1 })).toBeInTheDocument();
    // Both the header and the hero point at signup.
    expect(screen.getAllByRole('link', { name: /get started|create your card/i }).length).toBeGreaterThan(0);
  });

  it('redirects signed-in users straight to the dashboard', () => {
    useAuthStore.getState().setSession('access-token', 'refresh-token');
    renderAt('/');
    expect(screen.getByText('App home')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
