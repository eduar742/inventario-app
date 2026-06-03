// Controles de paginacao reutilizaveis.
// Uso: <Paginacao pagina={p} totalPaginas={t} total={n} onAnterior={fn} onProxima={fn} />

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';

export default function Paginacao({ pagina, totalPaginas, total, onAnterior, onProxima, porPagina }) {
  if (!totalPaginas || totalPaginas <= 1) return null;

  const inicio = (pagina - 1) * (porPagina || 50) + 1;
  const fim = Math.min(pagina * (porPagina || 50), total || 0);

  return (
    <View style={est.container}>
      {/* Indicador de itens */}
      {total > 0 && (
        <Text style={est.info}>
          {inicio}–{fim} de {total}
        </Text>
      )}

      {/* Controles */}
      <View style={est.controles}>
        <TouchableOpacity
          style={[est.botao, pagina <= 1 && est.botaoDesabilitado]}
          onPress={onAnterior}
          disabled={pagina <= 1}
          activeOpacity={0.7}
        >
          <Text style={[est.botaoTxt, pagina <= 1 && est.botaoTxtDesabilitado]}>
            ← Anterior
          </Text>
        </TouchableOpacity>

        <View style={est.pagina}>
          <Text style={est.paginaAtual}>{pagina}</Text>
          <Text style={est.paginaSep}>/</Text>
          <Text style={est.paginaTotal}>{totalPaginas}</Text>
        </View>

        <TouchableOpacity
          style={[est.botao, pagina >= totalPaginas && est.botaoDesabilitado]}
          onPress={onProxima}
          disabled={pagina >= totalPaginas}
          activeOpacity={0.7}
        >
          <Text style={[est.botaoTxt, pagina >= totalPaginas && est.botaoTxtDesabilitado]}>
            Próxima →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const est = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  info: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botao: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  botaoDesabilitado: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.border,
  },
  botaoTxt: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  botaoTxtDesabilitado: {
    color: colors.textMuted,
  },
  pagina: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  paginaAtual: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
  },
  paginaSep: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  paginaTotal: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
