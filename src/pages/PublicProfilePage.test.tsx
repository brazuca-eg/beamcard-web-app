import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicProfilePage } from './PublicProfilePage';
import { getPublicProfile, type ProfileResponse } from '../api/profile';
import { ApiError } from '../api/client';

vi.mock('../api/profile', () => ({
  getPublicProfile: vi.fn(),
  publicVcardUrl: (u: string) => `http://localhost:8080/profiles/@${u}/vcard`,
}));

const getPublicProfileMock = vi.mocked(getPublicProfile);

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:handle" element={<PublicProfilePage />} />
          <Route path="/app" element={<div>App home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicProfilePage', () => {
  beforeEach(() => {
    getPublicProfileMock.mockReset();
  });

  it('renders the card for an existing username', async () => {
    const profile: ProfileResponse = {
      id: 'uuid',
      username: 'alice',
      display_name: 'Alice Guide',
      bio: 'Mountain guide',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      links: [
        { id: 'l1', label: 'My site', url: 'https://alice.example', type: 'GENERIC', position: 0 },
      ],
      awards: [],
      locale: 'en',
    };
    getPublicProfileMock.mockResolvedValue(profile);

    renderAt('/@alice');

    expect(await screen.findByText('Alice Guide')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('Mountain guide')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'My site' });
    expect(link).toHaveAttribute('href', 'https://alice.example');
    const saveContact = screen.getByRole('link', { name: /save contact/i });
    expect(saveContact).toHaveAttribute('href', 'http://localhost:8080/profiles/@alice/vcard');
    expect(getPublicProfileMock).toHaveBeenCalledWith('alice');
  });

  it('shows the primary location and workplaces (role + street)', async () => {
    getPublicProfileMock.mockResolvedValue({
      id: 'uuid',
      username: 'alice',
      display_name: 'Alice Guide',
      location: { country: 'Austria', city: 'Vienna' },
      affiliations: [
        { role: 'Product Designer', organization: 'Acme', address: 'Stephansplatz 1', description: 'Entrance B' },
      ],
      activities: ['Laparoscopic surgery', 'Ultrasound diagnostics'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      links: [],
      awards: [],
      locale: 'en',
    });

    renderAt('/@alice');

    expect(await screen.findByText(/Vienna, Austria/)).toBeInTheDocument();
    expect(screen.getByText('Main directions')).toBeInTheDocument();
    expect(screen.getByText('Laparoscopic surgery')).toBeInTheDocument();
    expect(screen.getByText('Ultrasound diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Product Designer · Acme')).toBeInTheDocument();
    expect(screen.getByText('Stephansplatz 1')).toBeInTheDocument();
    expect(screen.getByText('Entrance B')).toBeInTheDocument();
    // With no Maps key configured, the workplace still offers a keyless directions link.
    const directions = screen.getByRole('link', { name: /get directions/i });
    expect(directions).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Stephansplatz%201%2C%20Vienna%2C%20Austria',
    );
  });

  it('renders the certificates gallery and opens a lightbox on tap', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    getPublicProfileMock.mockResolvedValue({
      id: 'uuid',
      username: 'alice',
      display_name: 'Alice Guide',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      links: [],
      awards: [
        { id: 'a1', image_url: 'https://cdn/awards/a1.png', description: 'Board Certification 2024', position: 1 },
        { id: 'a2', image_url: 'https://cdn/awards/a2.png', position: 2 },
      ],
      locale: 'en',
    });

    renderAt('/@alice');

    expect(await screen.findByText(/Certificates & awards/i)).toBeInTheDocument();
    const thumbs = screen.getAllByRole('img', { name: /certificate|Board Certification/i });
    expect(thumbs).toHaveLength(2);
    expect(screen.getByText('Board Certification 2024')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByRole('dialog', { name: /certificate/i })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Arrows navigate between certificates.
    await userEvent.click(screen.getByRole('button', { name: /next certificate/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /previous certificate/i }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('shows a not-found state on 404 profile_not_found', async () => {
    getPublicProfileMock.mockRejectedValue(
      new ApiError(404, 'Not Found', { code: 'profile_not_found' }),
    );

    renderAt('/@ghost');

    expect(await screen.findByText(/doesn't exist/i)).toBeInTheDocument();
  });

  it('redirects bare (non-@) paths to the app', async () => {
    renderAt('/random');

    expect(await screen.findByText('App home')).toBeInTheDocument();
    expect(getPublicProfileMock).not.toHaveBeenCalled();
  });
});
