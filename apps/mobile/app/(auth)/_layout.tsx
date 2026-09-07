import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';

export default function AuthLayout() {
  const auth = useAuth();
  if (auth.status === 'signedIn') return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
