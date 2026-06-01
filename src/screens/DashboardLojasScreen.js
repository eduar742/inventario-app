// Tela de visao por loja do dashboard.
// Lista todas as lojas com KPIs e permite navegar para o historico mes a mes.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarDashboardLojas, buscarDashboardHistorico } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - spacing.lg * 2 - 2;
const INTERVALO = 30000;

function fmtMoeda(v) {
  if (!v && v !== 0) return '—';
  return `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const chartConfig = {
  backgroundColor: colors.background,
  backgroundGradientFrom: colors.background,
  backgroundGradientTo: colors.background,
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(30, 64, 175, ${opacity})`,
  labelColor: () => colors.textSecondary,
  style: { borderRadius: radius.md },
  propsForLabels: { fontSize: 10 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
};

const chartConfigDanger = {
  ...chartConfig,
  color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
  propsForDots: { r: '4', strokeWidth: '2', stroke: colors.danger },
};

// ── Tela principal: lista de lojas ─────────────────────────────────────────

export default function DashboardLojasScreen({ navigation }) {
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const d = await buscarDashboardLojas();
      setLojas(d);
    } catch (_) {}
    finally { setCarregando(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    carregar();
    intervalRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(intervalRef.current);
  }, [carregar]);

  function corAcuracidade(v) {
    if (v >= 95) return colors.success;
    if (v >= 85) return colors.warning;
    if (v > 0)   return colors.danger;
    return colors.textMuted;
  }

  function renderLoja({ item: loja }) {
    const cor = corAcuracidade(loja.acuracidade);
    const temAtiva = !!loja.sessao_ativa;

    return (
      <TouchableOpacity
        style={estilos.lojaCard}
        onPress={() => navigation.navigate('DashboardHistorico', { loja })}
        activeOpacity={0.75}
      >
        {/* Cabecalho */}
        <View style={estilos.lojaTopo}>
          <View style={[estilos.lojaBadge, { backgroundColor: temAtiva ? colors.infoSoft : colors.backgroundSoft }]}>
            <Text style={[estilos.lojaCodigo, { color: temAtiva ? colors.info : colors.textSecondary }]}>
              {loja.codigo}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={estilos.lojaNome} numberOfLines={1}>{loja.nome}</Text>
            <Text style={estilos.lojaMes}>
              {loja.ultima_sessao_mes || 'Sem sessao'}
              {temAtiva ? ` · ${loja.sessao_ativa === 'aguardando_aprovacao' ? 'Aguard.' : 'Em andamento'}` : ''}
            </Text>
          </View>
          <Text style={estilos.lojaSetinha}>›</Text>
        </View>

        {/* Metricas */}
        <View style={estilos.lojaMetricas}>
          <MetricaItem rotulo="Acuracidade" valor={`${loja.acuracidade}%`} cor={cor} />
          <MetricaItem rotulo="Auditados"   valor={`${loja.total_auditados}/${loja.total_produtos}`} />
          <MetricaItem rotulo="V. Estoque"  valor={fmtMoeda(loja.valor_estoque)} />
          <MetricaItem rotulo="V. Diverg."  valor={fmtMoeda(loja.valor_divergente)} cor={loja.valor_divergente > 0 ? colors.danger : colors.textSecondary} />
        </View>

        {/* Barra de acuracidade */}
        <View style={estilos.barraFundo}>
          <View style={[estilos.barraFill, { width: `${loja.acuracidade}%`, backgroundColor: cor }]} />
          <View style={[estilos.barraRef, { left: '95%' }]} />
        </View>
      </TouchableOpacity>
    );
  }

  if (carregando && lojas.length === 0) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <FlatList
        data={lojas}
        renderItem={renderLoja}
        keyExtractor={l => l.loja_id}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <Text style={estilos.hint}>Toque em uma loja para ver o historico mes a mes</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); carregar(); }}
            colors={[colors.primary]} tintColor={colors.primary} />
        }
      />
    </SafeAreaView>
  );
}

