// Tela de selecao de sessao de inventario.
// Mostra as sessoes em andamento da loja que o operador escolheu.

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarSessoes, pegarUsuario, cancelarSessao, encerrarSessao, gerarDivergencias } from '../services/api';
import Button from '../components/Button';

// ── Helpers compatíveis com web ──────────────────────────────────────────────
// Alert.alert com multiplos botoes nao funciona no browser.
// Na web: window.confirm() para decisao sim/nao, window.alert() para avisos.

function confirmar(titulo, mensagem, aoConfirmar) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
  } else {
    Alert.alert(titulo, mensagem, [
      { text: 'Voltar', style: 'cancel' },
      { text: titulo, style: 'destructive', onPress: aoConfirmar },
    ]);
  }
}

function avisar(titulo, mensagem) {
  if (Platform.OS === 'web') {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
  } else {
    Alert.alert(titulo, mensagem);
  }
}

export default function SessoesScreen({ navigation, route }) {
  const { loja } = route.params;

  const [sessoes, setSessoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [papel, setPapel] = useState('operador');
  const [cancelando, setCancelando] = useState(null);
  const [encerrando, setEncerrando] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  // Recarrega SEMPRE que a tela recebe foco (ex: ao voltar do Scanner/Resumo)
  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [])
  );

  async function carregarDados() {
    try {
      const usuario = await pegarUsuario();
      setIsAdmin(usuario?.papel === 'admin');
      setPapel(usuario?.papel || 'operador');
    } catch (_) {}

    try {
      // Busca apenas sessoes ativas: em_andamento + aguardando_aprovacao
      const [andamento, aguardando] = await Promise.all([
        listarSessoes({ loja_id: loja.id, status: 'em_andamento' }, 1, 200),
        listarSessoes({ loja_id: loja.id, status: 'aguardando_aprovacao' }, 1, 200),
      ]);
      setSessoes([...(aguardando.items || []), ...(andamento.items || [])]);
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel carregar as sessoes');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  async function handleEncerrar(sessao) {
    confirmar(
      'Encerrar sessao',
      `Encerrar "${sessao.nome}"?\n\nIsso gera as divergencias para revisao. Operadores nao poderao mais bipar.`,
      async () => {
        setEncerrando(sessao.id);
        try {
          await encerrarSessao(sessao.id);
          await gerarDivergencias(sessao.id);
          await carregarDados();
          avisar('Sessao encerrada', 'Divergencias geradas. Acesse "Divergencias" para aprovar ou rejeitar os ajustes.');
        } catch (err) {
          avisar('Erro', err.message || 'Nao foi possivel encerrar');
        } finally {
          setEncerrando(null);
        }
      }
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregarDados();
  }

  function handleCancelar(sessao) {
    confirmar(
      'Cancelar sessao',
      `Deseja cancelar "${sessao.nome}"?\n\nEsta acao nao pode ser desfeita.`,
      () => confirmarCancelamento(sessao),
    );
  }

  async function confirmarCancelamento(sessao) {
    setCancelando(sessao.id);
    try {
      await cancelarSessao(sessao.id);
      setSessoes(prev => prev.filter(s => s.id !== sessao.id));
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel cancelar a sessao');
    } finally {
      setCancelando(null);
    }
  }

  function selecionarSessao(sessao) {
    // rodada:1 = primeira contagem; ScannerScreen controla o avanco
    navigation.navigate('Scanner', { sessao, loja, rodada: 1, itensPendentes: [] });
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

  // Papeis somente leitura: apenas visualizam, nao executam acoes
  const isReadOnly = ['gerente', 'auditor'].includes(papel);
  const podeEscrever = !isReadOnly; // admin, gestor, operador podem agir

  function renderSessao({ item }) {
    const estaCancelando = cancelando === item.id;
    const estaEncerrando = encerrando === item.id;
    const { bg, txt, label } = badgeStatus(item.status);
    const podeContar = item.status === 'em_andamento' && podeEscrever;

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
          {item.natureza_filtro_nome ? (
            <View style={[estilos.tagMes, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
              <Text style={[estilos.tagMesTexto, { color: colors.primary }]}>
                {item.natureza_filtro_nome}
              </Text>
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

        {/* Breakdown por natureza — aparece quando a sessao abrange mais de uma */}
        {item.skus_por_natureza && item.skus_por_natureza.length > 1 && (
          <View style={estilos.naturezaRow}>
            <Text style={estilos.naturezaLabel}>Naturezas: </Text>
            {item.skus_por_natureza.map(n => (
              <View key={n.natureza_id} style={estilos.naturezaChip}>
                <Text style={estilos.naturezaChipTxt}>{n.natureza_nome} ({n.total_skus})</Text>
              </View>
            ))}
          </View>
        )}

        {/* Encerrar sessao: apenas em_andamento + admin + sem leitura-somente */}
        {isAdmin && item.status === 'em_andamento' && podeEscrever && (
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

        {/* Aguardando aprovacao — gerente/auditor pode ver mas nao aprovar */}
        {(isAdmin || isReadOnly) && item.status === 'aguardando_aprovacao' && (
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

        {/* Acoes pos-inventario — apenas divergencias e historico */}
        {(isAdmin || isReadOnly) && item.status === 'concluida' && (
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
          </View>
        )}

        {/* M3: ADM pode excluir QUALQUER sessao — leitura-somente nao pode */}
        {isAdmin && podeEscrever && (
          <TouchableOpacity
            style={estilos.botaoCancelar}
            onPress={() => handleCancelar(item)}
            disabled={estaCancelando}
          >
            {estaCancelando ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={estilos.botaoCancelarTexto}>
                {item.status === 'concluida' ? 'Excluir sessao (ADM)' : 'Cancelar sessao'}
              </Text>
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

          {/* Nova Sessao (admin apenas) */}
          {isAdmin && podeEscrever && (
            <TouchableOpacity
              style={[estilos.chip, estilos.chipPrimary]}
              onPress={() => navigation.navigate('CriarSessao')}
            >
              <Text style={[estilos.chipTexto, { color: colors.primary }]}>+ Nova sessao</Text>
            </TouchableOpacity>
          )}

          {/* Indicador de visao — sempre ativas */}
          <View style={estilos.chip}>
            <Text style={estilos.chipTexto}>Ativas</Text>
          </View>
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
            onRefresh={() => { setRefreshing(true); carregarDados(); }}
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
  naturezaRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    gap: 4, marginTop: spacing.xs, paddingTop: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  naturezaLabel: { fontSize: 10, color: colors.textMuted },
  naturezaChip: {
    backgroundColor: '#FEF3C7', borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  naturezaChipTxt: { fontSize: 10, color: '#92400E', fontWeight: '600' },
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