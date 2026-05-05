import {
  formatInboxAddress,
  getInboxDomain,
  isValidInboxToken,
  parseInboxToken,
} from '../casInboxToken';

const ENV_BACKUP = process.env.EXPO_PUBLIC_INBOUND_DOMAIN;

afterEach(() => {
  if (ENV_BACKUP === undefined) {
    delete process.env.EXPO_PUBLIC_INBOUND_DOMAIN;
  } else {
    process.env.EXPO_PUBLIC_INBOUND_DOMAIN = ENV_BACKUP;
  }
});

describe('getInboxDomain', () => {
  it('returns the prod default when env is unset', () => {
    delete process.env.EXPO_PUBLIC_INBOUND_DOMAIN;
    expect(getInboxDomain()).toBe('foliolens.in');
  });

  it('returns the dev subdomain when env is set to it', () => {
    process.env.EXPO_PUBLIC_INBOUND_DOMAIN = 'dev.foliolens.in';
    expect(getInboxDomain()).toBe('dev.foliolens.in');
  });

  it('falls back to prod default when env is empty string', () => {
    process.env.EXPO_PUBLIC_INBOUND_DOMAIN = '';
    expect(getInboxDomain()).toBe('foliolens.in');
  });
});

describe('isValidInboxToken', () => {
  it('accepts an 8-char unambiguous-base32 token', () => {
    expect(isValidInboxToken('A2B3C4D5')).toBe(true);
    expect(isValidInboxToken('ZZZZZZZZ')).toBe(true);
    expect(isValidInboxToken('22222222')).toBe(true);
  });

  it('rejects ambiguous characters (0, O, 1, I, L)', () => {
    expect(isValidInboxToken('A0B3C4D5')).toBe(false);
    expect(isValidInboxToken('AOB3C4D5')).toBe(false);
    expect(isValidInboxToken('A1B3C4D5')).toBe(false);
    expect(isValidInboxToken('AIB3C4D5')).toBe(false);
    expect(isValidInboxToken('ALB3C4D5')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidInboxToken('A2B3C4D')).toBe(false);
    expect(isValidInboxToken('A2B3C4D5E')).toBe(false);
    expect(isValidInboxToken('')).toBe(false);
  });

  it('rejects lowercase (canonical form is uppercase)', () => {
    expect(isValidInboxToken('a2b3c4d5')).toBe(false);
  });
});

describe('formatInboxAddress', () => {
  it('builds the canonical cas+token address on prod', () => {
    delete process.env.EXPO_PUBLIC_INBOUND_DOMAIN;
    expect(formatInboxAddress('A2B3C4D5')).toBe('cas+A2B3C4D5@foliolens.in');
  });

  it('builds the dev address when env points at the dev subdomain', () => {
    process.env.EXPO_PUBLIC_INBOUND_DOMAIN = 'dev.foliolens.in';
    expect(formatInboxAddress('A2B3C4D5')).toBe('cas+A2B3C4D5@dev.foliolens.in');
  });

  it('throws on invalid tokens so UI never renders a broken address', () => {
    expect(() => formatInboxAddress('a2b3c4d5')).toThrow();
    expect(() => formatInboxAddress('NOPE')).toThrow();
  });
});

describe('parseInboxToken', () => {
  it('extracts a bare email', () => {
    expect(parseInboxToken('cas+A2B3C4D5@foliolens.in')).toBe('A2B3C4D5');
  });

  it('handles angle-bracket form', () => {
    expect(parseInboxToken('<cas+A2B3C4D5@foliolens.in>')).toBe('A2B3C4D5');
  });

  it('handles display-name form', () => {
    expect(parseInboxToken('FolioLens Inbox <cas+A2B3C4D5@foliolens.in>')).toBe('A2B3C4D5');
  });

  it('uppercases for canonical comparison', () => {
    expect(parseInboxToken('cas+a2b3c4d5@foliolens.in')).toBe('A2B3C4D5');
  });

  it('returns first match when multiple recipients are listed', () => {
    expect(parseInboxToken('foo@bar.com, cas+A2B3C4D5@foliolens.in')).toBe('A2B3C4D5');
  });

  it('returns null when the address lives on a different domain', () => {
    expect(parseInboxToken('cas+A2B3C4D5@example.com')).toBeNull();
  });

  it('only matches the env-resolved domain — dev parser ignores prod addresses and vice versa', () => {
    process.env.EXPO_PUBLIC_INBOUND_DOMAIN = 'dev.foliolens.in';
    expect(parseInboxToken('cas+A2B3C4D5@dev.foliolens.in')).toBe('A2B3C4D5');
    expect(parseInboxToken('cas+A2B3C4D5@foliolens.in')).toBeNull();

    delete process.env.EXPO_PUBLIC_INBOUND_DOMAIN;
    expect(parseInboxToken('cas+A2B3C4D5@foliolens.in')).toBe('A2B3C4D5');
    expect(parseInboxToken('cas+A2B3C4D5@dev.foliolens.in')).toBeNull();
  });

  it('returns null when the local part is missing the cas+ prefix', () => {
    expect(parseInboxToken('inbox@foliolens.in')).toBeNull();
  });

  it('returns null when the token portion has invalid characters', () => {
    // Plus-extension exists but ambiguous chars fail token validation
    expect(parseInboxToken('cas+0OIL2345@foliolens.in')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(parseInboxToken('')).toBeNull();
    expect(parseInboxToken(null)).toBeNull();
    expect(parseInboxToken(undefined)).toBeNull();
  });
});
