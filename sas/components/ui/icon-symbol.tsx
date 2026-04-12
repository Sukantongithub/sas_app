// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi)
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {

  // ── Navigation ────────────────────────────────────────────────────────────
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'arrow.right.square.fill': 'logout',

  // ── Basic Actions ─────────────────────────────────────────────────────────
  'plus': 'add',
  'minus': 'remove',
  'xmark': 'close',
  'trash': 'delete',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'pencil.fill': 'edit',
  'checkmark': 'check',
  'arrow.down.doc.fill': 'save-alt',
  'square.and.pencil': 'edit-note',

  // ── Circle action icons  (REQUIRED for timetable delete / add buttons) ────
  'minus.circle.fill': 'remove-circle',
  'minus.circle': 'remove-circle-outline',
  'plus.circle.fill': 'add-circle',
  'plus.circle': 'add-circle-outline',
  'xmark.circle.fill': 'cancel',
  'xmark.circle': 'highlight-off',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.circle': 'check-circle-outline',

  // ── Status / Info ─────────────────────────────────────────────────────────
  'info.circle.fill': 'info',
  'info.circle': 'info-outline',
  'exclamationmark.triangle.fill': 'warning',
  'questionmark.circle': 'help-outline',
  'lock.shield.fill': 'security',

  // ── Stacks / Layers  (REQUIRED for class picker icon) ────────────────────
  'rectangle.stack.fill': 'layers',
  'rectangle.stack': 'layers-outlined',
  'rectangle.3.group': 'dashboard',

  // ── People & Students ─────────────────────────────────────────────────────
  'person.3.fill': 'groups',
  'person.2.fill': 'people',
  'person.2.circle.fill': 'manage-accounts',
  'person.fill': 'person',
  'person': 'person-outline',
  'person.circle.fill': 'account-circle',

  // ── Communication ─────────────────────────────────────────────────────────
  'envelope.fill': 'email',
  'envelope': 'mail-outline',
  'bubble.right.fill': 'chat',
  'bubble.right': 'chat-bubble-outline',
  'bubble.left.and.bubble.right.fill': 'question-answer',
  'bubble.left.and.bubble.right': 'chat-bubble-outline',

  // ── Education ─────────────────────────────────────────────────────────────
  'book.fill': 'menu-book',
  'book': 'book',
  'graduationcap.fill': 'school',

  // ── Analytics & Charts ────────────────────────────────────────────────────
  'chart.pie.fill': 'pie-chart',
  'chart.bar.fill': 'bar-chart',

  // ── Numbers & Tags ───────────────────────────────────────────────────────
  'number': 'tag',

  // ── Time & Calendar ───────────────────────────────────────────────────────
  'calendar': 'calendar-today',
  'calendar.fill': 'calendar-month',
  'calendar.badge.clock': 'schedule',
  'calendar.badge.exclamationmark': 'event-busy',
  'clock.fill': 'access-time',
  'clock': 'schedule',

  // ── Notifications ─────────────────────────────────────────────────────────
  'bell': 'notifications-none',
  'bell.fill': 'notifications',

  // ── Inbox / Storage ───────────────────────────────────────────────────────
  'tray.and.arrow.down.fill': 'move-to-inbox',
  'tray.and.arrow.down': 'inbox',

} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 * If you use an unmapped name, MaterialIcons receives `undefined` and renders nothing —
 * which also silently breaks any TouchableOpacity wrapping the icon.
 * Always add new SF Symbol names to MAPPING above before using them.
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
