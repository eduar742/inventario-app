// Dashboard por loja e historico mes a mes.
// Exibe 3 dimensoes de acuracidade: Valor (R$), Unidades e Itens (SKUs).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarDashboardLojas, buscarDashboardHistorico } from '../services/api';

const INTERVALO = 30000;

function fmtMoeda(v) {
  if (!v && v !== 0) return '—';
  const n = parseFloat(v);
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000)    return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toFixed(2)}`;
}

function fmtMoedaCompleto(v) {
  if (!v && v !== 0) return '—';
  return `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(v, decimais = 0) {
  if (!v && v !== 0) return '—';
  return parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}

function corAcur(v) {
  if (v >= 98) return colors.success;
  if (v >= 90) return colors.warning;
  return colors.danger;
}

// ── Painel de acuracidade (Valor / Unidades / Itens) ─────────────────────────
function PainelAcuracidade({ titulo, dados, formatarTotal, formatarAdj, cor }) {
  if (!dados) return null;
  const corAcuracia = corAcur(dados.acuracidade);
  const pct = Math.min(dados.acuracidade, 100);

  return (
    <View style={[estilos.painel, { borderTopColor: cor }]}>
      <Text style={[estilos.painelTitulo, { color: cor }]}>{titulo}</Text>

      <View style={estilos.painelLinha}>
        <Text style={estilos.painelLabel}>Total no Sistema</Text>
        <Text style={estilos.painelValorPrincipal}>{formatarTotal(dados.total_sistema ?? dados.total ?? dados.total_estoque)}</Text>
      </View>

      <View style={estilos.separador} />

      <View style={estilos.painelLinha}>
        <Text style={estilos.painelLabel}>Acerto Positivo (+)</Text>
        <Text style={[estilos.painelValorAdj, { color: colors.warning }]}>
          +{formatarAdj(dados.acerto_positivo)}
        </Text>
      </View>
      <View style={estilos.painelLinha}>
        <Text style={estilos.painelLabel}>Acerto Negativo (−)</Text>
        <Text style={[estilos.painelValorAdj, { color: colors.danger }]}>
          −{formatarAdj(dados.acerto_negativo)}
        </Text>
      </View>
      <View style={[estilos.painelLinha, estilos.painelLinhaDestaque]}>
        <Text style={[estilos.painelLabel, { fontWeight: '700' }]}>Ajuste Líquido</Text>
        <Text style={[estilos.painelValorAdj, {
          color: (dados.ajuste_liquido ?? dados.diferenca_itens ?? 0) < 0 ? colors.danger : colors.warning,
          fontWeight: '700',
        }]}>
          {formatarAdj(dados.ajuste_liquido ?? dados.diferenca_itens)}
        </Text>
      </View>

      <View style={estilos.separador} />

      <View style={estilos.painelLinha}>
        <Text style={estilos.painelLabel}>Diferença</Text>
        <Text style={[estilos.painelValorAdj, { color: colors.textSecondary }]}>
          {fmtNum(dados.diferenca_pct, 2)}%
        </Text>
      </View>

      {/* Barra de acuracidade */}
      <View style={estilos.acuracidadeRow}>
        <Text style={estilos.painelLabel}>Acuracidade</Text>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <View style={estilos.barraFundo}>
            <View style={[estilos.barraFill, { width: `${pct}%`, backgroundColor: corAcuracia }]} />
          </View>
        </View>
        <Text style={[estilos.acuracidadeValor, { color: corAcuracia }]}>
          {fmtNum(dados.acuracidade, 2)}%
        </Text>
      </View>
    </View>
  );
}

