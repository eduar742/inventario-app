// Tela de pendentes de uma sessao em andamento, para o operador (ou lider).
// Mostra separadamente: itens que faltou bipar, itens aguardando 2a contagem
// e itens aguardando desempate (3a contagem, exige papel lider/admin) — cada
// grupo com um botao que ja abre o Scanner na rodada certa.

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
  liberarRecontagem,
} from '../services/api';
import { avisar } from '../utils/alertas';

// Enquanto a 2a contagem estiver aguardando liberacao, atualiza o contador
// de operadores ativos periodicamente (mesmo padrao do AcompanhamentoSessaoScreen).
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
  const [operadoresAtivos, setOperadoresAtivos] = useState(0);
  const [liberando, setLiberando] = useState(false);
  const timerRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      carregar();
      return () => clearInterval(timerRef.current);
    }, [])
  );

  // Poll leve so enquanto ha itens aguardando 2a contagem e ela ainda nao
  // foi liberada — e o unico cenario onde "operadores_ativos" muda sem o
  // operador interagir com esta tela.
  React.useEffect(() => {
    clearInterval(timerRef.current);
    if (aguardando2.length > 0 && !recontagemLiberada) {
      timerRef.current = setInterval(() => carregar(true), INTERVALO_POLL);
    }
    return () => clearInterval(timerRef.current);
  }, [aguardando2.length, recontagemLiberada]);

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

      setNaoContados(pendentes || []);
      setRecontagemLiberada(!!sessaoAtualizada.recontagem_liberada);
      setOperadoresAtivos(sessaoAtualizada.operadores_ativos || 0);

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

  async function handleLiberarRecontagem() {
    setLiberando(true);
    try {
      await liberarRecontagem(sessao.id);
      setRecontagemLiberada(true);
    } catch (err) {
      avisar('Nao foi possivel liberar', err.message || 'Tente novamente.');
    } finally {
      setLiberando(false);
    }
  }

  const podeDesempatar = papel === 'lider' || papel === 'admin';
  const podeLiberarRecontagem = papel === 'lider' || papel === 'gestor';
  const totalPendentes = naoContados.length + aguardando2.length + aguardando3.length;

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
        {totalPendentes === 0 ? (
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTitulo}>Nada pendente por aqui</Text>
            <Text style={estilos.vazioTexto}>
              Todos os produtos desta sessao ja foram contados e conferidos.
            </Text>
          </View>
        ) : (
          <>
            <Secao
              titulo="Itens que faltou bipar"
              itens={naoContados}
              corBorda={colors.danger}
              acao={<Button titulo="Bipar itens que faltaram" onPress={() => iniciarContagem(1, naoContados)} />}
            />
            <Secao
              titulo="Aguardando 2ª contagem"
              itens={aguardando2}
              corBorda={colors.warning}
              acao={
                recontagemLiberada ? (
                  <Button titulo="Iniciar 2ª contagem" onPress={() => iniciarContagem(2, aguardando2)} />
                ) : podeLiberarRecontagem ? (
                  <>
                    <Text style={estilos.dica}>
                      {operadoresAtivos > 0
                        ? `Aguardando ${operadoresAtivos} operador(es) saírem da sessão antes de liberar.`
                        : 'Todos os operadores saíram — pronto para liberar.'}
                    </Text>
                    <View style={{ height: spacing.sm }} />
                    <Button
                      titulo={liberando ? 'Liberando...' : 'Liberar 2ª contagem'}
                      variante="secondary"
                      carregando={liberando}
                      desabilitado={operadoresAtivos > 0}
                      onPress={handleLiberarRecontagem}
                    />
                  </>
                ) : (
                  <Text style={estilos.dica}>
                    Aguardando o Lider ou Gestor liberar a 2ª contagem
                    {operadoresAtivos > 0 ? ` (ainda há ${operadoresAtivos} operador(es) na sessão)` : ''}.
                  </Text>
                )
              }
            />
            <Secao
              titulo="Aguardando 3ª contagem — desempate"
              itens={aguardando3}
              corBorda={colors.info}
              acao={podeDesempatar
                ? <Button titulo="Iniciar 3ª contagem (desempate)" onPress={() => iniciarContagem(3, aguardando3)} />
                : <Text style={estilos.dica}>Apenas um usuario com papel Lider pode fazer o desempate.</Text>
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
