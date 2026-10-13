// Tela de pendentes de uma sessao em andamento, para o operador (ou lider).
// Mostra separadamente: itens que faltou bipar, itens aguardando 2a contagem
// e itens aguardando desempate (3a contagem, exige papel lider/admin) — cada
// grupo com um botao que ja abre o Scanner na rodada certa. Lider/Gestor/ADM
// veem no topo o controle das rodadas (finalizar a atual e iniciar a proxima).

import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import {
  listarPendentes,
  listarRecontagemNecessaria,
  pegarUsuario,
  buscarPerfilAtual,
  buscarSessao,
} from '../services/api';
import { avisar } from '../utils/alertas';
import FinalizarRodadaCard from '../components/FinalizarRodadaCard';

// Atualizacao periodica da lista (itens bipados por outros operadores) e do
// contador de operadores ativos (mesmo padrao do AcompanhamentoSessaoScreen).
const INTERVALO_POLL = 15000;

export default function PendentesOperadorScreen({ navigation, route }) {
  const { sessao, loja } = route.params;

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [naoContados, setNaoContados] = useState([]);
  const [aguardando2, setAguardando2] = useState([]);
  const [aguardando3, setAguardando3] = useState([]);
  const [papel, setPapel] = useState('operador');
  const [recontagemLiberada, setRecontagemLiberada] = useState(false);
  const [desempateLiberado, setDesempateLiberado] = useState(false);
  const [operadoresAtivos, setOperadoresAtivos] = useState(0);
  const [rodadaAtual, setRodadaAtual] = useState(sessao.rodada_atual || 1);
  const timerRef = useRef(null);

  // Recarrega ao abrir e, enquanto a tela estiver na frente, a cada
  // INTERVALO_POLL: o item bipado (por qualquer operador) sai da lista sem
  // precisar puxar para atualizar. Para ao sair da tela (ex: abrir o Scanner).
  useFocusEffect(
    useCallback(() => {
      carregar();
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => carregar(true), INTERVALO_POLL);
      return () => clearInterval(timerRef.current);
    }, [])
  );

  async function carregar(silencioso = false) {
    try {
      let usuario = await pegarUsuario();
      if (!usuario?.papel) usuario = await buscarPerfilAtual();
      setPapel(usuario?.papel || 'operador');
    } catch (_) {}

    try {
      const [pendentes, aguardandoRecontagem, sessaoAtualizada] = await Promise.all([
        listarPendentes(sessao.id),
        listarRecontagemNecessaria(sessao.id),
        buscarSessao(sessao.id),
      ]);

      if (sessaoAtualizada.status !== 'em_andamento') {
        // Encerrada (por quem finalizou a 3a, ou pelo ADM/Gestor)
        navigation.popTo('Sessoes', { loja });
        return;
      }

      setNaoContados(pendentes || []);
      setRecontagemLiberada(!!sessaoAtualizada.recontagem_liberada);
      setDesempateLiberado(!!sessaoAtualizada.desempate_liberado);
      setOperadoresAtivos(sessaoAtualizada.operadores_ativos || 0);
      setRodadaAtual(sessaoAtualizada.rodada_atual || 1);

      const bucket2 = [];
      const bucket3 = [];
      for (const item of aguardandoRecontagem || []) {
        const nRodadas = new Set((item.contagens || []).map(c => c.rodada || 1)).size;
        (nRodadas >= 2 ? bucket3 : bucket2).push(item);
      }
      setAguardando2(bucket2);
      setAguardando3(bucket3);
    } catch (err) {
      if (!silencioso) avisar('Erro', err.message || 'Nao foi possivel carregar os pendentes');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  function iniciarContagem(rodadaAlvo, itens) {
    navigation.navigate('Scanner', {
      sessao,
      loja,
      rodada: rodadaAlvo,
      itensPendentes: itens.map(p => ({
        codigoQr: p.codigo_qr,
        sku: p.sku,
        descricao: p.descricao,
        unidadeMedida: p.unidade_medida,
      })),
    });
  }

  // Rodadas controladas pelo Lider/Gestor/ADM (FinalizarRodadaCard): a 2a so
  // comeca quando a 1a e finalizada, e a 3a quando a 2a e finalizada.
  const podeFinalizarRodada = ['lider', 'gestor', 'admin'].includes(papel);
  const podeDesempatar = papel === 'lider' || papel === 'admin';
  // Lider e exclusivo da 3a contagem (desempate) — nao conta na 1a nem na 2a.
  const podeContarRodada1e2 = papel !== 'lider';
  const totalPendentes = naoContados.length + aguardando2.length + aguardando3.length;
  // Itens que vao receber 0 se a rodada aberta for finalizada agora
  const itensSemContagem = rodadaAtual === 1
    ? naoContados.length
    : rodadaAtual === 2 ? naoContados.length + aguardando2.length : totalPendentes;

  function Secao({ titulo, itens, corBorda, acao }) {
    if (itens.length === 0) return null;
    return (
      <View style={estilos.secao}>
        <Text style={estilos.secaoTitulo}>{titulo} ({itens.length})</Text>
        {itens.map((item) => (
          <View key={item.produto_id} style={[estilos.cardItem, { borderLeftColor: corBorda }]}>
            <Text style={estilos.cardNome} numberOfLines={2}>{item.descricao || item.sku}</Text>
            <Text style={estilos.cardSku}>{item.sku}</Text>
          </View>
        ))}
        <View style={{ height: spacing.sm }} />
        {acao}
      </View>
    );
  }

  const dica = (texto) => <Text style={estilos.dica}>{texto}</Text>;

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando pendentes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView
        contentContainerStyle={estilos.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); carregar(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {podeFinalizarRodada && (
          <FinalizarRodadaCard
            sessaoId={sessao.id}
            rodadaAtual={rodadaAtual}
            itensSemContagem={itensSemContagem}
            onFinalizado={(r) => (r.sessao_encerrada ? navigation.popTo('Sessoes', { loja }) : carregar())}
          />
        )}
        {podeFinalizarRodada && operadoresAtivos > 0 && (
          <Text style={[estilos.dica, { marginTop: -spacing.md, marginBottom: spacing.lg }]}>
            {operadoresAtivos} operador(es) ainda com o Scanner aberto.
          </Text>
        )}

        {totalPendentes === 0 ? (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTitulo}>Nada pendente por aqui</Text>
            <Text style={estilos.vazioTexto}>
              Todos os produtos desta rodada ja foram contados.
              {podeFinalizarRodada ? ' Use o botao acima para finalizar a contagem.' : ''}
            </Text>
          </View>
        ) : (
          <>
            <Secao
              titulo="Itens que faltou bipar"
              itens={naoContados}
              corBorda={colors.danger}
              acao={
                recontagemLiberada
                  ? dica('Serao registrados como 0 (nao encontrado) quando a contagem for finalizada.')
                  : podeContarRodada1e2
                    ? <Button titulo="Bipar itens que faltaram" onPress={() => iniciarContagem(1, naoContados)} />
                    : dica('Papel Líder realiza apenas a 3ª contagem (desempate). Se o item nao existir no fisico, finalize a 1ª contagem: ele entra como 0.')
              }
            />
            <Secao
              titulo="Aguardando 2ª contagem"
              itens={aguardando2}
              corBorda={colors.warning}
              acao={
                !recontagemLiberada
                  ? dica('A 2ª contagem comeca quando o Lider, Gestor ou ADM finalizar a 1ª.')
                  : podeContarRodada1e2
                    ? <Button titulo="Iniciar 2ª contagem" onPress={() => iniciarContagem(2, aguardando2)} />
                    : dica('Papel Líder realiza apenas a 3ª contagem (desempate).')
              }
            />
            <Secao
              titulo="Aguardando 3ª contagem — desempate"
              itens={aguardando3}
              corBorda={colors.info}
              acao={
                !desempateLiberado
                  ? dica('A 3ª contagem (desempate) comeca quando o Lider, Gestor ou ADM finalizar a 2ª.')
                  : podeDesempatar
                    ? <Button titulo="Iniciar 3ª contagem (desempate)" onPress={() => iniciarContagem(3, aguardando3)} />
                    : dica('Apenas um usuario com papel Lider pode fazer o desempate.')
              }
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  scroll: { padding: spacing.lg, flexGrow: 1 },
  secao: { marginBottom: spacing.lg },
  secaoTitulo: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  cardItem: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4,
  },
  cardNome: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  cardSku: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  dica: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, marginTop: spacing.xxl },
  vazioTitulo: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  vazioTexto: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
