import { fetchSession, callCreateSession } from '../useInboundSession';
import { supabase } from '@/src/lib/supabase';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({ setQueryData: jest.fn() })),
}));
jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(response: { data: unknown; error: unknown }): any {
  const chain: Record<string, unknown> = {
    data: response.data,
    error: response.error,
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };
  ['select', 'eq'].forEach((m) =>
    (chain[m] as jest.Mock).mockReturnValue(chain),
  );
  (chain.maybeSingle as jest.Mock).mockReturnValue(response);
  return chain;
}

const mockFrom = supabase.from as jest.Mock;
const mockInvoke = supabase.functions.invoke as jest.Mock;

// ---------------------------------------------------------------------------
// fetchSession()
// ---------------------------------------------------------------------------

describe('fetchSession()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the inbound email address when found', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: { inbound_email_address: 'abc@import.foliolens.app' }, error: null }),
    );
    const result = await fetchSession('user-1');
    expect(result).toBe('abc@import.foliolens.app');
  });

  it('returns null when no session row exists', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    const result = await fetchSession('user-1');
    expect(result).toBeNull();
  });

  it('returns null when data has no inbound_email_address field', async () => {
    mockFrom.mockReturnValue(makeChain({ data: {}, error: null }));
    const result = await fetchSession('user-1');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// callCreateSession()
// ---------------------------------------------------------------------------

describe('callCreateSession()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the inbound email on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { inboundEmail: 'xyz@import.foliolens.app' },
      error: null,
    });
    const result = await callCreateSession();
    expect(result).toBe('xyz@import.foliolens.app');
  });

  it('throws when the edge function returns an error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function failed' },
    });
    await expect(callCreateSession()).rejects.toThrow('Edge function failed');
  });

  it('throws when data has no inboundEmail field', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    await expect(callCreateSession()).rejects.toThrow('No inbound email returned');
  });

  it('throws when data is null and no error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(callCreateSession()).rejects.toThrow('No inbound email returned');
  });
});
