// Use theme from ThemeContext
import { useTheme } from '@/context/ThemeContext';

export function useColorScheme() {
	const { colorScheme } = useTheme();
	return colorScheme;
}
