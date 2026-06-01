// Tela de selecao de sessao de inventario.
// Mostra as sessoes em andamento da loja que o operador escolheu.

import React, { useState, useEffect } from 'react';
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
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarSessoes, pegarUsuario, cancelarSessao, encerrarSessao, gerarDivergencias } from '../services/api';
import Button from '../components/Button';
import { exportarEstoque } from '../services/exportacao';

export default function SessoesScreen({ navigation, route }) {
  const { loja } = route.params;

  const [sessoes, setSessoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cancelando, setCancelando] = useState(null);
  const [encerrando, setEncerrando] = useState(null);
  const [exportando, setExportando] = useState(false);
  // 'ativas' = em_andamento + aguardando_aprovacao | 'concluidas' = concluida
  const [filtroVisao, setFiltroVisao] = useState('ativas');

  useEffect(() => {
    carregarDados();
  }, [filtroVisao]);

  async function carregarDados() {
    try {
      const usuario = await pegarUsuario();
      setIsAdmin(usuario?.papel === 'admin');
    } catch (_) {}

    try {
      if (filtroVisao === 'concluidas') {
        const dados = await listarSessoes({ loja_id: loja.id, status: 'concluida' });
        setSessoes(dados);
      } else {
        // Busca em_andamento + aguardando_aprovacao em paralelo
        const [andamento, aguardando] = await Promise.all([
          listarSessoes({ loja_id: loja.id, status: 'em_andamento' }),
          listarSessoes({ loja_id: loja.id, status: 'aguardando_aprovacao' }),
        ]);
        setSessoes([...aguardando, ...andamento]); // aguardando primeiro (precisa atenção)
      }
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar as sessoes');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  async function handleEncerrar(sessao) {
    Alert.alert(
      'Encerrar sessao',
      `Encerrar "${sessao.nome}"?\n\nIsso gera as divergencias para revisao. Operadores nao poderao mais bipar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            setEncerrando(sessao.id);
            try {
              await encerrarSessao(sessao.id);
              await gerarDivergencias(sessao.id);
              await carregarDados();
              Alert.alert(
                'Sessao encerrada',
                'Divergencias geradas. Acesse "Divergencias" para aprovar ou rejeitar os ajustes.',
              );
            } catch (err) {
              Alert.alert('Erro', err.message || 'Nao foi possivel encerrar');
            } finally {
              setEncerrando(null);
            }
          },
        },
      ]
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregarDados();
  }

  function handleCancelar(sessao) {
    Alert.alert(
      'Cancelar sessao',
      `Deseja cancelar "${sessao.nome}"?\n\nEsta acao nao pode ser desfeita.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar sessao',
          style: 'destructive',
          onPress: () => confirmarCancelamento(sessao),
        },
      ]
    );
  }

  async function confirmarCancelamento(sessao) {
    setCancelando(sessao.id);
    try {
      await cancelarSessao(sessao.id);
      setSessoes(prev => prev.filter(s => s.id !== sessao.id));
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel cancelar a sessao');
    } finally {
      setCancelando(null);
    }
  }

  function selecionarSessao(sessao) {
    navigation.navigate('Scanner', { sessao, loja });
  }

  function formatarData(iso) {
    if (!iso) return '';
    const data = new Date(iso);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function corDoTipo(tipo) {
    return tipo === 'geral' ? colors.infoSoft : colors.warningSoft;
  }

  function corTextoTipo(tipo) {
    return tipo === 'geral' ? colors.info : colors.warning;
  }

  function badgeStatus(status) {
    const cfg = {
      'em_andamento':        { bg: colors.infoSoft,    txt: colors.info,    label: 'Em andamento' },
      'aguardando_aprovacao': { bg: colors.warningSoft, txt: colors.warning, label: 'Aguard. aprovacao' },
      'concluida':           { bg: colors.successSoft, txt: colors.success, label: 'Concluida' },
      'cancelada':           { bg: colors.dangerSoft,  txt: colors.danger,  label: 'Cancelada' },
    };
    return cfg[status] || { bg: colors.backgroundSoft, txt: colors.textSecondary, label: status };
  }

  function renderSessao({ item }) {
    const estaCancelando = cancelando === item.id;
    const estaEncerrando = encerrando === item.id;
    const { bg, txt, label } = badgeStatus(item.status);
    const podeContar = item.status === 'em_andamento';

    return (
      <TouchableOpacity
        style={estilos.card}
        onPress={() => podeContar ? selecionarSessao(item) : null}
        activeOpacity={podeContar ? 0.7 : 1}
        disabled={estaCancelando || estaEncerrando}
      >
        <View style={estilos.cardTopo}>
          <Text style={estilos.nomeSessao} numberOfLines={2}>
            {item.nome}
          </Text>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[estilos.badge, { backgroundColor: corDoTipo(item.tipo) }]}>
              <Text style={[estilos.badgeTexto, { color: corTextoTipo(item.tipo) }]}>
                {item.tipo.toUpperCase()}
              </Text>
            </View>
            <View style={[estilos.badge, { backgroundColor: bg }]}>
              <Text style={[estilos.badgeTexto, { color: txt }]}>{label.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={estilos.metaRow}>
          {item.mes_referencia ? (
            <View style={estilos.tagMes}>
              <Text style={estilos.tagMesTexto}>{item.mes_referencia}</Text>
            </View>
          ) : null}
          <Text style={estilos.dataIniciada}>
            Iniciada em {formatarData(item.iniciada_em)}
          </Text>
        </View>

        <View style={estilos.barraProgressoContainer}>
          <View style={estilos.barraProgressoFundo}>
            <View
              style={[
                estilos.barraProgressoFill,
                { width: `${item.percentual_progresso || 0}%` },
              ]}
            />
          </View>
          <Text style={estilos.progressoTexto}>
            {item.percentual_progresso || 0}%
          </Text>
        </View>

        <View style={estilos.rodape}>
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>{item.total_produtos_loja || 0}</Text>
            <Text style={estilos.statLabel}>Total</Text>
          </View>
          <View style={estilos.statDivisor} />
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>{item.total_produtos_contados || 0}</Text>
            <Text style={estilos.statLabel}>Contados</Text>
          </View>
          <View style={estilos.statDivisor} />
          <View style={estilos.stat}>
            <Text style={estilos.statValor}>
              {(item.total_produtos_loja || 0) - (item.total_produtos_contados || 0)}
            </Text>
            <Text style={estilos.statLabel}>Faltam</Text>
          </View>
        </View>

        {/* Encerrar sessao: apenas em_andamento + admin */}
        {isAdmin && item.status === 'em_andamento' && (
          <TouchableOpacity
            style={estilos.botaoCancelar}
            onPress={() => handleEncerrar(item)}
            disabled={estaEncerrando}
          >
            {estaEncerrando
              ? <ActivityIndicator size="small" color={colors.warning} />
              : <Text style={[estilos.botaoCancelarTexto, { color: colors.warning }]}>Encerrar sessao</Text>
            }
          </TouchableOpacity>
        )}

        {/* Aguardando aprovacao: ir para divergencias */}
        {isAdmin && item.status === 'aguardando_aprovacao' && (
          <View style={estilos.acoesCard}>
            <TouchableOpacity
              style={[estilos.botaoCardAcao, { backgroundColor: colors.warningSoft, flex: 2 }]}
              onPress={() => navigation.navigate('Divergencias', { sessao: item, loja })}
            >
              <Text style={[estilos.botaoCardAcaoTexto, { color: colors.warning }]}>Revisar divergencias</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[estilos.botaoCardAcao, { backgroundColor: colors.infoSoft }]}
              onPress={() => navigation.navigate('HistoricoContagens', { sessao: item, loja })}
            >
              <Text style={[estilos.botaoCardAcaoTexto, { color: colors.info }]}>Historico</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Acoes pos-inventario: apenas sessoes concluidas */}
        {isAdmin && item.status === 'concluida' && (
          <View style={estilos.acoesCard}>
            <TouchableOpacity
              style={[estilos.botaoCardAcao, { backgroundColor: colors.warningSoft }]}
              onPress={() => navigation.navigate('Divergencias', { sessao: item, loja })}
            >
              <Text style={[estilos.botaoCardAcaoTexto, { color: colors.warning }]}>Divergencias</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[estilos.botaoCardAcao, { backgroundColor: colors.infoSoft }]}
              onPress={() => navigation.navigate('HistoricoContagens', { sessao: item, loja })}
            >
              <Text style={[estilos.botaoCardAcaoTexto, { color: colors.info }]}>Historico</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[estilos.botaoCardAcao, { backgroundColor: colors.successSoft }]}
              onPress={() => navigation.navigate('ExportarRelatorio', { sessao: item, loja })}
            >
              <Text style={[estilos.botaoCardAcaoTexto, { color: colors.success }]}>Exportar</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAdmin && item.status !== 'concluida' && (
          <TouchableOpacity
            style={estilos.botaoCancelar}
            onPress={() => handleCancelar(item)}
            disabled={estaCancelando}
          >
            {estaCancelando ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={estilos.botaoCancelarTexto}>Cancelar sessao</Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  function ListaVazia() {
    return (
      <View style={estilos.vazioContainer}>
        <Text style={estilos.vazioTitulo}>Nenhuma sessao em andamento</Text>
        <Text style={estilos.vazioSubtitulo}>
          O gestor precisa criar e iniciar uma sessao de inventario para esta loja.
        </Text>
      </View>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.containerLoading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoLoading}>Carregando sessoes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <View style={estilos.cabecalho}>
        {/* Linha 1: nome da loja como titulo */}
        <Text style={estilos.cabecalhoTitulo} numberOfLines={1} ellipsizeMode="tail">
          {loja.nome}
        </Text>

        {/* Linha 2: chips compactos horizontais */}
        <View style={estilos.cabecalhoChips}>
          {/* Codigo da loja */}
          <View style={estilos.chip}>
            <Text style={estilos.chipTexto}>{loja.codigo}</Text>
          </View>

          {/* Nova Sessao (admin) */}
          {isAdmin && (
            <TouchableOpacity
              style={[estilos.chip, estilos.chipPrimary]}
              onPress={() => navigation.navigate('CriarSessao')}
            >
              <Text style={[estilos.chipTexto, { color: colors.primary }]}>+ Nova sessao</Text>
            </TouchableOpacity>
          )}

          {/* Toggle ativas / concluidas */}
          {isAdmin ? (
            <TouchableOpacity
              style={[estilos.chip, filtroVisao === 'concluidas' && estilos.chipAtivo]}
              onPress={() => {
                setFiltroVisao(v => v === 'ativas' ? 'concluidas' : 'ativas');
                setCarregando(true);
              }}
            >
              <Text style={[estilos.chipTexto, filtroVisao === 'concluidas' && estilos.chipTextoAtivo]}>
                {filtroVisao === 'concluidas' ? 'Concluidas' : 'Ativas'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={estilos.chip}>
              <Text style={estilos.chipTexto}>Ativas</Text>
            </View>
          )}

          {/* Excel (admin) */}
          {isAdmin && (
            <TouchableOpacity
              style={[estilos.chip, estilos.chipVerde]}
              onPress={async () => {
                setExportando(true);
                try {
                  await exportarEstoque(loja.id, loja.codigo);
                } catch (err) {
                  Alert.alert('Erro ao exportar', err.message || 'Tente novamente');
                } finally {
                  setExportando(false);
                }
              }}
              disabled={exportando}
            >
              <Text style={[estilos.chipTexto, { color: colors.success }]}>
                {exportando ? '...' : 'Excel'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Importar (admin) */}
          {isAdmin && (
            <TouchableOpacity
              style={[estilos.chip, estilos.chipAzul]}
              onPress={() => navigation.navigate('Importacao')}
            >
              <Text style={[estilos.chipTexto, { color: colors.primary }]}>Importar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={sessoes}
        renderItem={renderSessao}
        keyExtractor={(item) => item.id}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={ListaVazia}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  containerLoading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoLoading: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  cabecalho: {
    flexDirection: 'column',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // Linha 1: nome da loja
  cabecalhoTitulo: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // Linha 2: chips horizontais
  cabecalhoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipAtivo: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  chipVerde: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  chipAzul: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipTexto: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextoAtivo: {
    color: colors.success,
  },
  lista: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  nomeSessao: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dataIniciada: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  barraProgressoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  barraProgressoFundo: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  barraProgressoFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  progressoTexto: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 40,
    textAlign: 'right',
  },
  rodape: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivisor: {
    width: 1,
    backgroundColor: colors.border,
  },
  statValor: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  vazioContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  vazioTitulo: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  vazioSubtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  botaoCancelar: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.dangerSoft,
  },
  botaoCancelarTexto: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.danger,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagMes: {
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagMesTexto: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.info,
  },
  chipPrimary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  acoesCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  botaoCardAcao: {
    flex: 1, paddingVertical: spacing.sm,
    borderRadius: radius.sm, alignItems: 'center',
  },
  botaoCardAcaoTexto: {
    fontSize: fontSize.sm, fontWeight: '700',
  },
});