// Tela de divergencias de uma sessao concluida.
// ADM e Gestor podem aprovar ou rejeitar cada divergencia.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, Alert, RefreshControl, TouchableOpacity,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarDivergencias, aprovarDivergencia, rejeitarDivergencia, concluirSessao } from '../services/api';


const STATUS_COR = {
  pendente:  { bg: colors.warningSoft,  txt: colors.warning },
  aprovada:  { bg: colors.successSoft,  txt: colors.success },
  rejeitada: { bg: colors.dangerSoft,   txt: colors.danger  },
};

export default function DivergenciasScreen({ navigation, route }) {
  const { sessao, loja } = route.params;

  const [divergencias, setDivergencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processando, setProcessando] = useState(null); // id da div em processamento

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      const dados = await listarDivergencias(sessao.id);
      setDivergencias(dados);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar as divergencias');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  async function handleAprovar(div) {
    Alert.alert(
      'Aprovar divergencia',
      `Aprovar ajuste de ${_fmtNum(div.diferenca)} ${div.unidade_medida || ''} para "${div.descricao_produto}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            setProcessando(div.id);
            try {
              await aprovarDivergencia(div.id);
              setDivergencias(prev =>
                prev.map(d => d.id === div.id ? { ...d, status: 'aprovada' } : d)
              );
            } catch (err) {
              Alert.alert('Erro', err.message || 'Nao foi possivel aprovar');
            } finally {
              setProcessando(null);
            }
          },
        },
      ]
    );
  }

  async function handleRejeitar(div) {
    Alert.alert(
      'Rejeitar divergencia',
      `Rejeitar ajuste para "${div.descricao_produto}"? O saldo do sistema sera mantido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rejeitar',
          style: 'destructive',
          onPress: async () => {
            setProcessando(div.id);
            try {
              await rejeitarDivergencia(div.id);
              setDivergencias(prev =>
                prev.map(d => d.id === div.id ? { ...d, status: 'rejeitada' } : d)
              );
            } catch (err) {
              Alert.alert('Erro', err.message || 'Nao foi possivel rejeitar');
            } finally {
              setProcessando(null);
            }
          },
        },
      ]
    );
  }

  function _fmtNum(v) {
    if (v == null) return '—';
    const n = parseFloat(v);
    return (n > 0 ? '+' : '') + n.toFixed(3).replace(/\.?0+$/, '');
  }

  function renderDivergencia({ item: div }) {
    const cores = STATUS_COR[div.status] || STATUS_COR.pendente;
    const emProcessamento = processando === div.id;
    const diferenca = parseFloat(div.diferenca || 0);

    return (
      <View style={estilos.card}>
        {/* Cabecalho do card */}
        <View style={estilos.cardTopo}>
          <View style={estilos.cardTextos}>
            <Text style={estilos.produto} numberOfLines={2}>{div.descricao_produto || div.sku}</Text>
            <Text style={estilos.sku}>{div.sku}</Text>
          </View>
          <View style={[estilos.badge, { backgroundColor: cores.bg }]}>
            <Text style={[estilos.badgeTexto, { color: cores.txt }]}>
              {div.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Numeros */}
        <View style={estilos.numerosRow}>
          <View style={estilos.numero}>
            <Text style={estilos.numeroValor}>{_fmtNum(div.quantidade_sistema)}</Text>
            <Text style={estilos.numeroLabel}>Sistema</Text>
          </View>
          <View style={estilos.numeroDivisor} />
          <View style={estilos.numero}>
            <Text style={estilos.numeroValor}>{_fmtNum(div.quantidade_final)}</Text>
            <Text style={estilos.numeroLabel}>Contado</Text>
          </View>
          <View style={estilos.numeroDivisor} />
          <View style={estilos.numero}>
            <Text style={[estilos.numeroValor, {
              color: diferenca === 0 ? colors.success : diferenca > 0 ? colors.warning : colors.danger
            }]}>
              {_fmtNum(div.diferenca)}
            </Text>
            <Text style={estilos.numeroLabel}>Diferenca</Text>
          </View>
        </View>

        {/* Botoes de acao (apenas se pendente) */}
        {div.status === 'pendente' && (
          <View style={estilos.acoes}>
            {emProcessamento ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[estilos.botaoAcao, estilos.botaoAprovar]}
                  onPress={() => handleAprovar(div)}
                >
                  <Text style={estilos.botaoAprovarTexto}>Aprovar ajuste</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[estilos.botaoAcao, estilos.botaoRejeitar]}
                  onPress={() => handleRejeitar(div)}
                >
                  <Text style={estilos.botaoRejeitarTexto}>Rejeitar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  const [concluindo, setConcluindo] = useState(false);
  const pendentes  = divergencias.filter(d => d.status === 'pendente').length;
  const aprovadas  = divergencias.filter(d => d.status === 'aprovada').length;
  const rejeitadas = divergencias.filter(d => d.status === 'rejeitada').length;

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando divergencias...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      {/* Resumo no topo */}
      <View style={estilos.resumo}>
        <ResumoItem valor={divergencias.length} rotulo="Total"    cor={colors.text} />
        <ResumoItem valor={pendentes}           rotulo="Pendentes" cor={colors.warning} />
        <ResumoItem valor={aprovadas}           rotulo="Aprovadas" cor={colors.success} />
        <ResumoItem valor={rejeitadas}          rotulo="Rejeitadas" cor={colors.danger} />
      </View>

      {/* Concluir sessao quando todas divergencias resolvidas */}
      {divergencias.length > 0 && pendentes === 0 && (
        <TouchableOpacity
          style={estilos.botaoConcluir}
          onPress={async () => {
            setConcluindo(true);
            try {
              await concluirSessao(sessao.id);
              Alert.alert('Sessao concluida!', 'O inventario foi finalizado com sucesso.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert('Erro', err.message || 'Nao foi possivel concluir');
            } finally {
              setConcluindo(false);
            }
          }}
          disabled={concluindo}
        >
          {concluindo
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={estilos.botaoConcluirTexto}>Concluir sessao de inventario</Text>
          }
        </TouchableOpacity>
      )}

      <FlatList
        data={divergencias}
        renderItem={renderDivergencia}
        keyExtractor={item => item.id}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>Nenhuma divergencia encontrada nesta sessao</Text>
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

function ResumoItem({ valor, rotulo, cor }) {
  return (
    <View style={estilos.resumoItem}>
      <Text style={[estilos.resumoValor, { color: cor }]}>{valor}</Text>
      <Text style={estilos.resumoRotulo}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  resumo: {
    flexDirection: 'row', backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  resumoItem:  { flex: 1, alignItems: 'center' },
  resumoValor: { fontSize: fontSize.xl, fontWeight: '700' },
  resumoRotulo: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  lista: { padding: spacing.md },
  card: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTopo:     { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: spacing.sm },
  cardTextos:   { flex: 1, marginRight: spacing.sm },
  produto:      { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sku:          { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  badge:        { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeTexto:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  numerosRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border,
                  paddingTop: spacing.sm, marginBottom: spacing.sm },
  numero:       { flex: 1, alignItems: 'center' },
  numeroDivisor: { width: 1, backgroundColor: colors.border },
  numeroValor:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  numeroLabel:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  acoes:        { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1,
                  borderTopColor: colors.border, paddingTop: spacing.sm },
  botaoAcao:    { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  botaoAprovar: { backgroundColor: colors.successSoft },
  botaoAprovarTexto: { fontSize: fontSize.sm, fontWeight: '700', color: colors.success },
  botaoRejeitar: { backgroundColor: colors.dangerSoft },
  botaoRejeitarTexto: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger },
  vazio:        { alignItems: 'center', padding: spacing.xl },
  vazioTexto:   { fontSize: fontSize.md, color: colors.textMuted },
});
