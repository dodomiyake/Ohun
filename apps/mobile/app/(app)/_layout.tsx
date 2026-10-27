import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { MessagingProvider } from '../../src/messaging/MessagingProvider';

export default function ProtectedLayout() {
  const auth = useAuth();
  if (auth.status !== 'signedIn') return <Redirect href="/(auth)/login" />;
  return <MessagingProvider><Stack screenOptions={{ headerShown: false }} /></MessagingProvider>;
}
