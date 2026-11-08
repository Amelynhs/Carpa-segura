import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors, gradients, mono, radii, rounded, shadow } from '../theme/theme';
import type { EventKind, SecurityEvent } from '../auth/AuthContext';

/* ───────────── Tarjeta de vidrio ───────────── */
export function GlassCard({ children, style, tint }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return (
    <View
      style={[
        {
          backgroundColor: tint ?? colors.glass,
          borderRadius: radii.lg,
          borderWidth: 2.5,
          borderColor: 'rgba(255,255,255,0.95)',
          padding: 18,
        },
        shadow(colors.lavDeep, 18),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ───────────── Texto ───────────── */
export const H1 = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[{ fontFamily: rounded, fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 }, style]}>{children}</Text>
);
export const Body = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[{ fontFamily: rounded, fontSize: 14.5, lineHeight: 21, color: colors.soft }, style]}>{children}</Text>
);
export const Label = ({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) => (
  <Text style={[{ fontFamily: rounded, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.faint }, style]}>{children}</Text>
);

/* ───────────── Chip ───────────── */
export function Chip({ text, bg = colors.mint, fg = '#3d7a63', style }: { text: string; bg?: string; fg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill, alignSelf: 'flex-start' }, style]}>
      <Text style={{ fontFamily: rounded, fontSize: 12, fontWeight: '800', color: fg }}>{text}</Text>
    </View>
  );
}

/* ───────────── Botón con degradé y rebote ───────────── */
export function PastelButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'mint' | 'sunset' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 9 }).start();
  const palette =
    variant === 'mint' ? gradients.mint : variant === 'sunset' ? gradients.sunset : variant === 'danger' ? (['#ffb3c6', '#ff8fb1'] as const) : gradients.button;
  const dark = variant === 'mint' || variant === 'sunset';
  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        disabled={disabled || loading}
        style={[{ paddingVertical: 13, borderRadius: radii.md, borderWidth: 2.5, borderColor: colors.lav, alignItems: 'center', opacity: disabled ? 0.45 : 1 }, style]}
      >
        <Text style={{ fontFamily: rounded, fontWeight: '800', fontSize: 15, color: colors.lavDeep }}>
          {icon ? `${icon}  ` : ''}
          {title}
        </Text>
      </Pressable>
    );
  }
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }, shadow(palette[1], 14), style]}>
      <Pressable
        onPressIn={() => pulse(0.96)}
        onPressOut={() => pulse(1)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        disabled={disabled || loading}
      >
        <LinearGradient colors={palette as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 15, paddingHorizontal: 20, borderRadius: radii.md, alignItems: 'center' }}>
          <Text style={{ fontFamily: rounded, fontWeight: '800', fontSize: 16, color: dark ? colors.ink : '#fff' }}>
            {loading ? 'Un momento…' : `${icon ? icon + '  ' : ''}${title}`}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────── Aparición suave ───────────── */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }, style]}>{children}</Animated.View>
  );
}

/* ───────────── Anillo de cuenta regresiva ───────────── */
export function CountdownRing({
  progress,
  size = 64,
  stroke = 7,
  label,
  warnBelow = 0.17,
}: {
  progress: number; // 1 → 0
  size?: number;
  stroke?: number;
  label?: string;
  warnBelow?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hot = progress < warnBelow;
  const id = useRef(`ring${Math.random().toString(36).slice(2, 7)}`).current;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={hot ? colors.pinkDeep : colors.lavDeep} />
            <Stop offset="1" stopColor={hot ? '#ffb199' : colors.mintDeep} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#efe7fb" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        />
      </Svg>
      {label !== undefined && <Text style={{ fontFamily: mono, fontWeight: '700', fontSize: size * 0.3, color: hot ? colors.danger : colors.ink }}>{label}</Text>}
    </View>
  );
}

