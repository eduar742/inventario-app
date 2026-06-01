// Tela de historico de importacoes. Apenas para ADM.
// Lista importacoes com filtros por loja e mes.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarImportacoes, buscarImportacao, listarLojas } from '../services/api';


export default function HistoricoImportacoesScreen({ navigation }) {
  const [importacoes, setImportacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lojas, setLojas] = useState([]);
  const [filtroLoja, setFiltroLoja] = useState(null);
  const [filtroMes, setFiltroMes] = useState('');
  const [expandirFiltros, setExpandirFiltros] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  useEffect(() => {
    Promise.all([carregarImportacoes(), carregarLojas()]);
  }, []);

  async function carregarLojas() {
    try {
      const dados = await listarLojas();
      setLojas(dados);
    } catch (_) {}
  }

  async function carregarImportacoes(lojaId, mes) {
    try {
      const filtros = {};
      if (lojaId) filtros.loja_id = lojaId;
      if (mes) filtros.mes_referencia = mes;
      const dados = await listarImportacoes(filtros);
      setImportacoes(dados);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar o historico');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  function aplicarFiltros(lojaId, mes) {
    setCarregando(true);
    carregarImportacoes(lojaId, mes);
    setExpandirFiltros(false);
  }

  function limparFiltros() {
    setFiltroLoja(null);
    setFiltroMes('');
    aplicarFiltros(null, '');
  }

  async function verDetalhe(importacaoId) {
    setCarregandoDetalhe(true);
    try {
      const dados = await buscarImportacao(importacaoId);
      setDetalhe(dados);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar os detalhes');
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  function formatarData(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function corStatus(status) {
    switch (status) {
      case 'sucesso':  return colors.success;
      case 'parcial':  return colors.warning;
      case 'falhou':   return colors.danger;
      default:         return colors.info;
    }
  }

  function renderItem({ item }) {
    const cor = corStatus(item.status);
    return (
      <TouchableOpacity
        style={estilos.card}
        onPress={() => verDetalhe(item.id)}
        activeOpacity={0.7}
      >
        <View style={estilos.cardTopo}>
          <View style={estilos.cardInfo}>
            <Text style={estilos.cardArquivo} numberOfLines={1}>{item.arquivo_nome}</Text>
            <Text style={estilos.cardMeta}>
              {item.loja?.codigo} · {item.mes_referencia} · {item.modo}
            </Text>
            <Text style={estilos.cardData}>{formatarData(item.importado_em)}</Text>
          </View>
          <View style={[estilos.badge, { backgroundColor: cor + '22' }]}>
            <Text style={[estilos.badgeTexto, { color: cor }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={estilos.cardStats}>
          <Stat rotulo="Total" valor={item.linhas_total} />
          <Stat rotulo="Sucesso" valor={item.linhas_sucesso} cor={colors.success} />
          {item.linhas_erro > 0 && (
            <Stat rotulo="Erros" valor={item.linhas_erro} cor={colors.danger} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const temFiltroAtivo = filtroLoja || filtroMes;

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando historico...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      {/* Barra de filtros */}
      <View style={estilos.barraFiltros}>
        <TouchableOpacity
          style={[estilos.botaoFiltro, temFiltroAtivo && estilos.botaoFiltroAtivo]}
          onPress={() => setExpandirFiltros(!expandirFiltros)}
        >
          <Text style={[estilos.botaoFiltroTexto, temFiltroAtivo && estilos.botaoFiltroTextoAtivo]}>
            {temFiltroAtivo ? 'Filtros ativos' : 'Filtrar'}
          </Text>
        </TouchableOpacity>
        {temFiltroAtivo && (
          <TouchableOpacity onPress={limparFiltros} style={estilos.botaoLimpar}>
            <Text style={estilos.botaoLimparTexto}>Limpar</Text>
          </TouchableOpacity>
        )}
        <Text style={estilos.contagem}>{importacoes.length} registros</Text>
      </View>

      {/* Painel de filtros */}
      {expandirFiltros && (
        <View style={estilos.painelFiltros}>
          <Text style={estilos.filtroRotulo}>Loja</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={estilos.filtroRow}>
              {lojas.map(loja => (
                <TouchableOpacity
                  key={loja.id}
                  style={[estilos.chipFiltro, filtroLoja?.id === loja.id && estilos.chipFiltroAtivo]}
                  onPress={() => setFiltroLoja(filtroLoja?.id === loja.id ? null : loja)}
                >
                  <Text style={[estilos.chipFiltroTexto, filtroLoja?.id === loja.id && estilos.chipFiltroTextoAtivo]}>
                    {loja.codigo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={estilos.botaoAplicar}
            onPress={() => aplicarFiltros(filtroLoja?.id, filtroMes)}
          >
            <Text style={estilos.botaoAplicarTexto}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={importacoes}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              carregarImportacoes(filtroLoja?.id, filtroMes);
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>Nenhuma importacao encontrada</Text>
          </View>
        }
      />

      {/* Modal de detalhe */}
      <Modal
        visible={!!detalhe || carregandoDetalhe}
        animationType="slide"
        transparent
        onRequestClose={() => setDetalhe(null)}
      >
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContainer}>
            {carregandoDetalhe ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ padding: spacing.xl }} />
            ) : detalhe ? (
              <ScrollView>
                <View style={estilos.modalHeader}>
                  <Text style={estilos.modalTitulo} numberOfLines={2}>{detalhe.arquivo_nome}</Text>
                  <TouchableOpacity onPress={() => setDetalhe(null)}>
                    <Text style={estilos.modalFechar}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={estilos.modalInfo}>
                  <InfoLinha rotulo="Loja" valor={`${detalhe.loja?.codigo} — ${detalhe.loja?.nome}`} />
                  <InfoLinha rotulo="Mes" valor={detalhe.mes_referencia} />
                  <InfoLinha rotulo="Modo" valor={detalhe.modo} />
                  <InfoLinha rotulo="Status" valor={detalhe.status} cor={corStatus(detalhe.status)} />
                  <InfoLinha rotulo="Data" valor={formatarData(detalhe.importado_em)} />
                  <InfoLinha rotulo="Total" valor={String(detalhe.linhas_total)} />
                  <InfoLinha rotulo="Sucesso" valor={String(detalhe.linhas_sucesso)} cor={colors.success} />
                  <InfoLinha rotulo="Erros" valor={String(detalhe.linhas_erro)} cor={detalhe.linhas_erro > 0 ? colors.danger : undefined} />
                </View>

                {detalhe.detalhes_erros && detalhe.detalhes_erros.length > 0 && (
                  <View style={estilos.modalErros}>
                    <Text style={estilos.modalErrosTitulo}>Erros ({detalhe.detalhes_erros.length})</Text>
                    {detalhe.detalhes_erros.map((e, i) => (
                      <View key={i} style={estilos.cardErro}>
                        <Text style={estilos.erroLinha}>Linha {e.linha} · {e.campo}</Text>
                        <Text style={estilos.erroMsg}>{e.mensagem}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ height: spacing.lg }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ rotulo, valor, cor }) {
  return (
    <View style={estilos.stat}>
      <Text style={[estilos.statValor, cor && { color: cor }]}>{valor}</Text>
      <Text style={estilos.statRotulo}>{rotulo}</Text>
    </View>
  );
}

function InfoLinha({ rotulo, valor, cor }) {
  return (
    <View style={estilos.infoLinha}>
      <Text style={estilos.infoRotulo}>{rotulo}</Text>
      <Text style={[estilos.infoValor, cor && { color: cor }]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  textoCarregando: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  barraFiltros: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  botaoFiltro: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  botaoFiltroAtivo: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  botaoFiltroTexto: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  botaoFiltroTextoAtivo: {
    color: colors.primary,
  },
  botaoLimpar: {
    paddingHorizontal: spacing.sm,
  },
  botaoLimparTexto: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '600',
  },
  contagem: {
    marginLeft: 'auto',
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  painelFiltros: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtroRotulo: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  filtroRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chipFiltro: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  chipFiltroAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipFiltroTexto: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipFiltroTextoAtivo: {
    color: colors.white,
    fontWeight: '600',
  },
  botaoAplicar: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  botaoAplicarTexto: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  lista: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardArquivo: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  cardMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardData: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  stat: {
    alignItems: 'center',
  },
  statValor: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  statRotulo: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  vazio: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  vazioTexto: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  // Modal de detalhe
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalTitulo: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  modalFechar: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    padding: 4,
  },
  modalInfo: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRotulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  infoValor: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  modalErros: {
    marginBottom: spacing.md,
  },
  modalErrosTitulo: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  cardErro: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  erroLinha: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 2,
  },
  erroMsg: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
});
