import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoogleAuthSection } from './GoogleAuthSection';

describe('GoogleAuthSection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('renders nothing when no Google client id is configured', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { container } = render(<GoogleAuthSection text="signin_with" onSuccess={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the divider once a Google client id is set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '123.apps.googleusercontent.com');
    render(<GoogleAuthSection text="signin_with" onSuccess={() => {}} />);
    expect(screen.getByText('or')).toBeInTheDocument();
  });
});
