// Dashboard Consolidado Gerencial
// Acesso: ADM e Gestor apenas
// Tabela com scroll horizontal mostrando todas as lojas lado a lado
// Secoes: Apuracao de Valor, Unidades e Itens — igual ao modelo Excel

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import NaturezaFiltro from '../components/NaturezaFiltro';
import { chamarAPI } from '../services/api';

// ── Constantes de layout ────────────────────────────────────────────
const COL_LABEL     = 168;
const COL_CONSOL    = 130;
const COL_LOJA      = 118;
const ROW_H         = 34;
const HEADER_H      = 52;
const SECTION_H     = 28;

// ── Cores ──────────────────────────────────────────────────────────
const COR_NAVY      = '#1E3A5F';
const COR_CONSOL_BG = '#FFFBEB';
const COR_CONSOL_BD = '#F59E0B';
const COR_SECAO_BG  = '#EFF6FF';
const COR_ZEBRA     = '#F8FAFC';
const COR_POS       = '#D97706';
const COR_NEG       = '#DC2626';
const COR_OK        = '#16A34A';

function _corAcur(v) {
  const n = parseFloat(v) || 0;
  if (n >= 99) return COR_OK;
  if (n >= 98) return COR_POS;
  return COR_NEG;
}

// ── Formatadores ───────────────────────────────────────────────────
function fmtM(v) {
  if (v == null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  const abs = Math.abs(n);
  const s = abs.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-R$ ' : 'R$ ') + s;
}
function fmtN(v, dec = 0) {
  if (v == null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  const abs = Math.abs(n).toFixed(dec);
  const parts = abs.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const s = parts.join(',');
  return n < 0 ? '-' + s : s;
}
function fmtP(v) {
  if (v == null) return '—';
  return parseFloat(v).toFixed(2).replace('.', ',') + '%';
}

// ── Definicao das secoes e metricas ────────────────────────────────
const SECOES = [
  {
    titulo: 'Apuração de Valor',
    metricas: [
      { label: 'Total de R$ valor',    campo: 'valor', key: 'total_estoque',   fmt: fmtM, cor: null },
      { label: 'Ajuste positivo (+)',  campo: 'valor', key: 'acerto_positivo', fmt: fmtM, cor: COR_POS },
      { label: 'Ajuste negativo (-)',  campo: 'valor', key: 'acerto_negativo', fmt: v => fmtM(-Math.abs(parseFloat(v||0))), cor: COR_NEG },
      { label: 'Diferença líquida',   campo: 'valor', key: 'ajuste_liquido',  fmt: fmtM, cor: null, destaque: true },
      { label: 'Diferença em %',      campo: 'valor', key: 'diferenca_pct',   fmt: fmtP, cor: null },
      { label: 'Acuracidade:',        campo: 'valor', key: 'acuracidade',     fmt: fmtP, cor: 'acur' },
    ],
  },
  {
    titulo: 'Apuração de Unidades',
    metricas: [
      { label: 'Total de unidades',    campo: 'unidades', key: 'total_sistema',   fmt: v => fmtN(v, 0), cor: null },
      { label: 'Ajuste positivo (+)',  campo: 'unidades', key: 'acerto_positivo', fmt: v => fmtN(v, 0), cor: COR_POS },
      { label: 'Ajuste negativo (-)',  campo: 'unidades', key: 'acerto_negativo', fmt: v => '-' + fmtN(Math.abs(parseFloat(v||0)), 0), cor: COR_NEG },
      { label: 'Diferença líquida',   campo: 'unidades', key: 'ajuste_liquido',  fmt: v => fmtN(v, 0), cor: null, destaque: true },
      { label: 'Diferença em %',      campo: 'unidades', key: 'diferenca_pct',   fmt: fmtP, cor: null },
      { label: 'Acuracidade:',        campo: 'unidades', key: 'acuracidade',     fmt: fmtP, cor: 'acur' },
    ],
  },
  {
    titulo: 'Apuração de Itens',
    metricas: [
      { label: 'Total de Itens inv.',  campo: 'itens', key: 'total',           fmt: fmtN, cor: null },
      { label: 'Ajuste positivo (+)', campo: 'itens', key: 'acerto_positivo', fmt: fmtN, cor: COR_POS },
      { label: 'Ajuste negativo (-)', campo: 'itens', key: 'acerto_negativo', fmt: v => '-' + fmtN(Math.abs(parseFloat(v||0))), cor: COR_NEG },
      { label: 'Diferença de Itens',  campo: 'itens', key: 'diferenca_itens', fmt: fmtN, cor: null, destaque: true },
      { label: 'Diferença em %',      campo: 'itens', key: 'diferenca_pct',   fmt: fmtP, cor: null },
      { label: 'Acuracidade:',        campo: 'itens', key: 'acuracidade',     fmt: fmtP, cor: 'acur' },
    ],
  },
];

// ── Ultimo mes disponivel em formato YYYY-MM ───────────────────────
function _mesesRecentes(n = 12) {
  const arr = [];
  const hoje = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}

// ── Componente de celula ───────────────────────────────────────────
function Cel({ width, valor, cor, bg, bold, height = ROW_H, align = 'right', borderRight = true }) {
  return (
    <View style={[
      est.cel,
      { width, height, backgroundColor: bg || 'transparent' },
      borderRight && { borderRightWidth: 1, borderRightColor: '#E2E8F0' },
    ]}>
      <Text style={[
        est.celTxt,
        { textAlign: align, color: cor || '#0F172A', fontWeight: bold ? '700' : '400' },
      ]} numberOfLines={1}>
        {valor ?? '—'}
      </Text>
    </View>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export default function DashboardConsolidadoScreen({ navigation }) {
  const meses = _mesesRecentes();
  const [mes, setMes] = useState(meses[0]);
  const [naturezaId, setNaturezaId] = useState(null);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const p = new URLSearchParams();
      if (mes) p.append('mes_referencia', mes);
      if (naturezaId) p.append('natureza_filtro_id', naturezaId);
      const d = await chamarAPI(`/api/v1/dashboard/consolidado${p.toString() ? '?' + p : ''}`);
      setDados(d);
    } catch (_) {}
    finally { setCarregando(false); setRefreshing(false); }
  }, [mes, naturezaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const lojas = dados?.lojas || [];
  const consol = dados?.consolidado;
  // Todas as lojas aparecem — sem sessao exibe zeros (nao filtra)
  const lojasColunas = lojas;

  // Retorna o valor do campo, ou 0 quando a loja nao fez inventario
  function getVal(obj, campo, key) {
    const section = obj?.[campo];
    if (!section) return 0;
    return section[key] ?? 0;
  }

  if (carregando) {
    return (
      <SafeAreaView style={est.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={est.carregandoTxt}>Carregando dados...</Text>
      </SafeAreaView>
    );
  }

  const totalWidth = COL_CONSOL + lojasColunas.length * COL_LOJA;

  return (
    <SafeAreaView style={est.container}>
      {/* Filtros */}
      <View style={est.filtrosBox}>
        <NaturezaFiltro
          value={naturezaId}
          onChange={id => { setNaturezaId(id); }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={est.mesesScroll} contentContainerStyle={{ gap: spacing.xs }}>
          {meses.map(m => (
            <TouchableOpacity key={m}
              style={[est.chipMes, mes === m && est.chipMesAtivo]}
              onPress={() => setMes(m)}>
              <Text style={[est.chipMesTxt, mes === m && est.chipMesTxtAtivo]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tabela */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); carregar(true); }}
          colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {/* Cabeçalho da competência */}
        <View style={[est.headerCompetencia, { flexDirection: 'row', alignItems: 'center' }]}>
          <Text style={est.headerEmpresaTxt}>Inventário</Text>
          <Text style={est.headerMesTxt}>  Competência: {mes || '—'}</Text>
        </View>

        <View style={{ flexDirection: 'row' }}>
          {/* ── Coluna fixa de labels ─────────────────────────── */}
          <View style={{ width: COL_LABEL }}>
            {/* Header vazio (alinha com header de lojas) */}
            <View style={[est.headerLojaBox, { width: COL_LABEL, backgroundColor: COR_NAVY, height: HEADER_H }]} />

            {SECOES.map((secao, si) => (
              <View key={si}>
                {/* Titulo da secao */}
                <View style={[est.secaoTituloBox, { width: COL_LABEL, height: SECTION_H }]}>
                  <Text style={est.secaoTituloTxt}>{secao.titulo}</Text>
                </View>
                {/* Labels de cada metrica */}
                {secao.metricas.map((m, mi) => (
                  <View key={mi} style={[
                    est.labelBox,
                    { width: COL_LABEL, height: ROW_H },
                    (si + mi) % 2 === 0 && { backgroundColor: COR_ZEBRA },
                    m.destaque && { backgroundColor: '#F0FDF4' },
                  ]}>
                    <Text style={[est.labelTxt, m.destaque && { fontWeight: '700' }]} numberOfLines={1}>
                      {m.label}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* ── Área horizontal rolável ────────────────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ width: totalWidth }}>
              {/* ── Header com nomes das lojas ─────────────────── */}
              <View style={{ flexDirection: 'row', height: HEADER_H }}>
                {/* Consolidado */}
                <View style={[est.headerLojaBox, {
                  width: COL_CONSOL, backgroundColor: '#92400E', height: HEADER_H,
                  borderRightWidth: 2, borderRightColor: '#D97706',
                }]}>
                  <Text style={[est.headerLojaTxt, { color: '#FEF3C7' }]}>Consolidado</Text>
                  <Text style={[est.headerLojaSubTxt, { color: '#FDE68A' }]}>Todas as lojas</Text>
                </View>
                {/* Todas as lojas — com ou sem sessao */}
                {lojasColunas.map((loja, li) => {
                  const temDados = !!loja.sessao_nome;
                  return (
                    <View key={loja.loja_id} style={[est.headerLojaBox, {
                      width: COL_LOJA, height: HEADER_H,
                      backgroundColor: !temDados
                        ? '#334155'  // cinza escuro para sem dados
                        : li % 2 === 0 ? COR_NAVY : '#263D5A',
                      opacity: temDados ? 1 : 0.7,
                    }]}>
                      <Text style={est.headerLojaTxt}>{loja.codigo}</Text>
                      <Text style={est.headerLojaSubTxt} numberOfLines={1}>
                        {loja.nome.split(' - ')[1] || loja.nome}
                      </Text>
                      {!temDados && (
                        <Text style={[est.headerLojaSubTxt, { color: '#94A3B8', fontSize: 8 }]}>
                          sem dados
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* ── Dados por seção ────────────────────────────── */}
              {SECOES.map((secao, si) => (
                <View key={si}>
                  {/* Titulo da secao (span) */}
                  <View style={[est.secaoTituloBox, { width: totalWidth, height: SECTION_H }]}>
                    <Text style={est.secaoTituloTxt}>{secao.titulo}</Text>
                  </View>

                  {/* Linhas de dados */}
                  {secao.metricas.map((metrica, mi) => {
                    const zebra = (si + mi) % 2 === 0 ? COR_ZEBRA : '#FFFFFF';
                    const bgRow = metrica.destaque ? '#F0FDF4' : zebra;
                    return (
                      <View key={mi} style={{ flexDirection: 'row', height: ROW_H }}>
                        {/* Coluna consolidado */}
                        {(() => {
                          const v = getVal(consol, metrica.campo, metrica.key);
                          const txt = v != null ? metrica.fmt(v) : '—';
                          const cor = metrica.cor === 'acur'
                            ? _corAcur(v)
                            : metrica.cor || '#92400E';
                          return (
                            <Cel
                              width={COL_CONSOL}
                              valor={txt}
                              cor={cor}
                              bg={COR_CONSOL_BG}
                              bold={metrica.destaque}
                              height={ROW_H}
                              borderRight={false}
                            />
                          );
                        })()}
                        {/* Colunas por loja */}
                        {lojasColunas.map(loja => {
                          const temDados = !!loja.sessao_nome;
                          const v = getVal(loja, metrica.campo, metrica.key);
                          const txt = metrica.fmt(v);
                          const cor = !temDados
                            ? '#94A3B8'                          // cinza para sem dados
                            : metrica.cor === 'acur'
                              ? _corAcur(v)
                              : metrica.cor;
                          const bg = !temDados ? '#F8FAFC' : bgRow;
                          return (
                            <Cel
                              key={loja.loja_id}
                              width={COL_LOJA}
                              valor={txt}
                              cor={cor}
                              bg={bg}
                              bold={metrica.destaque && temDados}
                              height={ROW_H}
                            />
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Legenda: lojas cinzas = sem inventario neste periodo */}
              {lojas.some(l => !l.sessao_nome) && (
                <View style={est.semSessaoBox}>
                  <Text style={est.semSessaoTxt}>
                    Colunas em cinza = sem inventario concluido no periodo selecionado
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const est = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F1F5F9' },
  centro:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  carregandoTxt: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },

  filtrosBox: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: spacing.xs,
  },
  mesesScroll: { paddingHorizontal: spacing.md, marginTop: spacing.xs },
  chipMes: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipMesAtivo:    { backgroundColor: colors.primary, borderColor: colors.primary },
  chipMesTxt:      { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  chipMesTxtAtivo: { color: '#FFFFFF' },

  // Header topo
  headerCompetencia: {
    backgroundColor: COR_NAVY,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerEmpresaTxt: { fontSize: fontSize.md, fontWeight: '800', color: '#FFFFFF' },
  headerMesTxt:     { fontSize: fontSize.sm, color: '#93C5FD' },

  // Header de loja (coluna)
  headerLojaBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)',
  },
  headerLojaTxt:    { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  headerLojaSubTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 9, textAlign: 'center', marginTop: 2 },

  // Titulo de secao
  secaoTituloBox: {
    backgroundColor: COR_SECAO_BG,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
    borderBottomWidth: 1, borderBottomColor: '#BFDBFE',
  },
  secaoTituloTxt: {
    fontSize: 11, fontWeight: '800', color: '#1E40AF',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Label fixo
  labelBox: {
    justifyContent: 'center', paddingLeft: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  labelTxt: { fontSize: 11, color: '#334155' },

  // Celula de dado
  cel: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  celTxt: { fontSize: 11 },

  // Sem sessao
  semSessaoBox: {
    padding: spacing.md,
    backgroundColor: '#FEF3C7',
    borderTopWidth: 1, borderTopColor: '#FDE68A',
  },
  semSessaoTxt: { fontSize: 11, color: '#92400E' },
});
