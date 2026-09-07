import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@ohun/design-tokens';
import { useAuth } from '../src/auth/AuthProvider';

export default function IndexScreen() {
  const auth = useAuth();
  if (auth.status === 'restoring') return <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Restoring session"><ActivityIndicator color={colors.primary} /></View>;
  return <Redirect href={auth.status === 'signedIn' ? '/(app)' : '/(auth)/login'} />;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
