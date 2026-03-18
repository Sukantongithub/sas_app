// Use theme from ThemeContext (web version)
import { useTheme } from '@/context/ThemeContext';

export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme;
}
