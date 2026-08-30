import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MyProfilePage } from './MyProfilePage';
import {
  createLink,
  deleteLink,
  getMyProfile,
  reorderLinks,
  updateLink,
  updateMyProfile,
  uploadAvatar,
  type ProfileResponse,
} from '../api/profile';
import { useAuthStore } from '../stores/authStore';

vi.mock('../api/profile', () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  createLink: vi.fn(),
  updateLink: vi.fn(),
  deleteLink: vi.fn(),
  reorderLinks: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
  uploadAward: vi.fn(),
  updateAward: vi.fn(),
  deleteAward: vi.fn(),
  reorderAwards: vi.fn(),
  getMyProfileQr: vi.fn(() => Promise.resolve('<svg></svg>')),
  publicCardUrl: vi.fn((u: string) => `http://localhost/@${u}`),
  AVATAR_CONTENT_TYPES: ['image/png', 'image/jpeg', 'image/webp'],
  AVATAR_MAX_BYTES: 2 * 1024 * 1024,
  AWARD_CONTENT_TYPES: ['image/png', 'image/jpeg', 'image/webp'],
  AWARD_MAX_BYTES: 5 * 1024 * 1024,
}));

const getMyProfileMock = vi.mocked(getMyProfile);
const createLinkMock = vi.mocked(createLink);
const updateLinkMock = vi.mocked(updateLink);
const uploadAvatarMock = vi.mocked(uploadAvatar);

