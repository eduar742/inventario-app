// Tela de revisao de contagens pelo ADM antes da aprovacao do gestor.
// Permite ajustar quantidades de itens contados (inclusive fora da relacao importada).
// Icone "?" no cabecalho exibe historico de todos os ajustes feitos na sessao.

import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { avisar } from '../utils/alertas';
import Button from '../components/Button';
import {
  listarContagensDaSessao,
  ajustarContagem,
  listarAjustesSessao,
} from '../services/api';

function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function RevisaoContagensScreen({ navigation, route }) {
  const { sessao, loja } = route.params;

  const [contagens, setContagens] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de edicao
  const [modalEdicao, setModalEdicao] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [novaQtd, setNovaQtd] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Modal de historico de ajustes ("?")
  const [modalHistorico, setModalHistorico] = useState(false);

  // Registra o icone "?" no header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => { carregarAjustes(); setModalHistorico(true); }}
          style={{ marginRight: 4, padding: 8 }}
        >
          <View style={estilos.iconInterrogacao}>
            <Text style={estilos.iconInterrogacaoTxt}>?</Text>
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    carregarTudo();
  }, []);

  async function carregarTudo() {
    try {
      const [resp, aj] = await Promise.all([
        listarContagensDaSessao(sessao.id, 1, 500),
        listarAjustesSessao(sessao.id),
      ]);
      const items = resp.items || (Array.isArray(resp) ? resp : []);
      setContagens(agruparPorProduto(items));
      setAjustes(Array.isArray(aj) ? aj : []);
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel carregar as contagens');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  async function carregarAjustes() {
    try {
      const aj = await listarAjustesSessao(sessao.id);
      setAjustes(Array.isArray(aj) ? aj : []);
    } catch (_) {}
  }

  // Agrupa contagens pelo produto (sku), retorna array de grupos
  function agruparPorProduto(lista) {
    const mapa = {};
    for (const c of lista) {
      const chave = c.sku || c.produto_id;
      if (!mapa[chave]) {
        mapa[chave] = {
          sku: c.sku,
          descricao: c.descricao_produto,
          produto_id: c.produto_id,
          contagens: [],
        };
      }
      mapa[chave].contagens.push(c);
    }
    return Object.values(mapa).sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
  }

  function abrirEdicao(contagem) {
    setItemEditando(contagem);
    setNovaQtd(String(contagem.quantidade_contada));
    setJustificativa('');
    setModalEdicao(true);
  }

  async function handleSalvarAjuste() {
    const qtd = parseFloat(novaQtd.replace(',', '.'));
    if (isNaN(qtd) || qtd < 0) {
      avisar('Valor invalido', 'Digite uma quantidade valida (ex: 10 ou 2,5)');
      return;
    }
    if (!justificativa.trim()) {
      avisar('Justificativa obrigatoria', 'Informe o motivo do ajuste para registro de auditoria.');
      return;
    }
    setSalvando(true);
    try {
      await ajustarContagem(itemEditando.id, {
        quantidade: qtd,
        justificativa: justificativa.trim(),
      });
      setModalEdicao(false);
      await carregarTudo();
    } catch (err) {
      avisar('Erro ao salvar', err.message || 'Nao foi possivel salvar o ajuste');
    } finally {
      setSalvando(false);
    }
  }

  function renderGrupoProduto({ item: grupo }) {
    return (
      <View style={estilos.cardProduto}>
        <View style={estilos.produtoHeader}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.produtoSku}>{grupo.sku || 'SKU desconhecido'}</Text>
            <Text style={estilos.produtoDesc} numberOfLines={2}>
              {grupo.descricao || 'Produto sem descricao'}
            </Text>
          </View>
          <View style={estilos.totalChip}>
            <Text style={estilos.totalChipTxt}>
              {grupo.contagens.reduce((s, c) => s + parseFloat(c.quantidade_contada || 0), 0)} un
            </Text>
          </View>
        </View>

        {grupo.contagens.map(c => {
          const foiAjustado = c.quantidade_original != null;
          return (
            <TouchableOpacity
              key={c.id}
              style={[estilos.linhaContagem, foiAjustado && estilos.linhaContagemAjustada]}
              onPress={() => abrirEdicao(c)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={estilos.linhaCont}>
                  {c.numero_contagem}ª contagem · {c.nome_usuario || 'operador'}
                </Text>
                <Text style={estilos.linhaData}>{formatarData(c.contado_em)}</Text>
                {c.localizacao ? (
                  <Text style={estilos.linhaLoc}>📍 {c.localizacao}</Text>
                ) : null}
                {foiAjustado && (
                  <Text style={estilos.linhaAjuste}>
                    Ajustado: {c.quantidade_original} → {c.quantidade_contada}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={estilos.linhaQtd}>{c.quantidade_contada}</Text>
                <Text style={estilos.editarDica}>Editar ›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <FlatList
        data={contagens}
        renderItem={renderGrupoProduto}
        keyExtractor={g => g.produto_id || g.sku}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregarTudo(); }} colors={[colors.primary]} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={estilos.cabecalho}>
            <Text style={estilos.cabecalhoTitulo}>{sessao.nome}</Text>
            <Text style={estilos.cabecalhoSub}>
              {contagens.length} produto(s) contados · Toque em uma contagem para ajustar
            </Text>
            {ajustes.length > 0 && (
              <View style={estilos.badgeAjustes}>
                <Text style={estilos.badgeAjustesTxt}>
                  {ajustes.length} ajuste(s) realizado(s) · Toque em "?" para ver o historico
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTxt}>Nenhuma contagem registrada nesta sessao.</Text>
          </View>
        }
      />

      {/* ── Modal de edicao de contagem ─────────────────────────── */}
      <Modal visible={modalEdicao} animationType="slide" transparent onRequestClose={() => !salvando && setModalEdicao(false)}>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContainer}>
            <Text style={estilos.modalTitulo}>Ajustar contagem</Text>

            {itemEditando && (
              <>
                <Text style={estilos.modalProduto}>
                  {itemEditando.sku} · {itemEditando.descricao_produto}
                </Text>
                <Text style={estilos.modalInfo}>
                  {itemEditando.numero_contagem}ª contagem · Operador: {itemEditando.nome_usuario || '—'}
                </Text>
                {itemEditando.quantidade_original != null && (
                  <Text style={estilos.modalOriginal}>
                    Valor original: {itemEditando.quantidade_original}
                  </Text>
                )}

                <Text style={estilos.rotulo}>Nova quantidade *</Text>
                <TextInput
                  style={estilos.input}
                  value={novaQtd}
                  onChangeText={setNovaQtd}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 25"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />

                <Text style={estilos.rotulo}>Justificativa *</Text>
                <TextInput
                  style={[estilos.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={justificativa}
                  onChangeText={setJustificativa}
                  multiline
                  placeholder="Ex: produto contado em local errado, corrigido pelo ADM"
                  placeholderTextColor={colors.textMuted}
                  maxLength={300}
                />
              </>
            )}

            <View style={{ height: spacing.md }} />
            <Button titulo="Salvar ajuste" onPress={handleSalvarAjuste} carregando={salvando} desabilitado={salvando} />
            <View style={{ height: spacing.xs }} />
            <Button titulo="Cancelar" variante="secondary" onPress={() => setModalEdicao(false)} desabilitado={salvando} />
          </View>
        </View>
      </Modal>

      {/* ── Modal de historico de ajustes ("?") ─────────────────── */}
      <Modal visible={modalHistorico} animationType="slide" transparent onRequestClose={() => setModalHistorico(false)}>
        <View style={estilos.modalOverlay}>
          <View style={[estilos.modalContainer, { maxHeight: '85%' }]}>
            <Text style={estilos.modalTitulo}>Historico de ajustes</Text>
            <Text style={estilos.modalInfo}>{sessao.nome}</Text>

            <ScrollView style={{ marginTop: spacing.md }} showsVerticalScrollIndicator>
              {ajustes.length === 0 ? (
                <Text style={estilos.semAjustes}>Nenhum ajuste realizado nesta sessao.</Text>
              ) : (
                ajustes.map((a, i) => (
                  <View key={a.contagem_id} style={[estilos.ajusteItem, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={estilos.ajusteTopo}>
                      <Text style={estilos.ajusteSku}>{a.sku}</Text>
                      <View style={[estilos.diffChip, { backgroundColor: a.diferenca > 0 ? colors.successSoft : colors.dangerSoft }]}>
                        <Text style={[estilos.diffChipTxt, { color: a.diferenca > 0 ? colors.success : colors.danger }]}>
                          {a.diferenca > 0 ? '+' : ''}{a.diferenca.toFixed(0)}
                        </Text>
                      </View>
                    </View>
                    <Text style={estilos.ajusteDesc} numberOfLines={1}>{a.descricao}</Text>
                    <Text style={estilos.ajusteMudanca}>
                      {a.numero_contagem}ª contagem: {a.quantidade_original} → {a.quantidade_ajustada}
                    </Text>
                    {a.justificativa ? (
                      <Text style={estilos.ajusteJustificativa}>"{a.justificativa}"</Text>
                    ) : null}
                    <Text style={estilos.ajusteMeta}>
                      Por {a.ajustado_por || '—'} · {formatarData(a.ajustado_em)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ height: spacing.md }} />
            <Button titulo="Fechar" variante="secondary" onPress={() => setModalHistorico(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista:     { padding: spacing.md, paddingBottom: spacing.xl },

  // Icone "?" no header
  iconInterrogacao: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconInterrogacaoTxt: { color: colors.white, fontWeight: '800', fontSize: 15 },

  // Cabecalho da lista
  cabecalho: { marginBottom: spacing.md },
  cabecalhoTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: 2 },
  cabecalhoSub: { fontSize: fontSize.sm, color: colors.textSecondary },
  badgeAjustes: {
    backgroundColor: colors.warningSoft, borderRadius: radius.sm,
    padding: spacing.sm, marginTop: spacing.sm,
    borderLeftWidth: 3, borderLeftColor: colors.warning,
  },
  badgeAjustesTxt: { fontSize: fontSize.xs, color: colors.warning, fontWeight: '600' },

  // Card de produto
  cardProduto: {
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm, overflow: 'hidden',
  },
  produtoHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  produtoSku: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  produtoDesc: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginTop: 2 },
  totalChip: {
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  totalChipTxt: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },

  // Linha de contagem
  linhaContagem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  linhaContagemAjustada: { backgroundColor: '#FFFBEB' },
  linhaCont: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  linhaData: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  linhaLoc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  linhaAjuste: { fontSize: fontSize.xs, color: colors.warning, fontWeight: '600', marginTop: 2 },
  linhaQtd: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  editarDica: { fontSize: 10, color: colors.primary, fontWeight: '600' },

  // Lista vazia
  vazio: { alignItems: 'center', padding: spacing.xl },
  vazioTxt: { fontSize: fontSize.md, color: colors.textMuted },

  // Modal compartilhado
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg },
  modalTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalProduto: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary, marginBottom: 2 },
  modalInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  modalOriginal: { fontSize: fontSize.xs, color: colors.warning, fontWeight: '600', marginBottom: spacing.sm },
  rotulo: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text },

  // Modal historico
  semAjustes: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  ajusteItem: { paddingVertical: spacing.md },
  ajusteTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  ajusteSku: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  diffChip: { borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  diffChipTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  ajusteDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  ajusteMudanca: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  ajusteJustificativa: { fontSize: fontSize.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  ajusteMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
});
