import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@ohun/design-tokens';

/** One accessible input retains paste/autofill/backspace behavior; boxes are presentation only. */
export function VerificationCode({ value, onChange, onSubmit, disabled }: { value: string; onChange: (value: string) => void; onSubmit: () => void; disabled: boolean }) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return <Pressable accessible={false} onPress={() => input.current?.focus()} style={styles.container}>
    <View style={styles.boxes} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.box, focused && index === Math.min(value.length, 5) && styles.focused]}><Text style={styles.digit}>{value[index] ?? ''}</Text></View>)}
    </View>
    <TextInput ref={input} style={styles.input} value={value} onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, 6))} editable={!disabled} caretHidden keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} accessibilityLabel="Six-digit verification code" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onSubmitEditing={onSubmit} />
  </Pressable>;
}
const styles = StyleSheet.create({ container: { minHeight: 52 }, boxes: { flexDirection: 'row', gap: 8 }, box: { flex: 1, minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, focused: { borderColor: colors.primary, borderWidth: 2 }, digit: { color: colors.onSurface, fontSize: 22 }, input: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, color: 'transparent', backgroundColor: 'transparent', fontSize: 22 } });
