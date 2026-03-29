/**
 * @jest-environment node
 */

const mockSetSession = jest.fn();
const mockSetLoading = jest.fn();
const mockUnsubscribe = jest.fn();
const mockThen = jest.fn();

jest.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => effect(),
  useState: (initial: unknown) => {
    if (initial === null) return [initial, mockSetSession];
    return [initial, mockSetLoading];
  },
}));

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => ({
        then: mockThen,
      })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })),
    },
  },
}));

describe('useSession()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockThen.mockImplementation((handler: (value: { data: { session: { id: string } | null } }) => void) => {
      handler({ data: { session: { id: 'session-1' } } });
    });
  });

  it('loads the initial session and clears loading', async () => {
    const { useSession } = await import('../useSession');

    const result = useSession();

    expect(result).toEqual({ session: null, loading: true });
    expect(mockSetSession).toHaveBeenCalledWith({ id: 'session-1' });
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });

  it('subscribes to auth state changes', async () => {
    const { supabase } = await import('@/src/lib/supabase');
    const { useSession } = await import('../useSession');

    useSession();

    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
  });
});
