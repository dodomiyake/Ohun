import { useState } from 'react';
import { useFonts } from 'expo-font';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '@ohun/design-tokens';
import { authStyles } from './AuthFrame';

export function PasswordField(props: TextInputProps) {
  const [visible, setVisible] = useState(false);
  const [ready] = useFonts({ MaterialSymbols: require('../../../assets/settings/MaterialSymbols.ttf') });
  const label = `${visible ? 'Hide' : 'Show'} ${props.accessibilityLabel?.toLowerCase() ?? 'password'}`;
  return <View style={styles.field}>
    <TextInput {...props} style={[authStyles.input, styles.input]} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} />
    <Pressable style={styles.toggle} onPress={() => setVisible(value => !value)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ checked: visible }}>
      <Text accessible={false} style={ready ? styles.icon : styles.fallback}>{ready ? (visible ? '\ue8f5' : '\ue8f4') : (visible ? 'Hide' : 'Show')}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({ field: { position: 'relative' }, input: { paddingRight: 56 }, toggle: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, icon: { fontFamily: 'MaterialSymbols', fontSize: 24, color: colors.onSurfaceVariant }, fallback: { fontSize: 12, color: colors.primary } });
