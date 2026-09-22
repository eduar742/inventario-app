// Cartoes de indicadores (mini-dashboard) de UMA sessao de inventario.
// Reaproveitado no Resumo (assim que o lider fecha a contagem) e na tela
// de Acuracidade da Sessao (revisao pos-conclusao pelo lider/gestor/auditor/adm).
// Dados vem prontos de buscarResumoSessao() — GET /sessoes/{id}/resumo.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';

function corPorFaixa(v) {
  if (v == null) return colors.textMuted;
  if (v >= 95) return colors.success;
  if (v >= 85) return colors.warning;
  return colors.danger;
}

function fmtMoeda(v) {
  const n = parseFloat(v) || 0;
  const sinal = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sinal}R$ ${abs}`;
}

export default function CardsAcuracidadeSessao({ resumo }) {
  if (!resumo) return null;

  const acuracidade = resumo.acuracidade;
  const valorDivergente = parseFloat(resumo.valor_divergente_total) || 0;
  const corValor = valorDivergente > 0 ? colors.success : valorDivergente < 0 ? colors.danger : colors.textMuted;
  const totalDiv = resumo.total_divergencias || 0;
  const totalContados = resumo.total_contados || 0;

  return (
    <View style={est.container}>
      {/* Acuracidade */}
      <View style={[est.card, { borderLeftColor: corPorFaixa(acuracidade) }]}>
        <Text style={est.rotulo}>Acuracidade da sessao</Text>
        <Text style={[est.valorGrande, { color: corPorFaixa(acuracidade) }]}>
          {acuracidade != null ? `${acuracidade}%` : '—'}
        </Text>
        <Text style={est.legenda}>
          {resumo.total_produtos_loja > 0
            ? `${resumo.total_produtos_loja - totalDiv} de ${resumo.total_produtos_loja} produtos bateram com o sistema`
            : 'Sem produtos esperados para comparar'}
        </Text>
      </View>

      {/* Valor divergente */}
      <View style={[est.card, { borderLeftColor: corValor }]}>
        <Text style={est.rotulo}>Valor divergente</Text>
        <Text style={[est.valorGrande, { color: corValor }]}>{fmtMoeda(valorDivergente)}</Text>
        <Text style={est.legenda}>
          Impacto financeiro estimado desta sessao
          {resumo.divergencias_sem_custo > 0
            ? ` · ${resumo.divergencias_sem_custo} sem custo cadastrado (nao somada)`
            : ''}
        </Text>
      </View>

      {/* Divergencias */}
      <View style={[est.card, { borderLeftColor: colors.info }]}>
        <Text style={est.rotulo}>Divergencias</Text>
        <Text style={est.valorGrande}>
          <Text style={{ color: colors.info }}>{totalDiv}</Text>
          <Text style={est.valorGrandeSub}> de {totalContados} contados</Text>
        </Text>
        <View style={est.chipsRow}>
          <Chip cor={colors.warning} bg={colors.warningSoft} texto={`${resumo.divergencias_pendentes || 0} pendentes`} />
          <Chip cor={colors.success} bg={colors.successSoft} texto={`${resumo.divergencias_aprovadas || 0} aprovadas`} />
          <Chip cor={colors.danger} bg={colors.dangerSoft} texto={`${resumo.divergencias_rejeitadas || 0} rejeitadas`} />
        </View>
      </View>
    </View>
  );
}

function Chip({ cor, bg, texto }) {
  return (
    <View style={[est.chip, { backgroundColor: bg }]}>
      <Text style={[est.chipTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

const est = StyleSheet.create({
  container: { gap: spacing.sm },
  card: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4,
  },
  rotulo: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  valorGrande: { fontSize: fontSize.title, fontWeight: '700', marginTop: 4 },
  valorGrandeSub: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  legenda: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  chipTexto: { fontSize: fontSize.xs, fontWeight: '700' },
});
