// Input de texto reutilizavel com label, erro e icone opcional.
// Padrao visual unificado em todo o app.

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';

export default function Input({
  label,
  valor,
  onChangeText,
  placeholder,
  erro,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  editable = true,
  multiline = false,
}) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const ehSenha = secureTextEntry;
  const tipoSenha = ehSenha && !mostrarSenha;

  return (
    <View style={estilos.container}>
      {label && <Text style={estilos.label}>{label}</Text>}

      <View style={[
        estilos.inputWrapper,
        erro && estilos.inputWrapperErro,
        !editable && estilos.inputWrapperDesabilitado,
      ]}>
        <TextInput
          style={[estilos.input, multiline && estilos.inputMultiline]}
          value={valor}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={tipoSenha}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          multiline={multiline}
        />

        {ehSenha && (
          <TouchableOpacity
            onPress={() => setMostrarSenha(!mostrarSenha)}
            style={estilos.botaoMostrarSenha}
          >
            <Text style={estilos.textoMostrarSenha}>
              {mostrarSenha ? 'Ocultar' : 'Mostrar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {erro && <Text style={estilos.erro}>{erro}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  inputWrapperErro: {
    borderColor: colors.danger,
  },
  inputWrapperDesabilitado: {
    backgroundColor: colors.backgroundSoft,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  botaoMostrarSenha: {
    paddingHorizontal: spacing.md,
  },
  textoMostrarSenha: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  erro: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});