import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AdminTabRedirect() {
  const { user } = useAuth();

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/admin" />;
}