/* ───────────── 6 casillas con teclado numérico ───────────── */
export function CodeBoxes({
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!error) return;
    Animated.sequence([-10, 10, -8, 8, -4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
  }, [error, shake]);

  return (
    <Pressable onPress={() => ref.current?.focus()}>
      <Animated.View style={{ flexDirection: 'row', justifyContent: 'center', gap: 9, transform: [{ translateX: shake }] }}>
        {Array.from({ length: 6 }, (_, i) => {
          const ch = value[i];
          const active = i === value.length;
          return (
            <View
              key={i}
              style={{
                width: 44,
                height: 56,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ch ? '#fff' : colors.cream,
                borderWidth: 2.5,
                borderColor: error ? colors.pinkDeep : active ? colors.lavDeep : ch ? colors.lav : '#eee4fa',
              }}
            >
              <Text style={{ fontFamily: mono, fontSize: 26, fontWeight: '700', color: colors.ink }}>{ch ?? ''}</Text>
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => {
          const d = t.replace(/\D/g, '').slice(0, 6);
          onChange(d);
          if (d.length === 6) onComplete?.(d);
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        caretHidden
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
    </Pressable>
  );
}

/* ───────────── Línea de tiempo de eventos de seguridad ───────────── */
const KIND: Record<EventKind, { bg: string; dot: string; icon: string }> = {
  ok: { bg: colors.okBg, dot: colors.mintDeep, icon: '✓' },
  info: { bg: colors.infoBg, dot: colors.skyDeep, icon: 'i' },
  warn: { bg: colors.warnBg, dot: colors.butterDeep, icon: '!' },
  error: { bg: colors.dangerBg, dot: colors.pinkDeep, icon: '×' },
};

export function EventTimeline({ events, max = 8 }: { events: SecurityEvent[]; max?: number }) {
  if (events.length === 0) return <Body>Todavía no pasa nada. Hermenegildo está esperando…</Body>;
  return (
    <View style={{ gap: 8 }}>
      {events.slice(0, max).map((e) => {
        const k = KIND[e.kind];
        const t = new Date(e.at);
        const hh = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
        return (
          <FadeIn key={e.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: k.bg, borderRadius: 16, padding: 10, gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: k.dot, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{k.icon}</Text>
              </View>
              <Text style={{ flex: 1, fontFamily: rounded, fontSize: 12.5, color: colors.ink }}>{e.text}</Text>
              <Text style={{ fontFamily: mono, fontSize: 10.5, color: colors.faint }}>{hh}</Text>
            </View>
          </FadeIn>
        );
      })}
    </View>
  );
}

/* ───────────── Barra inferior animada ───────────── */
export type TabKey = 'home' | 'auth' | 'vault';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Inicio', icon: '🎪' },
  { key: 'auth', label: 'Authenticator', icon: '🔢' },
  { key: 'vault', label: 'Bóveda', icon: '🔐' },
];

export function TabBar({ active, onChange, bottomInset }: { active: TabKey; onChange: (t: TabKey) => void; bottomInset: number }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = TABS.findIndex((t) => t.key === active);
  useEffect(() => {
    Animated.spring(x, { toValue: idx, useNativeDriver: true, speed: 14, bounciness: 11 }).start();
  }, [idx, x]);
  const cell = w / TABS.length;
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(bottomInset, 12) }}>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width - 12)}
        style={[{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radii.xl, padding: 6, borderWidth: 2.5, borderColor: '#fff' }, shadow(colors.lavDeep, 22)]}
      >
        {w > 0 && (
          <Animated.View style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: cell, transform: [{ translateX: x.interpolate({ inputRange: [0, 1, 2], outputRange: [0, cell, cell * 2] }) }] }}>
            <LinearGradient colors={['#e6dcff', '#ffd9ea']} style={{ flex: 1, borderRadius: radii.xl - 8 }} />
          </Animated.View>
        )}
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 9 }}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(t.key);
            }}
          >
            <Text style={{ fontSize: 22 }}>{t.icon}</Text>
            <Text style={{ fontFamily: rounded, fontSize: 11, fontWeight: '800', color: t.key === active ? colors.ink : colors.faint }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { paddingHorizontal: 20 },
});
