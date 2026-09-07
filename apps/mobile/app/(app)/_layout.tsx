import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';

export default function ProtectedLayout() {
  const auth = useAuth();
  if (auth.status !== 'signedIn') return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
