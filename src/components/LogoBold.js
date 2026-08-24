// Logotipo BOLD — componente compartilhado.
// Dois paralelogramos com efeito 3D (amarelo + verde) + texto "BOLD".
// variant: 'color' (sobre fundo claro) | 'white' (sobre fundo escuro)
// somenteSimbolo: true = exibe apenas o simbolo grafico (sidebar recolhida)

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

export default function LogoBold({ variant = 'color', height = 36, somenteSimbolo = false }) {
  const markW  = Math.round(height * 0.80);
  const corTxt = variant === 'white' ? colors.onDark : colors.primary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={markW} height={height} viewBox="0 0 28 34">
        {/* Face lateral barra amarela — profundidade 3D */}
        <Path d="M4 15 L24 10 L24 13 L4 18 Z" fill="#C47D0E" />
        {/* Barra superior amarelo-dourado */}
        <Path d="M0 5 L20 0 L24 10 L4 15 Z" fill="#F5A623" />
        {/* Face lateral barra verde — profundidade 3D */}
        <Path d="M6 29 L26 24 L26 27 L6 32 Z" fill="#15803D" />
        {/* Barra inferior verde */}
        <Path d="M2 19 L22 14 L26 24 L6 29 Z" fill="#22C55E" />
      </Svg>

      {!somenteSimbolo && (
        <Text
          style={{
            color: corTxt,
            fontSize: 22,
            fontWeight: '800',
            letterSpacing: 1,
            marginLeft: 10,
          }}
        >
          BOLD
        </Text>
      )}
    </View>
  );
}
