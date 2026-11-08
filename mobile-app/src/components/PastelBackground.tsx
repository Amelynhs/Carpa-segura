import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { gradients } from '../theme/theme';

const { width: W, height: H } = Dimensions.get('window');

function Cloud({ top, scale, duration, delay, opacity }: { top: number; scale: number; duration: number; delay: number; opacity: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x, duration, delay]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-180 * scale, W + 40] });
  return (
    <Animated.View style={{ position: 'absolute', top, opacity, transform: [{ translateX }, { scale }] }}>
      <Svg width={150} height={70} viewBox="0 0 150 70">
        <Circle cx={40} cy={44} r={24} fill="#fff" />
        <Circle cx={72} cy={32} r={30} fill="#fff" />
        <Circle cx={108} cy={44} r={22} fill="#fff" />
        <Path d="M20 62 h110 a10 10 0 0 0 0 -18 h-110 a10 10 0 0 0 0 18z" fill="#fff" />
      </Svg>
    </Animated.View>
  );
}

function Twinkle({ left, top, size, delay }: { left: number; top: number; size: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.95] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }, { rotate: '12deg' }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z" fill="#fff" />
      </Svg>
    </Animated.View>
  );
}

export function PastelBackground({ children, colors = gradients.sky }: { children?: React.ReactNode; colors?: readonly [string, string, ...string[]] }) {
  const stars = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ left: (i * 97 + 23) % (W - 20), top: (i * 151 + 40) % (H * 0.8), size: 12 + ((i * 7) % 14), delay: i * 260 })),
    [],
  );
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={colors as any} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <Cloud top={H * 0.07} scale={1} duration={42000} delay={0} opacity={0.75} />
      <Cloud top={H * 0.32} scale={0.7} duration={58000} delay={0} opacity={0.55} />
      <Cloud top={H * 0.62} scale={0.9} duration={50000} delay={8000} opacity={0.6} />
      {stars.map((s, i) => (
        <Twinkle key={i} {...s} />
      ))}
      {children}
    </View>
  );
}