// ── Tela de historico de uma loja ────────────────────────────────────────────

export function DashboardHistoricoScreen({ navigation, route }) {
  const { loja } = route.params;
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [meses, setMeses] = useState(6);
  const intervalRef = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const d = await buscarDashboardHistorico(loja.loja_id, meses);
      setHistorico(d);
    } catch (_) {}
    finally { setCarregando(false); }
  }, [loja.loja_id, meses]);

  useEffect(() => {
    carregar();
    intervalRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(intervalRef.current);
  }, [carregar]);

  if (carregando && !historico) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const hist = historico?.historico || [];
  const labels = hist.map(h => h.mes?.slice(5) || '');   // ex: "2026-01" → "01"
  const acuracias = hist.map(h => parseFloat(h.acuracidade || 0));
  const valoresDiverg = hist.map(h => parseFloat(h.valor_divergente || 0));
  const totalAuditados = hist.map(h => h.total_auditados || 0);

  const ultimoMes = hist[hist.length - 1];

  return (
    <SafeAreaView style={estilos.container}>
      <FlatList
        data={hist}
        keyExtractor={h => h.mes}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <View>
            {/* KPIs do ultimo mes */}
            {ultimoMes && (
              <View style={estilos.kpiRow}>
                <KpiMini rotulo="Ultimo mes"  valor={ultimoMes.mes} />
                <KpiMini rotulo="Acuracidade" valor={`${ultimoMes.acuracidade}%`}
                  cor={ultimoMes.acuracidade >= 95 ? colors.success : ultimoMes.acuracidade >= 85 ? colors.warning : colors.danger} />
                <KpiMini rotulo="Auditados"   valor={`${ultimoMes.total_auditados}/${ultimoMes.total_produtos}`} />
              </View>
            )}

            {/* Seletor de periodo */}
            <View style={estilos.periodoRow}>
              {[3, 6, 12].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[estilos.chipPeriodo, meses === n && estilos.chipPeriodoAtivo]}
                  onPress={() => setMeses(n)}
                >
                  <Text style={[estilos.chipPeriodoTexto, meses === n && estilos.chipPeriodoTextoAtivo]}>
                    {n}M
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Linha de tendencia — acuracidade */}
            {acuracias.length >= 2 && (
              <View style={estilos.graficoBloco}>
                <Text style={estilos.graficoTitulo}>Acuracidade quantitativa (%)</Text>
                <LineChart
                  data={{ labels, datasets: [{ data: acuracias }] }}
                  width={CHART_W}
                  height={180}
                  yAxisSuffix="%"
                  fromZero={false}
                  chartConfig={chartConfig}
                  style={estilos.chart}
                  bezier
                  withDots
                />
              </View>
            )}

            {/* Barras — produtos auditados */}
            {totalAuditados.length >= 2 && (
              <View style={estilos.graficoBloco}>
                <Text style={estilos.graficoTitulo}>Produtos auditados por sessao</Text>
                <BarChart
                  data={{ labels, datasets: [{ data: totalAuditados }] }}
                  width={CHART_W}
                  height={160}
                  fromZero
                  chartConfig={chartConfig}
                  style={estilos.chart}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Linha de tendencia — valor divergente */}
            {valoresDiverg.length >= 2 && valoresDiverg.some(v => v > 0) && (
              <View style={estilos.graficoBloco}>
                <Text style={estilos.graficoTitulo}>Valor divergente por sessao (R$)</Text>
                <LineChart
                  data={{ labels, datasets: [{ data: valoresDiverg }] }}
                  width={CHART_W}
                  height={180}
                  fromZero
                  chartConfig={chartConfigDanger}
                  style={estilos.chart}
                  bezier
                />
              </View>
            )}

            <Text style={[estilos.secaoTitulo, { marginTop: spacing.md }]}>Historico de sessoes</Text>
          </View>
        }
        renderItem={({ item: h }) => (
          <View style={estilos.histRow}>
            <Text style={estilos.histMes}>{h.mes}</Text>
            <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
              <Text style={estilos.histNome} numberOfLines={1}>{h.sessao_nome}</Text>
              <View style={estilos.histBarraFundo}>
                <View style={[estilos.histBarraFill, {
                  width: `${h.acuracidade}%`,
                  backgroundColor: h.acuracidade >= 95 ? colors.success : h.acuracidade >= 85 ? colors.warning : colors.danger
                }]} />
              </View>
            </View>
            <Text style={[estilos.histAcur, {
              color: h.acuracidade >= 95 ? colors.success : h.acuracidade >= 85 ? colors.warning : colors.danger
            }]}>{h.acuracidade}%</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>Nenhum historico disponivel para esta loja</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function MetricaItem({ rotulo, valor, cor }) {
  return (
    <View style={estilos.metrica}>
      <Text style={[estilos.metricaValor, cor && { color: cor }]}>{valor}</Text>
      <Text style={estilos.metricaRotulo}>{rotulo}</Text>
    </View>
  );
}

function KpiMini({ rotulo, valor, cor }) {
  return (
    <View style={estilos.kpiMini}>
      <Text style={[estilos.kpiMiniValor, cor && { color: cor }]}>{valor}</Text>
      <Text style={estilos.kpiMiniRotulo}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista:     { padding: spacing.lg },
  hint:      { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center',
               marginBottom: spacing.md },

  // Card de loja
  lojaCard: { backgroundColor: colors.background, borderRadius: radius.md,
              padding: spacing.md, marginBottom: spacing.sm,
              borderWidth: 1, borderColor: colors.border },
  lojaTopo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  lojaBadge:{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center',
              justifyContent: 'center', flexShrink: 0 },
  lojaCodigo: { fontSize: fontSize.sm, fontWeight: '700' },
  lojaNome: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  lojaMes:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  lojaSetinha: { fontSize: 20, color: colors.textMuted },

  lojaMetricas: { flexDirection: 'row', marginBottom: spacing.sm },
  metrica:      { flex: 1, alignItems: 'center' },
  metricaValor: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  metricaRotulo:{ fontSize: 10, color: colors.textSecondary, marginTop: 2 },

  barraFundo: { height: 6, backgroundColor: colors.border, borderRadius: radius.full,
                overflow: 'hidden', position: 'relative' },
  barraFill:  { height: '100%', borderRadius: radius.full },
  barraRef:   { position: 'absolute', top: 0, bottom: 0, width: 1,
                backgroundColor: colors.primary + '66' },

  // Historico
  kpiRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpiMini:   { flex: 1, backgroundColor: colors.background, borderRadius: radius.md,
               padding: spacing.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  kpiMiniValor:  { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  kpiMiniRotulo: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  periodoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chipPeriodo:    { flex: 1, padding: spacing.sm, borderRadius: radius.sm,
                   borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipPeriodoAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPeriodoTexto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipPeriodoTextoAtivo: { color: colors.white },

  graficoBloco: { marginBottom: spacing.lg },
  graficoTitulo: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary,
                   marginBottom: spacing.sm },
  chart: { borderRadius: radius.md },

  secaoTitulo: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary,
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },

  histRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
               borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs,
               borderWidth: 1, borderColor: colors.border },
  histMes:   { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, minWidth: 52 },
  histNome:  { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  histBarraFundo: { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  histBarraFill:  { height: '100%', borderRadius: radius.full },
  histAcur:  { fontSize: fontSize.sm, fontWeight: '700', minWidth: 48, textAlign: 'right' },

  vazio:      { alignItems: 'center', padding: spacing.xl },
  vazioTexto: { fontSize: fontSize.md, color: colors.textMuted },
});
