// Dashboard por loja e historico mes a mes.
// Charts implementados com Views puras — sem biblioteca externa.

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
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `R$ ${(n / 1000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

function corAcur(v) {
  if (v >= 95) return colors.success;
  if (v >= 85) return colors.warning;
  if (v > 0)   return colors.danger;
  return colors.textMuted;
}

// ── Grafico de barras vertical simples ──────────────────────────────────────
function BarChartSimples({ labels, data, cor, suffixo = '', altura = 120 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: altura + 32, paddingHorizontal: 4, gap: 6 }}>
        {data.map((val, i) => {
          const h = Math.max((val / max) * altura, 4);
          const c = typeof cor === 'function' ? cor(val) : (cor || colors.primary);
          return (
            <View key={i} style={{ alignItems: 'center', width: 44 }}>
              <Text style={{ fontSize: 9, color: c, fontWeight: '700', marginBottom: 3 }}>
                {typeof val === 'number' ? val.toFixed(0) : val}{suffixo}
              </Text>
              <View style={{ width: 28, height: h, backgroundColor: c, borderRadius: 4 }} />
              <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}
                numberOfLines={1}>{labels[i]}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Grafico de linha (sparkline com segmentos) ───────────────────────────────
function SparkLine({ labels, data, cor = colors.primary, suffixo = '', altura = 100 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: altura + 36, gap: 0 }}>
        {data.map((val, i) => {
          const h = Math.max(((val - min) / range) * altura, 4);
          const isLast = i === data.length - 1;
          return (
            <View key={i} style={{ alignItems: 'center', width: 52 }}>
              <Text style={{ fontSize: 9, color: cor, fontWeight: '700', marginBottom: 2 }}>
                {typeof val === 'number' ? val.toFixed(1) : val}{suffixo}
              </Text>
              <View style={{ height: altura, justifyContent: 'flex-end', alignItems: 'center' }}>
                {/* Linha conectando ao proximo */}
                {!isLast && (
                  <View style={{
                    position: 'absolute', bottom: h - 4, left: 26, right: -26,
                    height: 2, backgroundColor: cor + '55', zIndex: 0,
                  }} />
                )}
                {/* Ponto */}
                <View style={{
                  width: 12, height: 12, borderRadius: 6,
                  backgroundColor: cor, borderWidth: 2, borderColor: colors.background,
                  zIndex: 1, marginBottom: h - 6,
                }} />
              </View>
              <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}
                numberOfLines={1}>{labels[i]}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
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
    try {
      const d = await buscarDashboardLojas();
      setLojas(d);
    } catch (_) {}
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
            <Text style={[estilos.lojaCodigo, { color: temAtiva ? colors.info : colors.textSecondary }]}>
              {l.codigo}
            </Text>
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

        {/* Metricas */}
        <View style={estilos.metricas}>
          <Metrica rotulo="Acuracidade"  valor={`${l.acuracidade}%`}           cor={cor} />
          <Metrica rotulo="Auditados"    valor={`${l.total_auditados}/${l.total_produtos}`} />
          <Metrica rotulo="Estoque"      valor={fmtMoeda(l.valor_estoque)} />
          <Metrica rotulo="Divergente"   valor={fmtMoeda(l.valor_divergente)}
            cor={l.valor_divergente > 0 ? colors.danger : colors.textSecondary} />
        </View>

        {/* Barra de acuracidade */}
        <View style={estilos.barraFundo}>
          <View style={[estilos.barraFill, { width: `${Math.min(l.acuracidade, 100)}%`, backgroundColor: cor }]} />
          {/* Linha de meta 95% */}
          <View style={[estilos.barraMeta, { left: '95%' }]} />
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
          <Text style={estilos.dica}>Toque em uma loja para ver o histórico mês a mês</Text>
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

// ── TELA 2: Historico mes a mes ───────────────────────────────────────────────
export function DashboardHistoricoScreen({ navigation, route }) {
  const { loja } = route.params;
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [meses, setMeses] = useState(6);
  const timerRef = useRef(null);

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
    timerRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [carregar]);

  if (carregando && !historico) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const hist    = historico?.historico || [];
  const labels  = hist.map(h => (h.mes || '').slice(5));  // "2026-01" → "01"
  const acurs   = hist.map(h => parseFloat(h.acuracidade || 0));
  const divs    = hist.map(h => parseFloat(h.valor_divergente || 0));
  const audits  = hist.map(h => h.total_auditados || 0);
  const ultimo  = hist[hist.length - 1];

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl refreshing={false}
            onRefresh={carregar} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {/* KPIs do ultimo mes */}
        {ultimo && (
          <View style={estilos.kpiRow}>
            <KpiMini rotulo="Último mês"   valor={ultimo.mes} />
            <KpiMini rotulo="Acuracidade"  valor={`${ultimo.acuracidade}%`} cor={corAcur(ultimo.acuracidade)} />
            <KpiMini rotulo="Auditados"    valor={`${ultimo.total_auditados}/${ultimo.total_produtos}`} />
          </View>
        )}

        {/* Seletor de periodo */}
        <View style={estilos.periodoRow}>
          {[3, 6, 12].map(n => (
            <TouchableOpacity
              key={n}
              style={[estilos.chipPer, meses === n && estilos.chipPerAtivo]}
              onPress={() => setMeses(n)}
            >
              <Text style={[estilos.chipPerT, meses === n && estilos.chipPerTAtivo]}>{n}M</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grafico: acuracidade */}
        {acurs.length > 0 && (
          <GraficoBloco titulo="Acuracidade quantitativa (%)">
            {acurs.length >= 2
              ? <SparkLine labels={labels} data={acurs} cor={colors.primary} suffixo="%" />
              : <BarChartSimples labels={labels} data={acurs} cor={corAcur} suffixo="%" />
            }
          </GraficoBloco>
        )}

        {/* Grafico: produtos auditados */}
        {audits.length > 0 && (
          <GraficoBloco titulo="Produtos auditados por sessão">
            <BarChartSimples labels={labels} data={audits} cor={colors.info} />
          </GraficoBloco>
        )}

        {/* Grafico: valor divergente */}
        {divs.some(v => v > 0) && (
          <GraficoBloco titulo="Valor divergente por sessão (R$)">
            {divs.length >= 2
              ? <SparkLine labels={labels} data={divs} cor={colors.danger} />
              : <BarChartSimples labels={labels} data={divs} cor={colors.danger} />
            }
          </GraficoBloco>
        )}

        {/* Tabela historico */}
        <Text style={estilos.secaoTitulo}>Histórico de sessões</Text>
        {hist.length === 0 && (
          <Text style={estilos.semDados}>Nenhuma sessão concluída para esta loja</Text>
        )}
        {hist.map((h, i) => {
          const cor = corAcur(h.acuracidade);
          return (
            <View key={i} style={estilos.histRow}>
              <Text style={estilos.histMes}>{h.mes}</Text>
              <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                <Text style={estilos.histNome} numberOfLines={1}>{h.sessao_nome}</Text>
                <View style={estilos.histBarraFundo}>
                  <View style={[estilos.histBarraFill, { width: `${Math.min(h.acuracidade, 100)}%`, backgroundColor: cor }]} />
                </View>
              </View>
              <Text style={[estilos.histAcur, { color: cor }]}>{h.acuracidade}%</Text>
            </View>
          );
        })}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Componentes auxiliares ───────────────────────────────────────────────────
function Metrica({ rotulo, valor, cor }) {
  return (
    <View style={estilos.metrica}>
      <Text style={[estilos.metricaV, cor && { color: cor }]}>{valor}</Text>
      <Text style={estilos.metricaR}>{rotulo}</Text>
    </View>
  );
}

function KpiMini({ rotulo, valor, cor }) {
  return (
    <View style={estilos.kpiMini}>
      <Text style={[estilos.kpiMiniV, cor && { color: cor }]}>{valor}</Text>
      <Text style={estilos.kpiMiniR}>{rotulo}</Text>
    </View>
  );
}

function GraficoBloco({ titulo, children }) {
  return (
    <View style={estilos.graficoBloco}>
      <Text style={estilos.graficoTitulo}>{titulo}</Text>
      <View style={estilos.graficoArea}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista:     { padding: spacing.lg },
  dica:      { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },

  lojaCard:  { backgroundColor: colors.background, borderRadius: radius.md,
               padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  lojaTopo:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  lojaBadge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lojaCodigo:{ fontSize: fontSize.sm, fontWeight: '700' },
  lojaNome:  { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  lojaMeta:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  seta:      { fontSize: 20, color: colors.textMuted },

  metricas:  { flexDirection: 'row', marginBottom: spacing.sm },
  metrica:   { flex: 1, alignItems: 'center' },
  metricaV:  { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  metricaR:  { fontSize: 9, color: colors.textSecondary, marginTop: 2 },

  barraFundo: { height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden', position: 'relative' },
  barraFill:  { height: '100%', borderRadius: radius.full },
  barraMeta:  { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.primary + '88' },

  kpiRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpiMini:   { flex: 1, backgroundColor: colors.background, borderRadius: radius.md,
               padding: spacing.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  kpiMiniV:  { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  kpiMiniR:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  periodoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chipPer:    { flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipPerAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPerT:   { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipPerTAtivo: { color: colors.white },

  graficoBloco: { marginBottom: spacing.lg },
  graficoTitulo:{ fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  graficoArea:  { backgroundColor: colors.background, borderRadius: radius.md,
                  padding: spacing.md, borderWidth: 1, borderColor: colors.border },

  secaoTitulo: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary,
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  semDados:    { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },

  histRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
                  borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs,
                  borderWidth: 1, borderColor: colors.border },
  histMes:      { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, minWidth: 52 },
  histNome:     { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  histBarraFundo:{ height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  histBarraFill: { height: '100%', borderRadius: radius.full },
  histAcur:     { fontSize: fontSize.sm, fontWeight: '700', minWidth: 48, textAlign: 'right' },
});