const PROFILE: ProfileResponse = {
  id: 'p1',
  username: 'alice',
  display_name: 'Alice',
  bio: 'Guide',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  links: [{ id: 'l1', label: 'Website', url: 'https://alice.example', type: 'GENERIC', position: 0 }],
  awards: [],
  locale: 'en',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MyProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyProfilePage', () => {
  beforeEach(() => {
    vi.mocked(getMyProfile).mockReset();
    vi.mocked(updateMyProfile).mockReset();
    vi.mocked(createLink).mockReset();
    vi.mocked(updateLink).mockReset();
    vi.mocked(deleteLink).mockReset();
    vi.mocked(reorderLinks).mockReset();
    vi.mocked(uploadAvatar).mockReset();
    useAuthStore.getState().setSession('test-token', 'test-refresh');
  });

  it('loads the profile and shows existing links', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    renderPage();

    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByText('Website')).toBeInTheDocument();
  });

  it('uploads a selected avatar image', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    uploadAvatarMock.mockResolvedValue({ ...PROFILE, avatar_url: 'http://minio/beamcard-avatars/a.png' });
    renderPage();
    await screen.findByDisplayValue('Alice');

    const file = new File([new Uint8Array([1, 2, 3])], 'me.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => expect(uploadAvatarMock).toHaveBeenCalledWith(file));
  });

  it('rejects an oversized or wrong-type avatar before uploading', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    const pdf = new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Bypass the input's accept filter so the component's own guard runs.
    await userEvent.upload(input, pdf, { applyAccept: false });

    expect(await screen.findByText(/PNG, JPEG, or WebP/i)).toBeInTheDocument();
    expect(uploadAvatarMock).not.toHaveBeenCalled();
  });

  it('creates a link from the add form', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    createLinkMock.mockResolvedValue({
      id: 'l2',
      label: 'Insta',
      url: 'https://instagram.com/alice',
      type: 'INSTAGRAM',
      position: 1,
    });
    renderPage();
    await screen.findByDisplayValue('Alice');

    // Typed link: pick the platform, no separate label — it's derived.
    await userEvent.click(screen.getByRole('tab', { name: /links/i }));
    await userEvent.selectOptions(screen.getByLabelText('Link type'), 'INSTAGRAM');
    expect(screen.queryByLabelText('Label')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Instagram link'), 'https://instagram.com/alice');
    await userEvent.click(screen.getByRole('button', { name: /add link/i }));

    await waitFor(() =>
      // TanStack Query 5 passes a second context arg to the mutationFn.
      expect(createLinkMock).toHaveBeenCalledWith(
        { label: 'Instagram', url: 'https://instagram.com/alice', type: 'INSTAGRAM' },
        expect.anything(),
      ),
    );
  });

  it('saves the primary location and a workplace (street only)', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    vi.mocked(updateMyProfile).mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'Austria');
    await userEvent.type(screen.getByLabelText('City'), 'Vienna');
    await userEvent.click(screen.getByRole('tab', { name: /workplaces/i }));
    await userEvent.type(screen.getByLabelText('Role 1'), 'Trainer');
    await userEvent.type(screen.getByLabelText('Organization 1'), 'FitGym');
    await userEvent.type(screen.getByLabelText('Address 1'), 'Stephansplatz 1');
    await userEvent.type(screen.getByLabelText('Description 1'), 'Entrance B');

    // Auto-save: no button — the debounced write fires after edits settle.
    await waitFor(
      () =>
        expect(vi.mocked(updateMyProfile)).toHaveBeenCalledWith(
          expect.objectContaining({
            location: { country: 'Austria', city: 'Vienna' },
            affiliations: [
              {
                role: 'Trainer',
                organization: 'FitGym',
                address: 'Stephansplatz 1',
                description: 'Entrance B',
                opening_hours: [],
              },
            ],
          }),
          expect.anything(),
        ),
      { timeout: 2000 },
    );
  });

  it('adds and removes workplace rows', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.click(screen.getByRole('tab', { name: /workplaces/i }));
    expect(screen.getByLabelText('Role 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add workplace/i }));
    expect(screen.getByLabelText('Role 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove workplace 2/i }));
    expect(screen.queryByLabelText('Role 2')).not.toBeInTheDocument();
  });

  it('offers a localized country select (values stay English)', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    // The country field is a <select> of localized names whose values are canonical English.
    const select = screen.getByLabelText('Country');
    expect(select.tagName).toBe('SELECT');
    expect(select.querySelector('option[value="Austria"]')).toBeInTheDocument();
  });

  it('prepends the platform base URL when only a handle is typed', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    createLinkMock.mockResolvedValue({
      id: 'l3',
      label: 'Telegram',
      url: 'https://t.me/yehor_br',
      type: 'TELEGRAM',
      position: 1,
    });
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.click(screen.getByRole('tab', { name: /links/i }));
    await userEvent.selectOptions(screen.getByLabelText('Link type'), 'TELEGRAM');
    // The field is just the handle — the https://t.me/ prefix is shown as an adornment.
    await userEvent.type(screen.getByLabelText('Telegram link'), 'yehor_br');
    await userEvent.click(screen.getByRole('button', { name: /add link/i }));

    await waitFor(() =>
      expect(createLinkMock).toHaveBeenCalledWith(
        { label: 'Telegram', url: 'https://t.me/yehor_br', type: 'TELEGRAM' },
        expect.anything(),
      ),
    );
  });

  it('adds a price item and saves it with the chosen currency', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    vi.mocked(updateMyProfile).mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.click(screen.getByRole('tab', { name: /services/i }));
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await userEvent.type(screen.getByLabelText('Service name 1'), 'Consultation');
    await userEvent.type(screen.getByLabelText('Price 1'), '50');
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR');

    await waitFor(
      () =>
        expect(vi.mocked(updateMyProfile)).toHaveBeenCalledWith(
          expect.objectContaining({
            currency: 'EUR',
            price_items: [{ name: 'Consultation', price_type: 'EXACT', duration_minutes: 60, amount_min: 50 }],
          }),
          expect.anything(),
        ),
      { timeout: 2000 },
    );
  });

  it('saves a price range with two amounts', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    vi.mocked(updateMyProfile).mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.click(screen.getByRole('tab', { name: /services/i }));
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await userEvent.type(screen.getByLabelText('Service name 1'), 'Full project');
    await userEvent.selectOptions(screen.getByLabelText('Price type 1'), 'RANGE');
    await userEvent.type(screen.getByLabelText('Price from 1'), '500');
    await userEvent.type(screen.getByLabelText('Price to 1'), '1200');

    await waitFor(
      () =>
        expect(vi.mocked(updateMyProfile)).toHaveBeenCalledWith(
          expect.objectContaining({
            price_items: [
              { name: 'Full project', price_type: 'RANGE', duration_minutes: 60, amount_min: 500, amount_max: 1200 },
            ],
          }),
          expect.anything(),
        ),
      { timeout: 2000 },
    );
  });

  it('reorders price items with the up/down controls', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    vi.mocked(updateMyProfile).mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.click(screen.getByRole('tab', { name: /services/i }));
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await userEvent.type(screen.getByLabelText('Service name 1'), 'First');
    await userEvent.type(screen.getByLabelText('Price 1'), '10');
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    await userEvent.type(screen.getByLabelText('Service name 2'), 'Second');
    await userEvent.type(screen.getByLabelText('Price 2'), '20');

    // Move the second row above the first; auto-save picks up the new order.
    await userEvent.click(screen.getByRole('button', { name: /move service 2 up/i }));

    await waitFor(
      () =>
        expect(vi.mocked(updateMyProfile)).toHaveBeenCalledWith(
          expect.objectContaining({
            price_items: [
              { name: 'Second', price_type: 'EXACT', duration_minutes: 60, amount_min: 20 },
              { name: 'First', price_type: 'EXACT', duration_minutes: 60, amount_min: 10 },
            ],
          }),
          expect.anything(),
        ),
      { timeout: 2000 },
    );
  });

  it('adds and removes price-item rows', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    renderPage();
    await screen.findByDisplayValue('Alice');

    await userEvent.click(screen.getByRole('tab', { name: /services/i }));
    expect(screen.queryByLabelText('Service name 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add service/i }));
    expect(screen.getByLabelText('Service name 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove service 1/i }));
    expect(screen.queryByLabelText('Service name 1')).not.toBeInTheDocument();
  });

  it('edits an existing link in place', async () => {
    getMyProfileMock.mockResolvedValue(PROFILE);
    updateLinkMock.mockResolvedValue({ ...PROFILE.links[0], label: 'Home', url: 'https://alice.dev' });
    renderPage();
    await screen.findByDisplayValue('Alice');

    // Open the inline editor for the GENERIC link, change both fields, save.
    await userEvent.click(screen.getByRole('tab', { name: /links/i }));
    await userEvent.click(screen.getByRole('button', { name: /edit website/i }));
    const labelInput = screen.getByLabelText('Edit label');
    const urlInput = screen.getByLabelText('Edit URL');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, 'Home');
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, 'https://alice.dev');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(updateLinkMock).toHaveBeenCalledWith(
        'l1',
        { label: 'Home', url: 'https://alice.dev' },
        // mutationFn maps to updateLink(id, body); no trailing context arg here.
      ),
    );
  });
});
