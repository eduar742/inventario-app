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
import { formatarDataHora } from '../utils/formatadores';
import { rodadaDaContagem, valorFinalContagens, desempatePelaRegraDoSistema } from '../utils/contagens';
import {
  listarContagensDaSessao,
  ajustarContagem,
  listarAjustesSessao,
  listarAvulsosSessao,
  vincularAvulso,
} from '../services/api';


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

  // Itens avulsos: codigo bipado que nao bateu com nenhum produto cadastrado.
  // O ADM vincula ao produto real e as contagens sao transferidas (sem recontar).
  const [avulsos, setAvulsos] = useState([]);
  const [avulsoVinculando, setAvulsoVinculando] = useState(null);
  const [skuDestino, setSkuDestino] = useState('');
  const [vinculando, setVinculando] = useState(false);

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
      // Carrega contagens (obrigatorio) e ajustes (opcional, nao bloqueia a tela)
      const resp = await listarContagensDaSessao(sessao.id, 1, 500);
      const items = resp?.items || (Array.isArray(resp) ? resp : []);
      setContagens(agruparPorProduto(items));
    } catch (err) {
      avisar('Erro ao carregar contagens', err.message || 'Nao foi possivel carregar as contagens');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
    // Ajustes: carrega em paralelo sem bloquear
    listarAjustesSessao(sessao.id)
      .then(aj => setAjustes(Array.isArray(aj) ? aj : []))
      .catch(() => {}); // silencioso — historico de ajustes e opcional
    listarAvulsosSessao(sessao.id)
      .then(av => setAvulsos(Array.isArray(av) ? av : []))
      .catch(() => {}); // silencioso — so ADM tem acesso
  }

  function abrirVinculo(avulso) {
    setAvulsoVinculando(avulso);
    setSkuDestino(avulso.sugestoes?.length === 1 ? avulso.sugestoes[0].sku : '');
  }

  async function handleVincular() {
    if (!skuDestino.trim()) {
      avisar('Informe o SKU', 'Digite o SKU do produto cadastrado que corresponde a este item.');
      return;
    }
    setVinculando(true);
    try {
      const r = await vincularAvulso(sessao.id, avulsoVinculando.produto_id, skuDestino.trim());
      setAvulsoVinculando(null);
      avisar(
        'Item vinculado',
        `${r.contagens_movidas} contagem(ns) transferida(s) para ${r.produto_destino.sku} — ${r.produto_destino.descricao}.`
      );
      await carregarTudo();
    } catch (err) {
      avisar('Nao foi possivel vincular', err.message || 'Tente novamente.');
    } finally {
      setVinculando(false);
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
      const r = await ajustarContagem(itemEditando.id, {
        quantidade: qtd,
        justificativa: justificativa.trim(),
      });
      setModalEdicao(false);
      // Sessao aguardando aprovacao: a API ja recalculou a divergencia do item
      const MSG_DIVERGENCIA = {
        atualizada: 'A divergencia deste item foi recalculada com a nova quantidade.',
        criada: 'Com a nova quantidade o item passou a divergir: uma divergencia foi criada para aprovacao.',
        removida: 'Com a nova quantidade o item bate com o sistema: a divergencia foi removida.',
      };
      if (r?.divergencia_recalculada && MSG_DIVERGENCIA[r.divergencia_recalculada]) {
        avisar('Contagem ajustada', MSG_DIVERGENCIA[r.divergencia_recalculada]);
      }
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
          {/* Valor final pela regra das 3 contagens — somar todas as rodadas
              juntas (1a + 2a + 3a) daria um total sem sentido */}
          <View style={estilos.totalChip}>
            <Text style={estilos.totalChipTxt}>
              {valorFinalContagens(grupo.contagens)
                ?? (desempatePelaRegraDoSistema(grupo.contagens) ? 'mais prox. do sistema' : 'aguard. desempate')}
              {valorFinalContagens(grupo.contagens) != null ? ' un' : ''}
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
                  {rodadaDaContagem(c)}ª contagem · {c.nome_usuario || 'operador'}
                </Text>
                <Text style={estilos.linhaData}>{formatarDataHora(c.contado_em)}</Text>
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
            {avulsos.length > 0 && (
              <View style={estilos.avulsosBox}>
                <Text style={estilos.avulsosTitulo}>⚠️ Itens avulsos ({avulsos.length})</Text>
                <Text style={estilos.avulsosTexto}>
                  Codigos bipados que nao bateram com nenhum produto cadastrado. Enquanto nao forem
                  vinculados, o produto real fica como "nao bipado" e a divergencia sai duplicada.
                </Text>
                {avulsos.map(a => (
                  <View key={a.produto_id} style={estilos.avulsoLinha}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={estilos.avulsoCodigo} numberOfLines={1}>{a.codigo}</Text>
                      <Text style={estilos.avulsoInfo}>
                        {a.bipagens} bipagem(ns) · {a.quantidade_total} un
                        {a.sugestoes?.length ? ` · sugestao: ${a.sugestoes[0].sku}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity style={estilos.avulsoBotao} onPress={() => abrirVinculo(a)}>
                      <Text style={estilos.avulsoBotaoTxt}>Vincular</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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

      {/* ── Modal de vinculo de item avulso ─────────────────────── */}
      <Modal visible={!!avulsoVinculando} animationType="slide" transparent onRequestClose={() => !vinculando && setAvulsoVinculando(null)}>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContainer}>
            <Text style={estilos.modalTitulo}>Vincular item avulso</Text>
            {avulsoVinculando && (
              <>
                <Text style={estilos.modalProduto}>Codigo bipado: {avulsoVinculando.codigo}</Text>
                <Text style={estilos.modalInfo}>
                  {avulsoVinculando.bipagens} bipagem(ns) · {avulsoVinculando.quantidade_total} un serao
                  transferidas para o produto informado, mantendo rodada, operador e horario.
                </Text>
                {avulsoVinculando.sugestoes?.length > 0 && (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={estilos.rotulo}>Produtos parecidos</Text>
                    {avulsoVinculando.sugestoes.map(s => (
                      <TouchableOpacity key={s.sku} onPress={() => setSkuDestino(s.sku)}
                        style={[estilos.sugestao, skuDestino === s.sku && estilos.sugestaoAtiva]}>
                        <Text style={estilos.sugestaoSku}>{s.sku}</Text>
                        <Text style={estilos.sugestaoDesc} numberOfLines={1}>{s.descricao}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={estilos.rotulo}>SKU do produto cadastrado *</Text>
                <TextInput
                  style={estilos.input}
                  value={skuDestino}
                  onChangeText={setSkuDestino}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Ex: T10000AZ038100200030"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}
            <View style={{ height: spacing.md }} />
            <Button titulo="Vincular e transferir contagens" onPress={handleVincular} carregando={vinculando} desabilitado={vinculando} />
            <View style={{ height: spacing.xs }} />
            <Button titulo="Cancelar" variante="secondary" onPress={() => setAvulsoVinculando(null)} desabilitado={vinculando} />
          </View>
        </View>
      </Modal>

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
                  {rodadaDaContagem(itemEditando)}ª contagem · Operador: {itemEditando.nome_usuario || '—'}
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
                      {a.rodada || a.numero_contagem}ª contagem: {a.quantidade_original} → {a.quantidade_ajustada}
                    </Text>
                    {a.justificativa ? (
                      <Text style={estilos.ajusteJustificativa}>"{a.justificativa}"</Text>
                    ) : null}
                    <Text style={estilos.ajusteMeta}>
                      Por {a.ajustado_por || '—'} · {formatarDataHora(a.ajustado_em)}
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
  avulsosBox: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.warningSoft, borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  avulsosTitulo: { fontSize: fontSize.sm, fontWeight: '800', color: colors.warning },
  avulsosTexto: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.sm },
  avulsoLinha: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs,
  },
  avulsoCodigo: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  avulsoInfo: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  avulsoBotao: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  avulsoBotaoTxt: { color: colors.onDark, fontSize: fontSize.sm, fontWeight: '700' },
  sugestao: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  sugestaoAtiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sugestaoSku: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  sugestaoDesc: { fontSize: fontSize.xs, color: colors.textMuted },

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
