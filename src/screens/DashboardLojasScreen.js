// Dashboard por loja — visual consolidado com 3 paineis de acuracidade.
// Regras de cor:
//   Valor/Unidades: verde >= 99%, amarelo >= 98%, vermelho < 98%
//   SKU (itens):    verde >= 90%, amarelo >= 80%, vermelho < 80%

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarDashboardLojas, buscarDashboardHistorico } from '../services/api';
import NaturezaFiltro from '../components/NaturezaFiltro';

const INTERVALO = 30000;

// ── Formatacao numerica segura (sem toLocaleString) ────────────────────────
function _mil(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function fmtNum(v, dec = 0) {
  if (v == null || isNaN(parseFloat(v))) return '—';
  const n = parseFloat(v);
  const f = Math.abs(n).toFixed(dec).split('.');
  const s = dec > 0 ? `${_mil(f[0])},${f[1]}` : _mil(f[0]);
  return n < 0 ? `-${s}` : s;
}

function fmtR$(v) {
  if (v == null || isNaN(parseFloat(v))) return '—';
  const n = parseFloat(v);
  const abs = Math.abs(n);
  const f = abs.toFixed(2).split('.');
  return (n < 0 ? '-' : '') + `R$ ${_mil(f[0])},${f[1]}`;
}

function fmtMoeda(v) {
  if (v == null || isNaN(parseFloat(v))) return '—';
  const n = parseFloat(v);
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n < 0 ? '-' : '') + `R$ ${(abs / 1000000).toFixed(2).replace('.', ',')}M`;
  if (abs >= 1000)    return (n < 0 ? '-' : '') + `R$ ${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  const f = abs.toFixed(2).split('.');
  return (n < 0 ? '-' : '') + `R$ ${_mil(f[0])},${f[1]}`;
}

// ── Regras de cor por dimensao ─────────────────────────────────────────────
function corValorUnid(v) {
  const n = parseFloat(v) || 0;
  if (n >= 99) return '#16A34A'; // verde
  if (n >= 98) return '#D97706'; // amarelo
  return '#DC2626';              // vermelho
}

function corSku(v) {
  const n = parseFloat(v) || 0;
  if (n >= 90) return '#16A34A';
  if (n >= 80) return '#D97706';
  return '#DC2626';
}

const SOFT = { '#16A34A': '#DCFCE7', '#D97706': '#FEF3C7', '#DC2626': '#FEE2E2' };

// ── Painel estilo consolidado ──────────────────────────────────────────────
function Painel({ titulo, acuracidade, corFn, linhas }) {
  const cor = corFn(acuracidade);
  const soft = SOFT[cor] || '#F8FAFC';
  const pct = Math.min(Math.max(parseFloat(acuracidade) || 0, 0), 100);

  return (
    <View style={[estilos.painel, { borderColor: cor }]}>
      {/* Header colorido */}
      <View style={[estilos.painelHeader, { backgroundColor: cor }]}>
        <Text style={estilos.painelHeaderTitulo}>{titulo}</Text>
        <Text style={estilos.painelHeaderAcur}>{fmtNum(acuracidade, 2)}%</Text>
      </View>

      {/* Barra de progresso */}
      <View style={[estilos.barraFundo, { backgroundColor: soft }]}>
        <View style={[estilos.barraFill, { width: `${pct}%`, backgroundColor: cor }]} />
      </View>

      {/* Linhas de dados */}
      {linhas.map((l, i) => (
        <View key={i} style={[estilos.painelLinha,
          i === linhas.length - 1 && { borderBottomWidth: 0 },
          l.destaque && { backgroundColor: soft },
        ]}>
          <Text style={[estilos.painelLabel, l.destaque && { fontWeight: '700', color: '#0F172A' }]}>
            {l.label}
          </Text>
          <Text style={[estilos.painelValor, l.corValor && { color: l.corValor },
            l.destaque && { fontWeight: '700' }]}>
            {l.valor}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── TELA 1: Lista de lojas ────────────────────────────────────────────────
export default function DashboardLojasScreen({ navigation }) {
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [naturezaId, setNaturezaId] = useState(null);
  const timer = useRef(null);

  const carregar = useCallback(async (s = false) => {
    if (!s) setCarregando(true);
    try { const d = await buscarDashboardLojas(naturezaId); setLojas(d); } catch (_) {}
    finally { setCarregando(false); setRefreshing(false); }
  }, [naturezaId]);

  useEffect(() => {
    carregar();
    timer.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timer.current);
  }, [carregar]);

  function renderLoja({ item: l }) {
    const cor = corValorUnid(l.acuracidade);
    return (
      <TouchableOpacity style={estilos.lojaCard}
        onPress={() => navigation.navigate('DashboardHistorico', { loja: l })}
        activeOpacity={0.75}>
        <View style={estilos.lojaTopo}>
          <View style={[estilos.lojaBadge, { backgroundColor: SOFT[cor] || colors.backgroundSoft }]}>
            <Text style={[estilos.lojaCodigo, { color: cor }]}>{l.codigo}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={estilos.lojaNome} numberOfLines={1}>{l.nome}</Text>
            <Text style={estilos.lojaMeta}>{l.ultima_sessao_mes || 'Sem sessão'}</Text>
          </View>
          <View style={[estilos.lojaAcurBadge, { backgroundColor: SOFT[cor] || colors.backgroundSoft }]}>
            <Text style={[estilos.lojaAcurTexto, { color: cor }]}>{fmtNum(l.acuracidade, 1)}%</Text>
          </View>
        </View>
        <View style={estilos.barraFundo}>
          <View style={[estilos.barraFill, { width: `${Math.min(l.acuracidade, 100)}%`, backgroundColor: cor }]} />
        </View>
      </TouchableOpacity>
    );
  }

  if (carregando && lojas.length === 0)
    return <SafeAreaView style={estilos.centro}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={estilos.container}>
      <FlatList data={lojas} renderItem={renderLoja} keyExtractor={l => l.loja_id}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <>
            <NaturezaFiltro
              value={naturezaId}
              onChange={id => { setNaturezaId(id); setCarregando(true); }}
            />
            <Text style={estilos.dica}>Toque para ver o consolidado detalhado</Text>
          </>
        }
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); carregar(); }}
          colors={[colors.primary]} tintColor={colors.primary} />}
      />
    </SafeAreaView>
  );
}

// ── TELA 2: Consolidado por loja ──────────────────────────────────────────
export function DashboardHistoricoScreen({ navigation, route }) {
  const { loja } = route.params;
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [meses, setMeses] = useState(6);
  const [sessaoIdx, setSessaoIdx] = useState(null);
  const [naturezaId, setNaturezaId] = useState(null);
  const timer = useRef(null);

  const carregar = useCallback(async (s = false) => {
    if (!s) setCarregando(true);
    try { const d = await buscarDashboardHistorico(loja.loja_id, meses, naturezaId); setHistorico(d); }
    catch (_) {}
    finally { setCarregando(false); }
  }, [loja.loja_id, meses, naturezaId]);

  useEffect(() => {
    setSessaoIdx(null);
    carregar();
    timer.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timer.current);
  }, [carregar]);

  if (carregando && !historico)
    return <SafeAreaView style={estilos.centro}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;

  const hist = historico?.historico || [];
  // Seleciona sessao (padrão: mais recente = ultima do array)
  const idx = sessaoIdx != null ? sessaoIdx : hist.length - 1;
  const sel = hist[idx];

  function buildPaineis(d) {
    if (!d) return null;
    const av = d.apuracao_valor;
    const au = d.apuracao_unidades;
    const ai = d.apuracao_itens;
    if (!av) return null;

    const paineis = [
      {
        titulo: 'APURAÇÃO DE VALOR',
        acur: av.acuracidade,
        corFn: corValorUnid,
        linhas: [
          { label: 'Total de Estoque', valor: fmtR$(av.total_estoque) },
          { label: 'Acerto Positivo (+)', valor: `+ ${fmtR$(av.acerto_positivo)}`, corValor: '#D97706' },
          { label: 'Acerto Negativo (−)', valor: `− ${fmtR$(av.acerto_negativo)}`, corValor: '#DC2626' },
          { label: 'Ajuste Líquido', valor: fmtR$(av.ajuste_liquido),
            corValor: (av.ajuste_liquido || 0) < 0 ? '#DC2626' : '#D97706', destaque: true },
          { label: 'Diferença em %', valor: `${fmtNum(av.diferenca_pct, 2)}%` },
        ],
      },
      {
        titulo: 'APURAÇÃO DE UNIDADES',
        acur: au ? au.acuracidade : 0,
        corFn: corValorUnid,
        linhas: au ? [
          { label: 'Total de Unidades', valor: fmtNum(au.total_sistema, 0) },
          { label: 'Acerto Positivo (+)', valor: `+ ${fmtNum(au.acerto_positivo, 0)}`, corValor: '#D97706' },
          { label: 'Acerto Negativo (−)', valor: `− ${fmtNum(au.acerto_negativo, 0)}`, corValor: '#DC2626' },
          { label: 'Ajuste Líquido', valor: fmtNum(au.ajuste_liquido, 0),
            corValor: (au.ajuste_liquido || 0) < 0 ? '#DC2626' : '#D97706', destaque: true },
          { label: 'Diferença em %', valor: `${fmtNum(au.diferenca_pct, 2)}%` },
        ] : [],
      },
      {
        titulo: 'APURAÇÃO DE ITENS (SKU)',
        acur: ai ? ai.acuracidade : 0,
        corFn: corSku,
        linhas: ai ? [
          { label: 'Total de Itens no Sistema', valor: fmtNum(ai.total, 0) },
          { label: 'Acerto Positivo (+)', valor: `+ ${fmtNum(ai.acerto_positivo, 0)}`, corValor: '#D97706' },
          { label: 'Acerto Negativo (−)', valor: `− ${fmtNum(ai.acerto_negativo, 0)}`, corValor: '#DC2626' },
          { label: 'Diferença de Itens', valor: fmtNum(ai.diferenca_itens, 0),
            corValor: '#DC2626', destaque: true },
          { label: 'Diferença em %', valor: `${fmtNum(ai.diferenca_pct, 2)}%` },
        ] : [],
      },
    ];
    return paineis;
  }

  const paineis = sel ? buildPaineis(sel) : null;

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.lista}
        refreshControl={<RefreshControl refreshing={false} onRefresh={carregar}
          colors={[colors.primary]} tintColor={colors.primary} />}>

        {/* Filtro por natureza */}
        <NaturezaFiltro
          value={naturezaId}
          onChange={id => { setNaturezaId(id); setSessaoIdx(null); setCarregando(true); }}
        />

        {/* Seletor de periodo */}
        <View style={estilos.periodoRow}>
          {[3, 6, 12].map(n => (
            <TouchableOpacity key={n}
              style={[estilos.chipPer, meses === n && estilos.chipPerAtivo]}
              onPress={() => setMeses(n)}>
              <Text style={[estilos.chipPerT, meses === n && estilos.chipPerTAtivo]}>{n}M</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cabecalho da sessao selecionada */}
        {sel && (
          <View style={estilos.sessaoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.sessaoTitulo}>{sel.sessao_nome}</Text>
              <Text style={estilos.sessaoSub}>
                {sel.mes} · {sel.total_auditados} de {sel.total_produtos} produtos auditados
              </Text>
            </View>
          </View>
        )}

        {/* Paineis detalhados */}
        {paineis ? paineis.map((p, i) => (
          <Painel key={i}
            titulo={p.titulo}
            acuracidade={p.acur}
            corFn={p.corFn}
            linhas={p.linhas}
          />
        )) : sel ? (
          /* Fallback quando backend ainda nao retornou novos campos */
          <View style={estilos.painelFallback}>
            <View style={estilos.painelFallbackHeader}>
              <Text style={estilos.painelFallbackTitulo}>RESUMO DO INVENTÁRIO</Text>
            </View>
            {[
              { label: 'Produtos auditados', valor: `${sel.total_auditados} / ${sel.total_produtos}` },
              { label: 'Divergentes', valor: String(sel.total_divergentes), corValor: '#DC2626' },
              { label: 'Valor divergente', valor: fmtMoeda(sel.valor_divergente), corValor: '#DC2626' },
              { label: 'Acuracidade', valor: `${fmtNum(sel.acuracidade, 1)}%`,
                corValor: corValorUnid(sel.acuracidade) },
            ].map((l, i) => (
              <View key={i} style={estilos.painelLinha}>
                <Text style={estilos.painelLabel}>{l.label}</Text>
                <Text style={[estilos.painelValor, l.corValor && { color: l.corValor }]}>{l.valor}</Text>
              </View>
            ))}
            <TouchableOpacity style={estilos.botaoRecarregar} onPress={carregar}>
              <Text style={estilos.botaoRecarregarTexto}>Recarregar dados completos</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Historico de sessoes — clicavel para selecionar */}
        {hist.length > 0 && (
          <>
            <Text style={estilos.histTitulo}>HISTÓRICO DE SESSÕES</Text>
            {[...hist].reverse().map((h, ri) => {
              const origIdx = hist.length - 1 - ri;
              const ativo = origIdx === idx;
              const cor = corValorUnid(h.acuracidade);
              return (
                <TouchableOpacity key={ri}
                  style={[estilos.histRow, ativo && estilos.histRowAtivo]}
                  onPress={() => setSessaoIdx(origIdx)}
                  activeOpacity={0.7}>
                  <View style={[estilos.histMesBadge, { backgroundColor: ativo ? colors.primary : colors.backgroundSoft }]}>
                    <Text style={[estilos.histMes, { color: ativo ? colors.white : colors.textSecondary }]}>
                      {h.mes}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                    <Text style={estilos.histNome} numberOfLines={1}>{h.sessao_nome}</Text>
                    <View style={estilos.barraFundo}>
                      <View style={[estilos.barraFill, {
                        width: `${Math.min(parseFloat(h.acuracidade) || 0, 100)}%`,
                        backgroundColor: cor,
                      }]} />
                    </View>
                  </View>
                  <Text style={[estilos.histAcur, { color: cor }]}>
                    {fmtNum(h.acuracidade, 1)}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {hist.length === 0 && !carregando && (
          <Text style={estilos.semDados}>Nenhuma sessão concluída neste período</Text>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista:     { padding: spacing.md },
  dica:      { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },

  // Cards de loja (tela 1)
  lojaCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
              marginBottom: spacing.sm, borderWidth: 1, borderColor: '#E2E8F0',
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  lojaTopo:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  lojaBadge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  lojaCodigo:{ fontSize: fontSize.sm, fontWeight: '800' },
  lojaNome:  { fontSize: fontSize.md, fontWeight: '600', color: '#0F172A' },
  lojaMeta:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  lojaAcurBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  lojaAcurTexto: { fontSize: fontSize.md, fontWeight: '800' },

  // Painel de acuracidade (tela 2)
  painel: {
    borderRadius: radius.md, marginBottom: spacing.md,
    borderWidth: 2, overflow: 'hidden',
    backgroundColor: colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  painelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  painelHeaderTitulo: { fontSize: fontSize.xs, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },
  painelHeaderAcur:   { fontSize: fontSize.xl, fontWeight: '900', color: '#FFFFFF' },

  painelLinha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  painelLabel: { fontSize: fontSize.sm, color: '#475569', flex: 1 },
  painelValor: { fontSize: fontSize.sm, fontWeight: '600', color: '#0F172A' },

  // Barra de progresso
  barraFundo: { height: 8, width: '100%', backgroundColor: '#F1F5F9' },
  barraFill:  { height: '100%' },

  // Sessao header
  sessaoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md,
                  backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
                  borderWidth: 1, borderColor: '#E2E8F0' },
  sessaoTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: '#0F172A' },
  sessaoSub:    { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Seletor de período
  periodoRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chipPer:       { flex: 1, padding: spacing.sm, borderRadius: radius.sm,
                   borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
                   backgroundColor: colors.white },
  chipPerAtivo:  { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPerT:      { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipPerTAtivo: { color: colors.white },

  // Historico de sessoes
  histTitulo: { fontSize: fontSize.xs, fontWeight: '800', color: colors.textSecondary,
                letterSpacing: 0.8, marginBottom: spacing.sm, marginTop: spacing.md },
  histRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
             borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs,
             borderWidth: 1, borderColor: '#E2E8F0' },
  histRowAtivo: { borderColor: colors.primary, borderWidth: 2 },
  histMesBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4,
                  borderRadius: radius.sm, minWidth: 60, alignItems: 'center' },
  histMes:   { fontSize: fontSize.sm, fontWeight: '700' },
  histNome:  { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  histAcur:  { fontSize: fontSize.sm, fontWeight: '800', minWidth: 52, textAlign: 'right' },

  // Fallback
  painelFallback:       { backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.md,
                          borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  painelFallbackHeader: { backgroundColor: colors.primary, padding: spacing.md },
  painelFallbackTitulo: { fontSize: fontSize.xs, fontWeight: '800', color: colors.white, letterSpacing: 0.8 },
  botaoRecarregar:      { padding: spacing.md, alignItems: 'center' },
  botaoRecarregarTexto: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  semDados:             { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});
