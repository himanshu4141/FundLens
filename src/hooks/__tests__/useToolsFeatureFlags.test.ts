import { useAppStore, type AppStore } from '@/src/store/appStore';
import { useToolsFeatureFlags } from '../useToolsFeatureFlags';

jest.mock('@/src/store/appStore', () => ({
  useAppStore: jest.fn(),
}));

const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

function mockFlags(overrides: Partial<ReturnType<typeof useToolsFeatureFlags>> = {}) {
  const flags = {
    goalPlanner: false,
    pastSipCheck: false,
    compareFunds: false,
    directVsRegular: false,
    ...overrides,
  };
  mockUseAppStore.mockImplementation((selector: (state: AppStore) => unknown) =>
    selector({ toolsFlags: flags } as unknown as AppStore),
  );
  return flags;
}

describe('useToolsFeatureFlags', () => {
  it('returns all false and anyAvailable=false by default', () => {
    mockFlags();
    const result = useToolsFeatureFlags();
    expect(result.goalPlanner).toBe(false);
    expect(result.pastSipCheck).toBe(false);
    expect(result.compareFunds).toBe(false);
    expect(result.directVsRegular).toBe(false);
    expect(result.anyAvailable).toBe(false);
  });

  it('sets anyAvailable=true when goalPlanner is true', () => {
    mockFlags({ goalPlanner: true });
    const result = useToolsFeatureFlags();
    expect(result.goalPlanner).toBe(true);
    expect(result.anyAvailable).toBe(true);
  });

  it('sets anyAvailable=true when pastSipCheck is true', () => {
    mockFlags({ pastSipCheck: true });
    const result = useToolsFeatureFlags();
    expect(result.anyAvailable).toBe(true);
  });

  it('sets anyAvailable=true when compareFunds is true', () => {
    mockFlags({ compareFunds: true });
    const result = useToolsFeatureFlags();
    expect(result.anyAvailable).toBe(true);
  });

  it('sets anyAvailable=true when directVsRegular is true', () => {
    mockFlags({ directVsRegular: true });
    const result = useToolsFeatureFlags();
    expect(result.anyAvailable).toBe(true);
  });

  it('reflects all flags when all are true', () => {
    mockFlags({ goalPlanner: true, pastSipCheck: true, compareFunds: true, directVsRegular: true });
    const result = useToolsFeatureFlags();
    expect(result.goalPlanner).toBe(true);
    expect(result.pastSipCheck).toBe(true);
    expect(result.compareFunds).toBe(true);
    expect(result.directVsRegular).toBe(true);
    expect(result.anyAvailable).toBe(true);
  });
});
