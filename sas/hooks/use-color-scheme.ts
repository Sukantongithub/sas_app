// Force the app to use dark theme across the experience
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
	// Always prefer dark; fallback to React Native scheme if needed later
	return 'dark' as ReturnType<typeof useRNColorScheme>;
}
