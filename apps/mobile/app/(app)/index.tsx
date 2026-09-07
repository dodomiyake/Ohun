import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileNavShell } from '../../src/shells/MobileNavShell';

export default function AuthenticatedHome() {
  return <SafeAreaView style={{ flex: 1 }}><MobileNavShell /></SafeAreaView>;
}
