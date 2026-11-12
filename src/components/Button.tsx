import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, busy }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? '#fff' : colors.accent} />
      ) : (
        <Text style={[styles.text, { color: primary ? '#fff' : colors.accent }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', alignSelf: 'stretch' },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.accentSoft },
  text: { fontSize: 18, fontWeight: '700' },
});
