import { describe, expect, it } from 'vitest';
import { composeUrl, hasPrefix, toHandle } from './linkComposer';

describe('linkComposer', () => {
  it('prepends the platform base URL to a bare handle', () => {
    expect(composeUrl('TELEGRAM', 'yehoriy_br')).toBe('https://t.me/yehoriy_br');
    expect(composeUrl('TWITTER', 'Yehor_Lf')).toBe('https://x.com/Yehor_Lf');
    expect(composeUrl('INSTAGRAM', 'alice')).toBe('https://instagram.com/alice');
    expect(composeUrl('LINKEDIN', 'alice')).toBe('https://linkedin.com/in/alice');
    expect(composeUrl('WHATSAPP', '15551234567')).toBe('https://wa.me/15551234567');
  });

  it('tolerates a leading @ and a pasted full URL', () => {
    expect(composeUrl('TELEGRAM', '@yehoriy_br')).toBe('https://t.me/yehoriy_br');
    expect(composeUrl('INSTAGRAM', 'https://instagram.com/alice')).toBe('https://instagram.com/alice');
    expect(composeUrl('TWITTER', 'x.com/alice')).toBe('https://x.com/alice');
  });

  it('reduces a WhatsApp value to digits', () => {
    expect(composeUrl('WHATSAPP', '+1 (555) 123-4567')).toBe('https://wa.me/15551234567');
  });

  it('leaves prefixless types (generic, email) as the raw value', () => {
    expect(composeUrl('GENERIC', 'https://blog.me')).toBe('https://blog.me');
    expect(composeUrl('EMAIL', 'me@example.com')).toBe('me@example.com');
    expect(hasPrefix('GENERIC')).toBe(false);
    expect(hasPrefix('TELEGRAM')).toBe(true);
  });

  it('toHandle is the inverse for editing', () => {
    expect(toHandle('TELEGRAM', 'https://t.me/yehoriy_br')).toBe('yehoriy_br');
    expect(toHandle('WHATSAPP', 'https://wa.me/15551234567')).toBe('15551234567');
    expect(toHandle('GENERIC', 'https://blog.me')).toBe('https://blog.me');
  });
});
