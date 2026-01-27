// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navigation
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'arrow.right.square.fill': 'logout',
  
  // Actions
  'plus': 'add',
  'xmark': 'close',
  'trash': 'delete',
  'pencil': 'edit',
  'checkmark': 'check',
  
  // People & Students
  'person.3.fill': 'groups',
  'person.2.fill': 'people',
  'person.fill': 'person',
  'person': 'person-outline',
  'person.circle.fill': 'account-circle',
  
  // Communication
  'envelope.fill': 'email',
  'envelope': 'mail-outline',
  
  // Education
  'book.fill': 'menu-book',
  'book': 'book',
  'graduationcap.fill': 'school',
  'rectangle.3.group': 'dashboard',
  
  // Numbers & Text
  'number': 'tag',
  
  // Time & Calendar
  'calendar': 'calendar-today',
  'calendar.badge.exclamationmark': 'event-busy',
  'clock.fill': 'access-time',
  'clock': 'schedule',
  
  // Status Icons
  'checkmark.circle.fill': 'check-circle',
  'checkmark.circle': 'check-circle-outline',
  'xmark.circle.fill': 'cancel',
  'xmark.circle': 'highlight-off',
  'exclamationmark.triangle.fill': 'warning',
  'questionmark.circle': 'help-outline',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
