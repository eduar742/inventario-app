// Dashboard principal do sistema de inventario.
// Exibe KPIs globais, sessoes ativas, acuracidade por loja e top divergencias.
// Atualiza automaticamente a cada 30 segundos.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarDashboardGeral, pegarUsuario } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - spacing.lg * 2 - 2;
const INTERVALO_AUTO_REFRESH = 30000; // 30 segundos

function fmtMoeda(v) {
  if (!v && v !== 0) return '—';
  return `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardScreen({ navigation }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const intervalRef = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const d = await buscarDashboardGeral();
      setDados(d);
      setUltimaAtualizacao(new Date());
    } catch (_) {}
    finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    intervalRef.current = setInterval(() => carregar(true), INTERVALO_AUTO_REFRESH);
    return () => clearInterval(intervalRef.current);
  }, [carregar]);

  if (carregando && !dados) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando dashboard...</Text>
      </SafeAreaView>
    );
  }

  const kpis = dados?.kpis || {};
  const sessoes = dados?.sessoes || {};
  const top = dados?.top_divergencias || [];
  const acurLoja = (dados?.acuracidade_por_loja || []).slice(0, 12);
  const ativas = dados?.sessoes_ativas || [];

  // Dados para o grafico de barras de acuracidade por loja
  const barLabels = acurLoja.map(l => l.loja_codigo);
  const barData   = acurLoja.map(l => parseFloat(l.acuracidade || 0));

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView
        contentContainerStyle={estilos.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }}
            colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {/* Cabeçalho */}
        <View style={estilos.header}>
          <View>
            <Text style={estilos.headerTitulo}>Dashboard</Text>
            {ultimaAtualizacao && (
              <Text style={estilos.headerSub}>Atualizado {fmtDt(ultimaAtualizacao.toISOString())}</Text>
            )}
          </View>
          <View style={estilos.autoRefreshBadge}>
            <View style={estilos.pulsoDot} />
            <Text style={estilos.autoRefreshTexto}>Ao vivo</Text>
          </View>
        </View>

        {/* ── KPI Cards ── */}
        <View style={estilos.kpiRow}>
          <KpiCard rotulo="Lojas"       valor={kpis.total_lojas ?? '—'}         cor={colors.primary} />
          <KpiCard rotulo="Em andamento" valor={sessoes.ativas ?? 0}             cor={colors.info} />
          <KpiCard rotulo="Aguardando"  valor={sessoes.aguardando_aprovacao ?? 0} cor={colors.warning} />
          <KpiCard rotulo="Concluídas"  valor={sessoes.concluidas_total ?? 0}    cor={colors.success} />
        </View>

        <View style={estilos.kpiRow}>
          <KpiCard
            rotulo="Acuracidade Média"
            valor={`${kpis.acuracidade_media ?? 0}%`}
            cor={kpis.acuracidade_media >= 95 ? colors.success : kpis.acuracidade_media >= 85 ? colors.warning : colors.danger}
            largo
          />
          <KpiCard
            rotulo="Valor Divergente"
            valor={fmtMoeda(kpis.valor_total_divergente)}
            cor={colors.danger}
            largo
          />
        </View>

        {/* ── Sessoes ativas ── */}
        {ativas.length > 0 && (
          <Secao titulo={`Sessoes ativas (${ativas.length})`}>
            {ativas.map(s => (
              <TouchableOpacity
                key={s.sessao_id}
                style={estilos.sessaoCard}
                onPress={() => navigation.navigate('Sessoes', {
                  loja: { id: s.sessao_id, codigo: s.loja_codigo, nome: s.loja_nome }
                })}
                activeOpacity={0.7}
              >
                <View style={estilos.sessaoTopo}>
                  <View style={[estilos.sessaoBadge, {
                    backgroundColor: s.status === 'aguardando_aprovacao' ? colors.warningSoft : colors.infoSoft
                  }]}>
                    <Text style={[estilos.sessaoBadgeTexto, {
                      color: s.status === 'aguardando_aprovacao' ? colors.warning : colors.info
                    }]}>{s.loja_codigo}</Text>
                  </View>
                  <Text style={estilos.sessaoNome} numberOfLines={1}>{s.nome}</Text>
                  <Text style={estilos.sessaoPct}>{s.percentual_progresso}%</Text>
                </View>
                <View style={estilos.progressoFundo}>
                  <View style={[estilos.progressoFill, { width: `${s.percentual_progresso}%` }]} />
                </View>
                <Text style={estilos.sessaoSub}>
                  {s.contados} / {s.total_produtos} produtos
                  {s.status === 'aguardando_aprovacao' ? ' · Aguard. aprovacao' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </Secao>
        )}

        {/* ── Grafico de barras — acuracidade por loja ── */}
        {barData.length > 0 && (
          <Secao titulo="Acuracidade por loja (ultima sessao)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: barLabels,
                  datasets: [{ data: barData }],
                }}
                width={Math.max(CHART_W, barLabels.length * 52)}
                height={200}
                yAxisSuffix="%"
                fromZero
                chartConfig={chartConfig}
                style={estilos.chart}
                showValuesOnTopOfBars
                withInnerLines={false}
              />
            </ScrollView>
            <Text style={estilos.chartLegenda}>
              Meta: 95% · Amarelo &lt; 85% · Verde ≥ 95%
            </Text>
          </Secao>
        )}

        {/* ── Top divergencias ── */}
        {top.length > 0 && (
          <Secao titulo="Top divergencias por valor">
            {top.map((d, i) => {
              const valor = d.valor_diferenca;
              const corValor = valor < 0 ? colors.danger : colors.warning;
              return (
                <View key={i} style={estilos.divRow}>
                  <View style={estilos.divRank}>
                    <Text style={estilos.divRankTexto}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.divProd} numberOfLines={1}>{d.produto_descricao}</Text>
                    <Text style={estilos.divSku}>{d.produto_sku} · {d.loja_codigo}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[estilos.divValor, { color: corValor }]}>
                      {valor > 0 ? '+' : ''}{fmtMoeda(valor)}
                    </Text>
                    <View style={[estilos.divBadge, {
                      backgroundColor: d.status === 'aprovada' ? colors.successSoft
                        : d.status === 'rejeitada' ? colors.dangerSoft : colors.warningSoft
                    }]}>
                      <Text style={[estilos.divBadgeTexto, {
                        color: d.status === 'aprovada' ? colors.success
                          : d.status === 'rejeitada' ? colors.danger : colors.warning
                      }]}>{d.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </Secao>
        )}

        {/* ── Lojas — ver detalhes ── */}
        <Secao titulo="Detalhe por loja">
          <TouchableOpacity
            style={estilos.botaoVerLojas}
            onPress={() => navigation.navigate('DashboardLojas')}
          >
            <Text style={estilos.botaoVerLojasTexto}>Ver acuracidade e histórico de todas as lojas →</Text>
          </TouchableOpacity>
        </Secao>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ rotulo, valor, cor, largo }) {
  return (
    <View style={[estilos.kpiCard, largo && estilos.kpiCardLargo]}>
      <Text style={[estilos.kpiValor, { color: cor }]}>{valor}</Text>
      <Text style={estilos.kpiRotulo}>{rotulo}</Text>
    </View>
  );
}

function Secao({ titulo, children }) {
  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

const chartConfig = {
  backgroundColor: colors.background,
  backgroundGradientFrom: colors.background,
  backgroundGradientTo: colors.background,
  decimalPlaces: 1,
  color: (opacity = 1, index) => {
    const val = index !== undefined && Array.isArray(chartConfig._data)
      ? chartConfig._data[index] : 100;
    if (val >= 95) return `rgba(22, 163, 74, ${opacity})`;   // verde
    if (val >= 85) return `rgba(234, 88, 12, ${opacity})`;   // laranja
    return `rgba(220, 38, 38, ${opacity})`;                  // vermelho
  },
  labelColor: () => colors.textSecondary,
  style: { borderRadius: radius.md },
  propsForLabels: { fontSize: 10 },
};

const estilos = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  scroll:          { padding: spacing.lg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  headerTitulo: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  headerSub:    { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  autoRefreshBadge: { flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.successSoft, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  pulsoDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  autoRefreshTexto: { fontSize: fontSize.xs, color: colors.success, fontWeight: '600' },

  // KPI cards
  kpiRow:      { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpiCard:     { flex: 1, backgroundColor: colors.background, borderRadius: radius.md,
                 padding: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  kpiCardLargo: { flex: 2 },
  kpiValor:    { fontSize: fontSize.xl, fontWeight: '800', marginBottom: 4 },
  kpiRotulo:   { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },

  // Sessoes ativas
  secao:       { marginBottom: spacing.lg },
  secaoTitulo: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary,
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  sessaoCard:  { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md,
                 marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sessaoTopo:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  sessaoBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, marginRight: spacing.sm },
  sessaoBadgeTexto: { fontSize: fontSize.xs, fontWeight: '700' },
  sessaoNome:  { flex: 1, fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  sessaoPct:   { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginLeft: spacing.sm },
  progressoFundo: { height: 6, backgroundColor: colors.border, borderRadius: radius.full,
                    overflow: 'hidden', marginBottom: 4 },
  progressoFill:  { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  sessaoSub:   { fontSize: fontSize.xs, color: colors.textSecondary },

  // Grafico
  chart:        { borderRadius: radius.md },
  chartLegenda: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: 4 },

  // Top divergencias
  divRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
             borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs,
             borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  divRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft,
             alignItems: 'center', justifyContent: 'center' },
  divRankTexto: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  divProd: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  divSku:  { fontSize: fontSize.xs, color: colors.textSecondary },
  divValor: { fontSize: fontSize.sm, fontWeight: '700' },
  divBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  divBadgeTexto: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  botaoVerLojas:      { backgroundColor: colors.primarySoft, borderRadius: radius.md,
                        padding: spacing.md, alignItems: 'center' },
  botaoVerLojasTexto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
});
