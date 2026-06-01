// Botao reutilizavel com tema azul corporativo.
// Variantes: primary (azul cheio), secondary (apenas borda), danger (vermelho)
// Estados: normal, loading, disabled

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';

export default function Button({
  titulo,
  onPress,
  variante = 'primary',
  carregando = false,
  desabilitado = false,
  fullWidth = true,
  estilo,
}) {
  const estaInativo = desabilitado || carregando;

  const estiloFundo = [
    estilos.base,
    variante === 'primary' && estilos.primary,
    variante === 'secondary' && estilos.secondary,
    variante === 'danger' && estilos.danger,
    estaInativo && estilos.desabilitado,
    fullWidth && estilos.fullWidth,
    estilo,
  ];

  const estiloTexto = [
    estilos.texto,
    variante === 'secondary' && estilos.textoSecondary,
    variante === 'danger' && estilos.textoDanger,
  ];

  return (
    <TouchableOpacity
      style={estiloFundo}
      onPress={onPress}
      disabled={estaInativo}
      activeOpacity={0.85}
    >
      {carregando ? (
        <ActivityIndicator color={variante === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text style={estiloTexto}>{titulo}</Text>
      )}
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  fullWidth: {
    width: '100%',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  desabilitado: {
    opacity: 0.5,
  },
  texto: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textoSecondary: {
    color: colors.primary,
  },
  textoDanger: {
    color: colors.white,
  },
});