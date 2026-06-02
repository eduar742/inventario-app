// Tela de historico de contagens de uma sessao.
// Mostra todos os produtos contados agrupados com suas 1a/2a/3a contagem.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native';

import { avisar, confirmar } from '../utils/alertas';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarContagensDaSessao } from '../services/api';


export default function HistoricoContagensScreen({ navigation, route }) {
  const { sessao } = route.params;

  const [contagens, setContagens] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      const dados = await listarContagensDaSessao(sessao.id);
      setContagens(dados);
      agrupar(dados, '');
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel carregar o historico');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  function agrupar(dados, filtro) {
    // Agrupa por produto_id, ordenando por sku
    const mapa = {};
    for (const c of dados) {
      const chave = c.produto_id || c.sku;
      if (!mapa[chave]) {
        mapa[chave] = {
          produto_id: c.produto_id,
          sku: c.sku,
          descricao: c.descricao_produto || c.sku,
          contagens: [],
        };
      }
      mapa[chave].contagens.push(c);
    }

    let lista = Object.values(mapa).sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));

    if (filtro.trim()) {
      const f = filtro.toLowerCase();
      lista = lista.filter(g =>
        g.sku?.toLowerCase().includes(f) ||
        g.descricao?.toLowerCase().includes(f)
      );
    }

    setGrupos(lista);
  }

  function handleBusca(texto) {
    setBusca(texto);
    agrupar(contagens, texto);
  }

  function _fmtNum(v) {
    if (v == null) return '—';
    return parseFloat(v).toFixed(3).replace(/\.?0+$/, '');
  }

  function _fmtDt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function corContagem(n) {
    return n === 1 ? colors.info : n === 2 ? colors.warning : colors.danger;
  }

  function renderGrupo({ item: grupo }) {
    const ordenadas = [...grupo.contagens].sort((a, b) => a.numero_contagem - b.numero_contagem);
    const ultima = ordenadas[ordenadas.length - 1];
    const qtdFinal = ultima?.quantidade_contada;

    return (
      <View style={estilos.card}>
        {/* Produto */}
        <View style={estilos.cardTopo}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.descricao} numberOfLines={2}>{grupo.descricao}</Text>
            <Text style={estilos.sku}>{grupo.sku}</Text>
          </View>
          <View style={estilos.badgeContagens}>
            <Text style={estilos.badgeContagensTexto}>{ordenadas.length}x</Text>
          </View>
        </View>

        {/* Linha de cada contagem */}
        {ordenadas.map(c => (
          <View key={c.id} style={estilos.linhaContagem}>
            <View style={[estilos.numeroBadge, { backgroundColor: corContagem(c.numero_contagem) + '22' }]}>
              <Text style={[estilos.numeroBadgeTexto, { color: corContagem(c.numero_contagem) }]}>
                {c.numero_contagem}ª
              </Text>
            </View>
            <Text style={estilos.contagemQtd}>{_fmtNum(c.quantidade_contada)}</Text>
            <Text style={estilos.contagemOperador} numberOfLines={1}>
              {c.nome_usuario || ''}
            </Text>
            <Text style={estilos.contagemData}>{_fmtDt(c.contado_em)}</Text>
          </View>
        ))}

        {/* Valor final destacado */}
        {qtdFinal != null && (
          <View style={estilos.linhaFinal}>
            <Text style={estilos.linhaFinalLabel}>Valor final:</Text>
            <Text style={estilos.linhaFinalValor}>{_fmtNum(qtdFinal)}</Text>
          </View>
        )}
      </View>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando contagens...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      {/* Barra de busca */}
      <View style={estilos.barraBusca}>
        <TextInput
          style={estilos.inputBusca}
          value={busca}
          onChangeText={handleBusca}
          placeholder="Buscar por SKU ou descricao..."
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Text style={estilos.totalBusca}>{grupos.length} produto(s)</Text>
      </View>

      <FlatList
        data={grupos}
        renderItem={renderGrupo}
        keyExtractor={item => item.produto_id || item.sku}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>
              {busca ? 'Nenhum produto encontrado para a busca' : 'Nenhuma contagem nesta sessao'}
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
  container:       { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  barraBusca: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderBottomWidth: 1,
    borderBottomColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inputBusca: {
    flex: 1, backgroundColor: colors.backgroundSoft, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: fontSize.sm, color: colors.text,
  },
  totalBusca: { fontSize: fontSize.xs, color: colors.textMuted, minWidth: 70, textAlign: 'right' },
  lista: { padding: spacing.md },
  card: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTopo:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  descricao:    { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sku:          { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  badgeContagens: {
    backgroundColor: colors.primarySoft, paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: radius.sm, marginLeft: spacing.sm,
  },
  badgeContagensTexto: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  // Linha de contagem individual
  linhaContagem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  numeroBadge: {
    width: 32, height: 24, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  numeroBadgeTexto: { fontSize: fontSize.xs, fontWeight: '700' },
  contagemQtd:      { fontSize: fontSize.md, fontWeight: '700', color: colors.text,
                      minWidth: 60, marginRight: spacing.sm },
  contagemOperador: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary },
  contagemData:     { fontSize: fontSize.xs, color: colors.textMuted },
  // Valor final
  linhaFinal: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: spacing.xs, gap: spacing.sm,
  },
  linhaFinalLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  linhaFinalValor: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  vazio:    { alignItems: 'center', padding: spacing.xl },
  vazioTexto: { fontSize: fontSize.md, color: colors.textMuted },
});
