import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type Mood = 'happy' | 'shock' | 'wink' | 'sad' | 'cool';

interface Props {
  size?: number;
  mood?: Mood;
  /** Hermenegildo flota y se mece solo. */
  animated?: boolean;
  /** Muestra un candado en la mano (para la bóveda). */
  holdLock?: boolean;
}

/**
 * Hermenegildo, el payaso. Dibujado 100 % en SVG (sin imágenes) para que escale nítido
 * y para poder cambiar de humor según lo que pasa en la app.
 */
export function Hermenegildo({ size = 160, mood = 'happy', animated = true, holdLock = false }: Props) {
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => (a.stop(), b.stop());
  }, [animated, bob, sway]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.05] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });

  const eye = (cx: number, diamond: string) => (
    <G key={cx}>
      <Path d={`M${cx - 7} 110 l7 -12 l7 12 l-7 12 z`} fill={diamond} />
      {mood === 'wink' && cx > 110 ? (
        <Path d={`M${cx - 6} 111 q6 6 12 0`} stroke="#5b4b7a" strokeWidth={3} fill="none" strokeLinecap="round" />
      ) : mood === 'cool' ? (
        <Rect x={cx - 11} y={104} width={22} height={11} rx={5} fill="#5b4b7a" />
      ) : (
        <>
          <Circle cx={cx} cy={111} r={mood === 'shock' ? 6.5 : 4.5} fill="#5b4b7a" />
          <Circle cx={cx + 1.5} cy={109.5} r={1.5} fill="#fff" />
        </>
      )}
    </G>
  );

  const mouth =
    mood === 'shock' ? (
      <Circle cx={110} cy={166} r={11} fill="#e58aa6" stroke="#c96a89" strokeWidth={2.5} />
    ) : mood === 'sad' ? (
      <Path d="M84 170 Q110 148 136 170" fill="none" stroke="#e58aa6" strokeWidth={3.5} strokeLinecap="round" />
    ) : (
      <Path d="M80 152 Q110 186 140 152" fill="#ffd6e2" stroke="#e58aa6" strokeWidth={3.5} strokeLinecap="round" />
    );

  return (
    <Animated.View style={{ width: size, height: size * 1.05, transform: [{ translateY }, { rotate }] }}>
      <Svg width={size} height={size * 1.05} viewBox="0 0 220 230">
        <Defs>
          <LinearGradient id="hat" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffe8a3" />
            <Stop offset="1" stopColor="#ffc7a8" />
          </LinearGradient>
        </Defs>
        {/* pelo */}
        <Circle cx={48} cy={112} r={30} fill="#cdb4f6" />
        <Circle cx={34} cy={138} r={22} fill="#b9e6d3" />
        <Circle cx={172} cy={112} r={30} fill="#ffc2dc" />
        <Circle cx={186} cy={138} r={22} fill="#bfe3ff" />
        {/* sombrero */}
        <Path d="M110 12 L148 78 Q110 92 72 78 Z" fill="url(#hat)" stroke="#f3b99b" strokeWidth={2} />
        <Circle cx={110} cy={12} r={11} fill="#ffc2dc" />
        <Circle cx={98} cy={52} r={5} fill="#fff" opacity={0.85} />
        <Circle cx={120} cy={40} r={4} fill="#cdb4f6" />
        <Circle cx={124} cy={64} r={4} fill="#b9e6d3" />
        {/* cara */}
        <Circle cx={110} cy={128} r={58} fill="#fff4ea" stroke="#f1d9c6" strokeWidth={2} />
        <Circle cx={76} cy={144} r={11} fill="#ffc2dc" opacity={0.75} />
        <Circle cx={144} cy={144} r={11} fill="#ffc2dc" opacity={0.75} />
        {eye(89, '#bfe3ff')}
        {eye(131, '#cdb4f6')}
        {/* nariz */}
        <Circle cx={110} cy={132} r={13} fill="#ff9eb5" />
        <Circle cx={106} cy={127} r={4} fill="#fff" opacity={0.7} />
        {mouth}
        {/* corbatín */}
        <Path d="M110 192 L82 178 L82 206 Z" fill="#b9e6d3" stroke="#8ccdb3" strokeWidth={2} />
        <Path d="M110 192 L138 178 L138 206 Z" fill="#b9e6d3" stroke="#8ccdb3" strokeWidth={2} />
        <Circle cx={110} cy={192} r={8} fill="#cdb4f6" />
        {holdLock && (
          <G>
            <Rect x={150} y={176} width={42} height={36} rx={9} fill="#ffe8a3" stroke="#f2c75c" strokeWidth={2.5} />
            <Path d="M158 176 v-9 a13 13 0 0 1 26 0 v9" fill="none" stroke="#f2c75c" strokeWidth={5} strokeLinecap="round" />
            <Circle cx={171} cy={193} r={4.5} fill="#c9962a" />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

export const HermenegildoBadge = ({ size = 44, mood = 'happy' as Mood }) => (
  <View style={{ width: size, height: size, overflow: 'hidden', alignItems: 'center' }}>
    <Hermenegildo size={size * 1.15} mood={mood} animated={false} />
  </View>
);
