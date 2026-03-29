import { Colors, Radii, Spacing, Typography } from '@/src/constants/theme';
import { EditorialColors, EditorialTypography } from '@/src/constants/themeEditorial';
import { useAppStore } from '@/src/store/appStore';

export function useThemeVariant() {
  const designVariant = useAppStore((state) => state.designVariant);

  return {
    designVariant,
    colors: designVariant === 'editorial' ? EditorialColors : Colors,
    spacing: Spacing,
    radii: Radii,
    typography: designVariant === 'editorial' ? EditorialTypography : Typography,
    isEditorial: designVariant === 'editorial',
  };
}
