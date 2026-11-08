import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/** Carpa de circo pastel: la cabecera de la pantalla de bienvenida. */
export function CircusTent({ width = 320 }: { width?: number }) {
  const stripes = Array.from({ length: 8 }, (_, i) => i);
  const h = width * 0.62;
  return (
    <Svg width={width} height={h} viewBox="0 0 320 198">
      <Defs>
        <ClipPath id="roof">
          <Path d="M160 24 L300 104 L20 104 Z" />
        </ClipPath>
        <ClipPath id="wall">
          <Rect x={36} y={104} width={248} height={70} />
        </ClipPath>
      </Defs>
      {/* techo a rayas */}
      <G clipPath="url(#roof)">
        {stripes.map((i) => (
          <Path
            key={i}
            d={`M160 24 L${20 + i * 35} 104 L${55 + i * 35} 104 Z`}
            fill={i % 2 ? '#ffffff' : i % 4 === 0 ? '#ffc2dc' : '#cdb4f6'}
          />
        ))}
      </G>
      {/* guirnalda */}
      <Path d="M20 104 Q40 128 60 104 Q80 128 100 104 Q120 128 140 104 Q160 128 180 104 Q200 128 220 104 Q240 128 260 104 Q280 128 300 104" fill="#ffe8a3" stroke="#f2c75c" strokeWidth={2} />
      {/* paredes */}
      <G clipPath="url(#wall)">
        {Array.from({ length: 9 }, (_, i) => (
          <Rect key={i} x={36 + i * 28} y={104} width={28} height={70} fill={i % 2 ? '#fff4ea' : '#bfe3ff'} />
        ))}
      </G>
      {/* entrada */}
      <Path d="M130 174 L130 130 Q160 100 190 130 L190 174 Z" fill="#8c7fb0" />
      <Path d="M160 106 Q146 130 130 174 L160 174 Z" fill="#a98be8" />
      <Path d="M160 106 Q174 130 190 174 L160 174 Z" fill="#b9a2ee" />
      {/* mástil y banderín */}
      <Path d="M160 24 V6" stroke="#8c7fb0" strokeWidth={3} strokeLinecap="round" />
      <Path d="M160 6 L184 14 L160 22 Z" fill="#ff8fb1" />
      {/* globos */}
      <G>
        <Path d="M296 150 Q290 120 280 100" stroke="#b9aed3" strokeWidth={1.5} fill="none" />
        <Circle cx={278} cy={92} r={13} fill="#ffc2dc" />
        <Path d="M30 150 Q24 124 40 104" stroke="#b9aed3" strokeWidth={1.5} fill="none" />
        <Circle cx={42} cy={96} r={12} fill="#b9e6d3" />
        <Circle cx={274} cy={88} r={3.5} fill="#fff" opacity={0.8} />
        <Circle cx={38} cy={92} r={3.5} fill="#fff" opacity={0.8} />
      </G>
      {/* suelo */}
      <Path d="M0 174 H320" stroke="#e8def9" strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}
