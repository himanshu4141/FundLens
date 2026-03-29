import { useThemeVariant } from '../useThemeVariant';
import { Colors, Radii, Spacing, Typography } from '@/src/constants/theme';
import { EditorialColors, EditorialTypography } from '@/src/constants/themeEditorial';
import { useAppStore } from '@/src/store/appStore';

jest.mock('@/src/store/appStore', () => ({
  useAppStore: jest.fn(),
}));

const mockUseAppStore = useAppStore as unknown as jest.Mock;

describe('useThemeVariant()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the classic token set by default', () => {
    mockUseAppStore.mockImplementation((selector: (state: { designVariant: string }) => unknown) =>
      selector({ designVariant: 'classic' }),
    );

    expect(useThemeVariant()).toEqual({
      designVariant: 'classic',
      colors: Colors,
      spacing: Spacing,
      radii: Radii,
      typography: Typography,
      isEditorial: false,
    });
  });

  it('returns the editorial token set when selected', () => {
    mockUseAppStore.mockImplementation((selector: (state: { designVariant: string }) => unknown) =>
      selector({ designVariant: 'editorial' }),
    );

    expect(useThemeVariant()).toEqual({
      designVariant: 'editorial',
      colors: EditorialColors,
      spacing: Spacing,
      radii: Radii,
      typography: EditorialTypography,
      isEditorial: true,
    });
  });
});
