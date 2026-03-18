/**
 * Modern color palette for an attractive, professional UI
 */

import { Platform } from 'react-native';

const tintColorLight = '#6366F1'; // Indigo
const tintColorDark = '#818CF8'; // Light Indigo

export const Colors = {
  light: {
    text: '#1F2937',
    textSecondary: '#6B7280',
    background: '#F9FAFB',
    cardBackground: '#FFFFFF',
    tint: tintColorLight,
    icon: '#6366F1',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    border: '#E5E7EB',
    separator: '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    shadow: 'rgba(0, 0, 0, 0.08)',
    navBarBackground: '#FFFFFF',
    navBarBorder: '#E5E7EB',
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6',
    inputBackground: '#F3F4F6',
    inputFocusBorder: '#6366F1',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    background: '#0F172A',
    cardBackground: '#1E293B',
    tint: tintColorDark,
    icon: '#818CF8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    border: '#334155',
    separator: '#334155',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    shadow: 'rgba(0, 0, 0, 0.3)',
    navBarBackground: '#1E293B',
    navBarBorder: '#334155',
    gradientStart: '#818CF8',
    gradientEnd: '#A78BFA',
    inputBackground: '#334155',
    inputFocusBorder: '#818CF8',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
