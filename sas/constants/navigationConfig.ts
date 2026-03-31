/**
 * Role-based navigation configuration
 * Defines all accessible routes and tab items for each role
 */

export type AppRole = 'admin' | 'super_admin' | 'hod' | 'staff' | 'student' | 'parent';

export interface NavTab {
  name: string;
  route: string;
  icon: string;
  title: string;
  groupName?: string;
}

export interface NavSection {
  name: string;
  path: string;
  icon: string;
  group?: string;
}

export type RoleNavConfig = Record<AppRole, {
  tabs?: NavTab[];
  sidebar?: NavSection[];
  useAdminLayout?: boolean;
}>;

/**
 * Tab-based navigation for non-admin roles
 */
export const TAB_NAVIGATION: RoleNavConfig = {
  parent: {
    tabs: [
      { name: 'Attendance', route: 'parent-attendance', icon: 'chart.bar.fill', title: "Son's Attendance" },
      { name: 'Messages', route: 'alerts', icon: 'bubble.left.and.bubble.right.fill', title: 'Messages' },
      { name: 'Profile', route: 'parent-profile', icon: 'person.circle.fill', title: 'Profile' },
    ],
  },
  student: {
    tabs: [
      { name: 'Attendance', route: 'student-attendance', icon: 'chart.bar.fill', title: 'Attendance' },
      { name: 'Requests', route: 'interactions', icon: 'tray.and.arrow.down.fill', title: 'Requests' },
      { name: 'Timetable', route: 'timetable', icon: 'calendar.fill', title: 'Timetable' },
      { name: 'Messages', route: 'alerts', icon: 'bubble.left.and.bubble.right.fill', title: 'Messages' },
      { name: 'Profile', route: 'profile', icon: 'person.circle.fill', title: 'Profile' },
    ],
  },
  staff: {
    tabs: [
      { name: 'Dashboard', route: 'index', icon: 'house.fill', title: 'Dashboard', groupName: 'Students' },
      { name: 'Mark Attend.', route: 'explore', icon: 'checkmark.circle.fill', title: 'Mark Attendance', groupName: 'Students' },
      { name: 'Requests', route: 'interactions', icon: 'tray.and.arrow.down.fill', title: 'Requests' },
      { name: 'Timetable', route: 'timetable', icon: 'calendar.fill', title: 'Timetable' },
      { name: 'Messages', route: 'alerts', icon: 'bubble.left.and.bubble.right.fill', title: 'Messages' },
      { name: 'Profile', route: 'profile', icon: 'person.circle.fill', title: 'Profile' },
    ],
  },
  hod: {
    tabs: [
      { name: 'Dashboard', route: 'index', icon: 'house.fill', title: 'Dashboard', groupName: 'Students' },
      { name: 'Mark Attend.', route: 'explore', icon: 'checkmark.circle.fill', title: 'Mark Attendance', groupName: 'Students' },
      { name: 'Requests', route: 'interactions', icon: 'tray.and.arrow.down.fill', title: 'Requests' },
      { name: 'Messages', route: 'alerts', icon: 'bubble.left.and.bubble.right.fill', title: 'Messages' },
      { name: 'Timetable', route: 'timetable', icon: 'calendar.fill', title: 'Timetable' },
      { name: 'Profile', route: 'profile', icon: 'person.circle.fill', title: 'Profile' },
    ],
  },
  admin: {
    useAdminLayout: true,
    sidebar: [
      { name: 'Dashboard', path: '/admin', icon: 'house.fill' },
      { name: 'Students', path: '/admin/management/students', icon: 'person.2.fill'},
      { name: 'Staff', path: '/admin/management/staff', icon: 'person.3.fill' },
      { name: 'Analytics', path: '/admin/analytics', icon: 'chart.pie.fill' },
      { name: 'Messages', path: '/admin/communication', icon: 'envelope.fill' },
      { name: 'Profile', path: '/admin/profile', icon: 'person.circle.fill' },
    ],
  },
  super_admin: {
    useAdminLayout: true,
    sidebar: [
      { name: 'Dashboard', path: '/admin', icon: 'house.fill' },
      { name: 'Students', path: '/admin/management/students', icon: 'person.2.fill', group: 'Students' },
      { name: 'Staff', path: '/admin/management/staff', icon: 'person.3.fill', group: 'Staffs' },
      { name: 'Analytics', path: '/admin/analytics', icon: 'chart.pie.fill' },
      { name: 'Messages', path: '/admin/communication', icon: 'envelope.fill' },
      { name: 'Profile', path: '/admin/profile', icon: 'person.circle.fill' },
    ],
  },
};

/**
 * Get allowed roles for specific routes
 */
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  '/(tabs)/student-attendance': ['student', 'staff', 'hod'],
  '/(tabs)/parent-attendance': ['parent'],
  '/(tabs)/interactions': ['student', 'staff', 'hod'],
  '/(tabs)/timetable': ['student', 'staff', 'hod'],
  '/(tabs)/alerts': ['student', 'parent', 'staff', 'hod'],
  '/(tabs)/profile': ['student', 'staff', 'hod'],
  '/(tabs)/parent-profile': ['parent'],
  '/(tabs)/index': ['staff', 'hod'],
  '/(tabs)/explore': ['staff', 'hod'],
  '/admin': ['admin', 'super_admin'],
};

/**
 * Grouped navigation items for display (shows Students and Staffs groups in sidebar)
 */
export interface GroupedNavItems {
  ungrouped: NavSection[];
  groups: Record<string, NavSection[]>;
}

export function getGroupedNavItems(items: NavSection[]): GroupedNavItems {
  const groups: Record<string, NavSection[]> = {};
  const ungrouped: NavSection[] = [];

  items.forEach((item) => {
    if (item.group) {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    } else {
      ungrouped.push(item);
    }
  });

  return { ungrouped, groups };
}