// ── TELA 1: Lista de lojas ───────────────────────────────────────────────────
export default function DashboardLojasScreen({ navigation }) {
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try { const d = await buscarDashboardLojas(); setLojas(d); }
    catch (_) {}
    finally { setCarregando(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    carregar();
    timerRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [carregar]);

  function renderLoja({ item: l }) {
    const cor = corAcur(l.acuracidade);
    const temAtiva = !!l.sessao_ativa;
    return (
      <TouchableOpacity
        style={estilos.lojaCard}
        onPress={() => navigation.navigate('DashboardHistorico', { loja: l })}
        activeOpacity={0.75}
      >
        <View style={estilos.lojaTopo}>
          <View style={[estilos.lojaBadge, { backgroundColor: temAtiva ? colors.infoSoft : colors.backgroundSoft }]}>
            <Text style={[estilos.lojaCodigo, { color: temAtiva ? colors.info : colors.textSecondary }]}>{l.codigo}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={estilos.lojaNome} numberOfLines={1}>{l.nome}</Text>
            <Text style={estilos.lojaMeta}>
              {l.ultima_sessao_mes || 'Sem sessão'}
              {temAtiva ? ` · ${l.sessao_ativa === 'aguardando_aprovacao' ? 'Aguardando' : 'Em andamento'}` : ''}
            </Text>
          </View>
          <Text style={estilos.seta}>›</Text>
        </View>
        <View style={estilos.lojaMetricas}>
          <Metrica rotulo="Acuracidade" valor={`${l.acuracidade}%`} cor={cor} />
          <Metrica rotulo="Auditados"   valor={`${l.total_auditados}/${l.total_produtos}`} />
          <Metrica rotulo="Estoque"     valor={fmtMoeda(l.valor_estoque)} />
          <Metrica rotulo="Divergente"  valor={fmtMoeda(l.valor_divergente)}
            cor={l.valor_divergente > 0 ? colors.danger : colors.textSecondary} />
        </View>
        <View style={estilos.barraFundo}>
          <View style={[estilos.barraFill, { width: `${Math.min(l.acuracidade, 100)}%`, backgroundColor: cor }]} />
        </View>
      </TouchableOpacity>
    );
  }

  if (carregando && lojas.length === 0) {
    return <SafeAreaView style={estilos.centro}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={estilos.container}>
      <FlatList
        data={lojas}
        renderItem={renderLoja}
        keyExtractor={l => l.loja_id}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={<Text style={estilos.dica}>Toque para ver o histórico detalhado</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={[colors.primary]} tintColor={colors.primary} />}
      />
    </SafeAreaView>
  );
}

// ── TELA 2: Historico com paineis de acuracidade ──────────────────────────────
export function DashboardHistoricoScreen({ navigation, route }) {
  const { loja } = route.params;
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [meses, setMeses] = useState(6);
  const timerRef = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try { const d = await buscarDashboardHistorico(loja.loja_id, meses); setHistorico(d); }
    catch (_) {}
    finally { setCarregando(false); }
  }, [loja.loja_id, meses]);

  useEffect(() => {
    carregar();
    timerRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [carregar]);

  if (carregando && !historico) {
    return <SafeAreaView style={estilos.centro}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;
  }

  const hist = historico?.historico || [];
  const ultimo = hist[hist.length - 1];

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView
        contentContainerStyle={estilos.lista}
        refreshControl={<RefreshControl refreshing={false} onRefresh={carregar} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {/* Seletor de período */}
        <View style={estilos.periodoRow}>
          {[3, 6, 12].map(n => (
            <TouchableOpacity key={n} style={[estilos.chipPer, meses === n && estilos.chipPerAtivo]} onPress={() => setMeses(n)}>
              <Text style={[estilos.chipPerT, meses === n && estilos.chipPerTAtivo]}>{n}M</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── PAINEIS DA SESSAO MAIS RECENTE ── */}
        {ultimo && (
          <>
            <View style={estilos.sessaoHeader}>
              <Text style={estilos.sessaoHeaderTitulo}>{ultimo.sessao_nome}</Text>
              <Text style={estilos.sessaoHeaderSub}>{ultimo.mes} · {ultimo.total_auditados}/{ultimo.total_produtos} produtos</Text>
            </View>

            {ultimo.apuracao_valor && (
              <PainelAcuracidade
                titulo="APURAÇÃO DE VALOR"
                dados={ultimo.apuracao_valor}
                formatarTotal={fmtMoedaCompleto}
                formatarAdj={fmtMoedaCompleto}
                cor="#1E40AF"
              />
            )}

            {ultimo.apuracao_unidades && (
              <PainelAcuracidade
                titulo="APURAÇÃO DE UNIDADES"
                dados={ultimo.apuracao_unidades}
                formatarTotal={v => fmtNum(v, 0)}
                formatarAdj={v => fmtNum(v, 0)}
                cor="#0284C7"
              />
            )}

            {ultimo.apuracao_itens && (
              <PainelAcuracidade
                titulo="APURAÇÃO DE ITENS (SKUs)"
                dados={{
                  ...ultimo.apuracao_itens,
                  total_sistema: ultimo.apuracao_itens.total,
                  ajuste_liquido: ultimo.apuracao_itens.diferenca_itens,
                }}
                formatarTotal={v => fmtNum(v, 0)}
                formatarAdj={v => fmtNum(v, 0)}
                cor="#7C3AED"
              />
            )}
          </>
        )}

        {/* ── HISTORICO DE SESSOES ── */}
        {hist.length > 1 && (
          <>
            <Text style={[estilos.dica, { marginTop: spacing.lg, textAlign: 'left', fontWeight: '700', color: colors.textSecondary }]}>
              HISTÓRICO DE SESSÕES
            </Text>
            {[...hist].reverse().map((h, i) => {
              const corAc = corAcur(h.acuracidade);
              return (
                <View key={i} style={estilos.histRow}>
                  <Text style={estilos.histMes}>{h.mes}</Text>
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Text style={estilos.histNome} numberOfLines={1}>{h.sessao_nome}</Text>
                    <View style={estilos.barraFundo}>
                      <View style={[estilos.barraFill, { width: `${Math.min(h.acuracidade, 100)}%`, backgroundColor: corAc }]} />
                    </View>
                  </View>
                  <Text style={[estilos.histAcur, { color: corAc }]}>{fmtNum(h.acuracidade, 1)}%</Text>
                </View>
              );
            })}
          </>
        )}

        {hist.length === 0 && (
          <Text style={estilos.semDados}>Nenhuma sessão concluída para esta loja</Text>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function Metrica({ rotulo, valor, cor }) {
  return (
    <View style={estilos.metrica}>
      <Text style={[estilos.metricaV, cor && { color: cor }]}>{valor}</Text>
      <Text style={estilos.metricaR}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista:     { padding: spacing.md },
  dica:      { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },

  // Cards de loja
  lojaCard:  { backgroundColor: colors.background, borderRadius: radius.md,
               padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  lojaTopo:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  lojaBadge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lojaCodigo:{ fontSize: fontSize.sm, fontWeight: '700' },
  lojaNome:  { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  lojaMeta:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  seta:      { fontSize: 20, color: colors.textMuted },
  lojaMetricas: { flexDirection: 'row', marginBottom: spacing.sm },
  metrica:   { flex: 1, alignItems: 'center' },
  metricaV:  { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  metricaR:  { fontSize: 9, color: colors.textSecondary, marginTop: 2 },

  // Barra de progresso
  barraFundo: { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  barraFill:  { height: '100%', borderRadius: radius.full },

  // Painel de acuracidade
  painel: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    overflow: 'hidden',
  },
  painelTitulo: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  painelLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  painelLinhaDestaque: {
    backgroundColor: colors.backgroundSoft,
  },
  painelLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  painelValorPrincipal: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  painelValorAdj: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  separador: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: 4,
  },
  acuracidadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSoft,
  },
  acuracidadeValor: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    marginLeft: spacing.sm,
    minWidth: 70,
    textAlign: 'right',
  },

  // Sessao header
  sessaoHeader: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessaoHeaderTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  sessaoHeaderSub:    { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Seletor de período
  periodoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chipPer:    { flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipPerAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPerT:   { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipPerTAtivo: { color: colors.white },

  // Histórico de sessões
  semDados:    { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  histRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
               borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs,
               borderWidth: 1, borderColor: colors.border },
  histMes:   { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, minWidth: 52 },
  histNome:  { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  histAcur:  { fontSize: fontSize.sm, fontWeight: '700', minWidth: 52, textAlign: 'right' },
});
