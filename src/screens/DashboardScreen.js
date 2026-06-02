// Dashboard principal do sistema de inventario.
// Charts implementados com Views puras (sem biblioteca externa) — funciona em web e mobile.
// Auto-refresh a cada 30 segundos.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarDashboardGeral } from '../services/api';
import NaturezaFiltro from '../components/NaturezaFiltro';
import GrupoMaterialFiltro from '../components/GrupoMaterialFiltro';

const INTERVALO = 30000;

function fmtMoeda(v) {
  if (!v && v !== 0) return '—';
  return `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDt(d) {
  if (!d) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function corAcur(v) {
  if (v >= 95) return colors.success;
  if (v >= 85) return colors.warning;
  return colors.danger;
}

// ── Chart de barras verticais (puro RN) ─────────────────────────────────────
function BarChart({ labels, data, suffixo = '' }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 150, paddingHorizontal: 4, gap: 6 }}>
        {data.map((val, i) => {
          const altPct = Math.max((val / max) * 100, 3);
          const cor = corAcur(val);
          return (
            <View key={i} style={{ alignItems: 'center', width: 44 }}>
              <Text style={{ fontSize: 9, color: cor, fontWeight: '700', marginBottom: 3 }}>
                {val}{suffixo}
              </Text>
              <View style={{ width: 28, height: altPct, backgroundColor: cor, borderRadius: 4 }} />
              <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4 }} numberOfLines={1}>
                {labels[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAtu, setUltimaAtu] = useState(null);
  const [naturezaId, setNaturezaId] = useState(null);
  const [grupoMaterial, setGrupoMaterial] = useState(null);
  const timerRef = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const d = await buscarDashboardGeral(naturezaId, grupoMaterial);
      setDados(d);
      setUltimaAtu(new Date());
    } catch (_) {}
    finally { setCarregando(false); setRefreshing(false); }
  }, [naturezaId, grupoMaterial]);

  useEffect(() => {
    carregar();
    timerRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [carregar]);

  if (carregando && !dados) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoLoad}>Carregando dashboard...</Text>
      </SafeAreaView>
    );
  }

  const kpis   = dados?.kpis    || {};
  const sess   = dados?.sessoes || {};
  const top    = dados?.top_divergencias || [];
  const ativas = dados?.sessoes_ativas   || [];
  const acLoja = dados?.acuracidade_por_loja || [];

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView
        contentContainerStyle={estilos.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); carregar(); }}
            colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        {/* Filtros: natureza + grupo de material */}
        <NaturezaFiltro
          value={naturezaId}
          onChange={id => { setNaturezaId(id); setGrupoMaterial(null); setCarregando(true); }}
        />
        <GrupoMaterialFiltro
          grupos={dados?.grupos_material || []}
          value={grupoMaterial}
          onChange={g => { setGrupoMaterial(g); setCarregando(true); }}
        />

        {/* Header */}
        <View style={estilos.header}>
          <View>
            <Text style={estilos.headerTitulo}>Dashboard</Text>
            {ultimaAtu && (
              <Text style={estilos.headerSub}>Atualizado às {fmtDt(ultimaAtu)}</Text>
            )}
          </View>
          <View style={estilos.liveBadge}>
            <View style={estilos.livePonto} />
            <Text style={estilos.liveTexto}>Ao vivo</Text>
          </View>
        </View>

        {/* KPIs linha 1 */}
        <View style={estilos.kpiRow}>
          <KpiCard rotulo="Lojas"         valor={kpis.total_lojas ?? '—'}             cor={colors.primary} />
          <KpiCard rotulo="Em andamento"  valor={sess.ativas ?? 0}                    cor={colors.info} />
          <KpiCard rotulo="Aguardando"    valor={sess.aguardando_aprovacao ?? 0}       cor={colors.warning} />
          <KpiCard rotulo="Concluídas"    valor={sess.concluidas_total ?? 0}           cor={colors.success} />
        </View>

        {/* KPIs linha 2 */}
        <View style={estilos.kpiRow}>
          <KpiCard
            largo
            rotulo="Acuracidade Média"
            valor={`${kpis.acuracidade_media ?? 0}%`}
            cor={corAcur(kpis.acuracidade_media ?? 0)}
          />
          <KpiCard
            largo
            rotulo="Valor Divergente Total"
            valor={fmtMoeda(kpis.valor_total_divergente)}
            cor={colors.danger}
          />
        </View>

        {/* Sessoes ativas */}
        {ativas.length > 0 && (
          <Secao titulo={`Sessoes ativas (${ativas.length})`}>
            {ativas.map(s => (
              <View key={s.sessao_id} style={estilos.sessaoCard}>
                <View style={estilos.sessaoTopo}>
                  <View style={[estilos.sessaoBadge, {
                    backgroundColor: s.status === 'aguardando_aprovacao' ? colors.warningSoft : colors.infoSoft,
                  }]}>
                    <Text style={[estilos.sessaoBadgeTexto, {
                      color: s.status === 'aguardando_aprovacao' ? colors.warning : colors.info,
                    }]}>{s.loja_codigo}</Text>
                  </View>
                  <Text style={estilos.sessaoNome} numberOfLines={1}>{s.nome}</Text>
                  <Text style={estilos.sessaoPct}>{s.percentual_progresso}%</Text>
                </View>
                <View style={estilos.progFundo}>
                  <View style={[estilos.progFill, { width: `${Math.max(s.percentual_progresso, 1)}%` }]} />
                </View>
                <Text style={estilos.sessaoSub}>
                  {s.contados}/{s.total_produtos} produtos
                  {s.status === 'aguardando_aprovacao' ? ' · Aguardando aprovação' : ''}
                </Text>
              </View>
            ))}
          </Secao>
        )}

        {/* Grafico acuracidade por loja */}
        {acLoja.length > 0 && (
          <Secao titulo="Acuracidade por loja (última sessão)">
            <BarChart
              labels={acLoja.map(l => l.loja_codigo)}
              data={acLoja.map(l => parseFloat(l.acuracidade || 0))}
              suffixo="%"
            />
            <View style={estilos.legenda}>
              <LegendaItem cor={colors.success}  texto="≥ 95% OK" />
              <LegendaItem cor={colors.warning}  texto="85–94% Atenção" />
              <LegendaItem cor={colors.danger}   texto="< 85% Crítico" />
            </View>
          </Secao>
        )}

        {/* Top divergencias */}
        {top.length > 0 && (
          <Secao titulo="Top divergências por valor">
            {top.map((d, i) => {
              const v = d.valor_diferenca || 0;
              const corV = v < 0 ? colors.danger : colors.warning;
              return (
                <View key={i} style={estilos.divRow}>
                  <View style={estilos.divRank}>
                    <Text style={estilos.divRankT}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={estilos.divNome} numberOfLines={1}>{d.produto_descricao}</Text>
                    <Text style={estilos.divSku}>{d.produto_sku} · {d.loja_codigo}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[estilos.divValor, { color: corV }]}>
                      {v > 0 ? '+' : ''}{fmtMoeda(v)}
                    </Text>
                    <View style={[estilos.divStatus, {
                      backgroundColor: d.status === 'aprovada' ? colors.successSoft
                        : d.status === 'rejeitada' ? colors.dangerSoft : colors.warningSoft,
                    }]}>
                      <Text style={[estilos.divStatusT, {
                        color: d.status === 'aprovada' ? colors.success
                          : d.status === 'rejeitada' ? colors.danger : colors.warning,
                      }]}>{(d.status || '').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </Secao>
        )}

        {/* Link para detalhe por loja */}
        <Secao titulo="Detalhe por loja">
          <TouchableOpacity style={estilos.botaoLojas} onPress={() => navigation.navigate('DashboardLojas')}>
            <Text style={estilos.botaoLojasT}>Ver histórico de todas as lojas →</Text>
          </TouchableOpacity>
        </Secao>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ rotulo, valor, cor, largo }) {
  return (
    <View style={[estilos.kpiCard, largo && { flex: 2 }]}>
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

function LegendaItem({ cor, texto }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cor }} />
      <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoLoad:  { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  scroll:     { padding: spacing.lg },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  headerTitulo: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  headerSub:    { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.successSoft, paddingHorizontal: spacing.sm,
                paddingVertical: 4, borderRadius: radius.full },
  livePonto:  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveTexto:  { fontSize: fontSize.xs, color: colors.success, fontWeight: '600' },

  kpiRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  kpiCard:   { flex: 1, backgroundColor: colors.background, borderRadius: radius.md,
               padding: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  kpiValor:  { fontSize: fontSize.xl, fontWeight: '800', marginBottom: 4 },
  kpiRotulo: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },

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
  progFundo:   { height: 6, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden', marginBottom: 4 },
  progFill:    { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  sessaoSub:   { fontSize: fontSize.xs, color: colors.textSecondary },

  legenda: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },

  divRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
              borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs,
              borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  divRank:  { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft,
              alignItems: 'center', justifyContent: 'center' },
  divRankT: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  divNome:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  divSku:   { fontSize: fontSize.xs, color: colors.textSecondary },
  divValor: { fontSize: fontSize.sm, fontWeight: '700' },
  divStatus:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginTop: 2 },
  divStatusT:{ fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  botaoLojas:  { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  botaoLojasT: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
});
