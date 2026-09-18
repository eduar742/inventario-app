// Painel de acompanhamento ao vivo de uma sessao de inventario.
// Usado pelo ADM/gestor para ver o progresso e as contagens chegando em tempo real,
// sem precisar entrar na tela de contagem do operador.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarSessao, listarContagensDaSessao } from '../services/api';
import { avisar } from '../utils/alertas';
import { formatarDataHora, formatarHora } from '../utils/formatadores';

const INTERVALO = 15000;
const FEED_TAMANHO = 100;

const ROTULO_RODADA = {
  1: '1ª contagem em andamento',
  2: '2ª contagem em andamento',
  3: '3ª contagem em andamento (desempate)',
};

export default function AcompanhamentoSessaoScreen({ route }) {
  const { sessao: sessaoInicial, loja } = route.params;

  const [sessaoInfo, setSessaoInfo] = useState(sessaoInicial);
  const [feed, setFeed] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAtu, setUltimaAtu] = useState(null);
  const [busca, setBusca] = useState('');
  const timerRef = useRef(null);

  const emAndamento = sessaoInfo?.status === 'em_andamento';

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const [sessaoAtualizada, contagens] = await Promise.all([
        buscarSessao(sessaoInicial.id),
        listarContagensDaSessao(sessaoInicial.id, 1, FEED_TAMANHO),
      ]);
      setSessaoInfo(sessaoAtualizada);
      setFeed(contagens.items || []);
      setUltimaAtu(new Date());
    } catch (err) {
      if (!silencioso) avisar('Erro', err.message || 'Nao foi possivel carregar o acompanhamento');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [sessaoInicial.id]);

  // Busca inicial
  useEffect(() => {
    carregar();
  }, [carregar]);

  // Polling automatico enquanto a sessao estiver em andamento
  useEffect(() => {
    if (!emAndamento) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [emAndamento, carregar]);

  function corContagem(n) {
    return n === 1 ? colors.info : n === 2 ? colors.warning : colors.danger;
  }

  function _fmtNum(v) {
    if (v == null) return '—';
    return parseFloat(v).toFixed(3).replace(/\.?0+$/, '');
  }

  const termoBusca = busca.trim().toLowerCase();
  const feedFiltrado = termoBusca
    ? feed.filter(c =>
        c.sku?.toLowerCase().includes(termoBusca) ||
        c.descricao_produto?.toLowerCase().includes(termoBusca)
      )
    : feed;

  // Progresso da RODADA ATUAL (1a, 2a ou 3a) — nao do inventario inteiro
  // somando as 3 rodadas, senao a barra fica presa perto de 100% (ou passa
  // disso, com item avulso) assim que a 1a contagem termina, mesmo com a 2a/
  // 3a ainda pendentes. Ver backend: _progresso_por_rodada em sessoes.py.
  const rodadaAtual = sessaoInfo?.rodada_atual || 1;
  const total = sessaoInfo?.total_produtos_rodada_atual || 0;
  const contados = sessaoInfo?.total_produtos_contados_rodada_atual || 0;
  const faltam = Math.max(total - contados, 0);
  const percentual = sessaoInfo?.percentual_progresso_rodada_atual || 0;

  function renderItem({ item }) {
    // Rodada REAL da bipagem (1a/2a/3a contagem oficial) — nao numero_contagem,
    // que so conta quantas vezes aquele SKU foi bipado nesta sessao (inclui
    // bipagens de multi-localizacao na MESMA rodada, entao podia passar de 3
    // e confundir com uma "4a contagem" que nao existe no sistema).
    const rodadaBipagem = item.rodada || 1;
    return (
      <View style={estilos.linhaFeed}>
        <View style={[estilos.numeroBadge, { backgroundColor: corContagem(rodadaBipagem) + '22' }]}>
          <Text style={[estilos.numeroBadgeTexto, { color: corContagem(rodadaBipagem) }]}>
            {rodadaBipagem}ª
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={estilos.feedDescricao} numberOfLines={1}>{item.descricao_produto || item.sku}</Text>
          <Text style={estilos.feedMeta} numberOfLines={1}>
            {item.sku} · {item.nome_usuario || 'operador'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={estilos.feedQtd}>{_fmtNum(item.quantidade_contada)}</Text>
          <Text style={estilos.feedHora}>{formatarDataHora(item.contado_em)}</Text>
        </View>
      </View>
    );
  }

  if (carregando && !feed.length) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando acompanhamento...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <View style={estilos.cabecalho}>
        <View style={estilos.cabecalhoTopo}>
          <Text style={estilos.nomeSessao} numberOfLines={1}>{sessaoInfo?.nome}</Text>
          {emAndamento ? (
            <View style={estilos.liveRow}>
              <View style={estilos.liveDot} />
              <Text style={estilos.liveTxt}>
                Ao vivo{ultimaAtu ? ` · ${formatarHora(ultimaAtu.toISOString())}` : ''}
              </Text>
            </View>
          ) : (
            <Text style={estilos.encerradaTxt}>Sessao nao esta mais em andamento</Text>
          )}
        </View>
        <Text style={estilos.subLoja}>{loja?.nome}</Text>

        {emAndamento && (
          <View style={[estilos.rodadaBadge, rodadaAtual === 3 && estilos.rodadaBadgeDesempate]}>
            <Text style={[estilos.rodadaBadgeTxt, rodadaAtual === 3 && estilos.rodadaBadgeTxtDesempate]}>
              {ROTULO_RODADA[rodadaAtual] || `${rodadaAtual}ª contagem em andamento`}
            </Text>
          </View>
        )}

        <View style={estilos.barraProgressoContainer}>
          <View style={estilos.barraProgressoFundo}>
            <View style={[estilos.barraProgressoFill, { width: `${percentual}%` }]} />
          </View>
          <Text style={estilos.progressoTexto}>{percentual}%</Text>
        </View>

        <View style={estilos.rodape}>
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>{total}</Text>
            <Text style={estilos.statLabel}>Total</Text>
          </View>
          <View style={estilos.statDivisor} />
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>{contados}</Text>
            <Text style={estilos.statLabel}>Contados</Text>
          </View>
          <View style={estilos.statDivisor} />
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>{faltam}</Text>
            <Text style={estilos.statLabel}>Faltam</Text>
          </View>
          <View style={estilos.statDivisor} />
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>{sessaoInfo?.total_contagens || 0}</Text>
            <Text style={estilos.statLabel}>Bipagens</Text>
          </View>
        </View>
      </View>

      <View style={estilos.barraBusca}>
        <TextInput
          style={estilos.inputBusca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por SKU ou descricao..."
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={feedFiltrado}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <Text style={estilos.feedTitulo}>
            Ultimas contagens{feed.length >= FEED_TAMANHO ? ` (mostrando as ${FEED_TAMANHO} mais recentes)` : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>
              {busca ? 'Nenhuma contagem encontrada para a busca' : 'Nenhuma contagem registrada ainda'}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); carregar(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  cabecalho: {
    backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cabecalhoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nomeSessao: { flex: 1, fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginRight: spacing.sm },
  subLoja: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  rodadaBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.infoSoft,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  rodadaBadgeTxt: { fontSize: fontSize.xs, fontWeight: '700', color: colors.info },
  rodadaBadgeDesempate: { backgroundColor: colors.warningSoft },
  rodadaBadgeTxtDesempate: { color: colors.warning },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentGreen },
  liveTxt: { fontSize: fontSize.xs, color: colors.accentGreen, fontWeight: '600' },
  encerradaTxt: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  barraProgressoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  barraProgressoFundo: {
    flex: 1, height: 6, backgroundColor: colors.border, borderRadius: radius.full,
    overflow: 'hidden', marginRight: spacing.sm,
  },
  barraProgressoFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  progressoTexto: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary, minWidth: 40, textAlign: 'right' },
  rodape: { flexDirection: 'row', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statDivisor: { width: 1, backgroundColor: colors.border },
  statValor: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  barraBusca: {
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inputBusca: {
    backgroundColor: colors.backgroundSoft, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: fontSize.sm, color: colors.text,
  },
  lista: { padding: spacing.md },
  feedTitulo: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  linhaFeed: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  numeroBadge: {
    width: 32, height: 24, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  numeroBadgeTexto: { fontSize: fontSize.xs, fontWeight: '700' },
  feedDescricao: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  feedMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  feedQtd: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  feedHora: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  vazio: { alignItems: 'center', padding: spacing.xl },
  vazioTexto: { fontSize: fontSize.md, color: colors.textMuted },
});
