import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { registrarContagem, encerrarSessao, gerarDivergencias, listarPendentes } from '../services/api';
import { exportarSessao } from '../services/exportacao';

const ORDINAL = { 1: '1ª', 2: '2ª', 3: '3ª' };

export default function ResumoScreen({ navigation, route }) {
  const { contagens, sessao, loja } = route.params;
  const rodada = route.params?.rodada ?? 1;

  const [processando, setProcessando] = useState(true);
  const [confirmados, setConfirmados] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [erroGeral, setErroGeral] = useState('');
  const [sessaoEncerrada, setSessaoEncerrada] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    finalizarInventario();
  }, []);

  async function finalizarInventario() {
    setProcessando(true);
    setErroGeral('');

    // Sem itens para registrar
    if (!contagens || contagens.length === 0) {
      setErroGeral('Nenhum item para registrar. Volte e bipe os produtos antes de finalizar.');
      setProcessando(false);
      return;
    }

    // Agrupa por codigoQr e soma quantidades
    const mapa = {};
    for (const c of contagens) {
      if (!mapa[c.codigoQr]) {
        mapa[c.codigoQr] = {
          codigoQr: c.codigoQr,
          sku: c.sku,
          descricao: c.descricao,
          unidadeMedida: c.unidadeMedida,
          quantidadeTotal: 0,
          obsLista: [],
        };
      }
      mapa[c.codigoQr].quantidadeTotal += c.quantidade;
      if (c.observacoes) mapa[c.codigoQr].obsLista.push(c.observacoes);
    }

    const novosPendentes = [];
    const novosConfirmados = [];
    let totalErros = 0;
    let primeiroErro = '';

    const itensMapa = Object.values(mapa);
    console.log(`[ResumoScreen] Finalizando ${itensMapa.length} produto(s) na sessao ${sessao.id}`);

    for (const item of itensMapa) {
      try {
        const obs = item.obsLista.length > 0 ? item.obsLista.join('; ') : null;

        console.log(`[ResumoScreen] Registrando: codigoQr=${item.codigoQr} qtd=${item.quantidadeTotal}`);

        const resp = await registrarContagem({
          sessaoId: sessao.id,
          codigoQr: item.codigoQr,
          quantidadeContada: item.quantidadeTotal,
          observacoes: obs,
        });

        console.log(`[ResumoScreen] OK: ${item.codigoQr} → status=${resp.status_produto}`);

        if (resp.status_produto === 'aguardando_recontagem') {
          novosPendentes.push({ item, resp });
        } else {
          novosConfirmados.push({ item, resp, erro: null });
        }
      } catch (err) {
        totalErros++;
        const msg = err.message || 'Erro desconhecido';
        if (!primeiroErro) primeiroErro = msg;
        console.error(`[ResumoScreen] ERRO ${item.codigoQr}:`, msg, err);
        novosConfirmados.push({ item, resp: null, erro: msg });
      }
    }

    // Se TODOS falharam, exibe erro critico (nao encerra a sessao)
    if (totalErros === itensMapa.length && itensMapa.length > 0) {
      setErroGeral(
        `Nenhum item foi salvo. Erro: ${primeiroErro}\n\n` +
        `Verifique se a sessao ainda esta em andamento e se os produtos estao cadastrados.`
      );
      setPendentes(novosPendentes);
      setConfirmados(novosConfirmados);
      setProcessando(false);
      return;
    }

    // Adiciona itens NAO BIPADOS à lista de pendentes da proxima rodada
    // Regra: produto com saldo no sistema mas sem contagem = precisa ser bipado
    if (rodada < 3) {
      try {
        const naoBipados = await listarPendentes(sessao.id);
        if (naoBipados && naoBipados.length > 0) {
          const extras = naoBipados.map(p => ({
            item: {
              codigoQr: p.codigo_qr || p.codigoQr || p.sku,
              sku: p.sku,
              descricao: p.descricao || p.sku,
              unidadeMedida: p.unidade_medida || p.unidadeMedida || 'UN',
              naoBipado: true,
              quantidadeSistema: p.quantidade_sistema,
            },
            resp: null,
            naoBipado: true,
          }));
          // Evita duplicata: nao adiciona se ja esta em novosPendentes
          const codigosJaPendentes = new Set(novosPendentes.map(p => p.item.codigoQr));
          const novosNaoBipados = extras.filter(e => !codigosJaPendentes.has(e.item.codigoQr));
          novosPendentes.push(...novosNaoBipados);
          console.log(`[ResumoScreen] ${novosNaoBipados.length} item(s) nao bipado(s) adicionados a proxima rodada`);
        }
      } catch (err) {
        console.warn('[ResumoScreen] Nao foi possivel buscar pendentes:', err.message);
      }
    }

    // Encerra a sessao automaticamente apenas quando:
    // - Nao ha mais pendentes (bipados sem divergencia E nenhum nao bipado)
    // - OU chegou na 3a rodada (limite das 3 contagens)
    const deveEncerrar = novosPendentes.length === 0 || rodada >= 3;

    if (deveEncerrar) {
      try {
        console.log('[ResumoScreen] Encerrando sessao (rodada=%d, pendentes=%d)', rodada, novosPendentes.length);
        await encerrarSessao(sessao.id);
        await gerarDivergencias(sessao.id);
        setSessaoEncerrada(true);
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('aguardando') || msg.includes('concluida') || err.status === 400) {
          setSessaoEncerrada(true); // ja encerrada
        } else {
          console.error('[ResumoScreen] Erro ao encerrar:', msg);
        }
      }
    }

    setPendentes(novosPendentes);
    setConfirmados(novosConfirmados);
    setProcessando(false);
  }

  function iniciarProximaRodada() {
    // Navega de volta ao Scanner com a proxima rodada e lista de pendentes
    navigation.navigate('Scanner', {
      sessao,
      loja,
      rodada: rodada + 1,
      itensPendentes: pendentes.map(p => ({
        codigoQr: p.item.codigoQr,
        sku: p.item.sku,
        descricao: p.item.descricao,
        unidadeMedida: p.item.unidadeMedida,
      })),
      resetContagens: true,
    });
  }

  if (processando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Registrando contagens...</Text>
        <Text style={estilos.textoCarregandoSub}>
          {contagens?.length > 0
            ? `${contagens.length} bipagem(ns) para ${new Set(contagens.map(c => c.codigoQr)).size} produto(s)`
            : ''}
        </Text>
      </SafeAreaView>
    );
  }

  // Conta itens com erro real (erro no campo, nao recontagem)
  const totalComErro = confirmados.filter(c => c.erro).length;
  const totalOk = confirmados.filter(c => !c.erro).length + pendentes.length;

  return (
    <SafeAreaView style={estilos.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={estilos.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner de sessao encerrada automaticamente */}
          {sessaoEncerrada && !erroGeral && (
            <View style={estilos.bannerSessaoEncerrada}>
              <Text style={estilos.bannerSessaoEncerradaTitulo}>Sessao encerrada</Text>
              <Text style={estilos.bannerSessaoEncerradaTexto}>
                O inventario foi finalizado. Nenhuma bipagem adicional e possivel nesta sessao.
                {'\n'}ADM/Gestor pode revisar as divergencias pelo menu da sessao.
              </Text>
            </View>
          )}

          {/* Banner de erro critico — aparece quando TODOS os itens falharam */}
          {erroGeral ? (
            <View style={estilos.bannerErroCritico}>
              <Text style={estilos.bannerErroCriticoTitulo}>Erro ao salvar contagens</Text>
              <Text style={estilos.bannerErroCriticoTexto}>{erroGeral}</Text>
              <TouchableOpacity style={estilos.botaoTentarNovamente} onPress={finalizarInventario}>
                <Text style={estilos.botaoTentarNovamenteTexto}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : totalComErro > 0 ? (
            <View style={estilos.bannerErrosParciais}>
              <Text style={estilos.bannerErrosParciaistTitulo}>
                {totalOk} salvo(s) · {totalComErro} com erro
              </Text>
              <Text style={estilos.bannerErrosParcisTexto}>
                Veja os itens em vermelho abaixo. Verifique se os produtos estao cadastrados.
              </Text>
            </View>
          ) : null}

          {/* Cabecalho da rodada */}
          <View style={estilos.cabecalho}>
            <Text style={estilos.cabecalhoTitulo}>
              {sessaoEncerrada
                ? 'Inventario finalizado!'
                : pendentes.length > 0
                  ? `${ORDINAL[rodada] || `${rodada}ª`} contagem concluida`
                  : 'Tudo conferido!'}
            </Text>
            <Text style={estilos.cabecalhoSubtitulo}>
              {confirmados.filter(c => !c.erro).length} ok · {pendentes.length} para recontar · {confirmados.filter(c => c.erro).length} erro(s)
            </Text>
          </View>

          {/* Itens que precisam de proxima contagem */}
          {pendentes.length > 0 && !sessaoEncerrada && (
            <View style={estilos.secao}>
              <Text style={estilos.secaoTitulo}>
                Para {ORDINAL[rodada + 1] || `${rodada + 1}ª`} contagem ({pendentes.length})
              </Text>
              {pendentes.map(({ item, naoBipado }) => (
                <View key={item.codigoQr}
                  style={[estilos.cardPendente, naoBipado && estilos.cardPendenteNaoBipado]}>
                  <View style={estilos.cardPendenteHeader}>
                    <View style={estilos.cardTextos}>
                      <Text style={estilos.cardNome} numberOfLines={1}>{item.descricao || item.codigoQr}</Text>
                      <Text style={estilos.cardSku}>{item.sku || item.codigoQr}</Text>
                    </View>
                    <View style={[estilos.badgeContagem,
                      naoBipado && { backgroundColor: colors.dangerSoft }]}>
                      <Text style={[estilos.badgeContagemTexto,
                        naoBipado && { color: colors.danger }]}>
                        {naoBipado ? 'NÃO BIPADO' : ORDINAL[rodada + 1] || `${rodada + 1}ª`}
                      </Text>
                    </View>
                  </View>
                  {naoBipado && item.quantidadeSistema != null && (
                    <Text style={estilos.cardNaoContadoInfo}>
                      Saldo sistema: {parseFloat(item.quantidadeSistema).toFixed(0)} {item.unidadeMedida}
                    </Text>
                  )}
                </View>
              ))}

              {/* Botao para iniciar proxima rodada (so aparece se rodada < 3) */}
              {rodada < 3 && (
                <>
                  <View style={{ height: spacing.md }} />
                  <Button
                    titulo={`Iniciar ${ORDINAL[rodada + 1] || `${rodada + 1}ª`} contagem com o scanner`}
                    onPress={iniciarProximaRodada}
                  />
                  <View style={{ height: spacing.xs }} />
                  <Text style={estilos.dica}>
                    Bipe novamente apenas os produtos listados acima.
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Itens confirmados */}
          {confirmados.length > 0 && (
            <View style={estilos.secao}>
              <Text style={estilos.secaoTitulo}>Confirmados ({confirmados.filter(c => !c.erro).length})</Text>
              {confirmados.map(({ item, resp, erro }) => (
                <CardConfirmado key={item.codigoQr} item={item} resp={resp} erro={erro} />
              ))}
            </View>
          )}

          <View style={{ height: spacing.xl }} />

          {/* Exportar so disponivel apos sessao encerrada */}
          {sessaoEncerrada && (
            <>
              <Button
                titulo={exportando ? 'Exportando...' : 'Exportar para Excel'}
                variante="secondary"
                carregando={exportando}
                onPress={async () => {
                  setExportando(true);
                  try {
                    await exportarSessao(sessao.id);
                  } catch (err) {
                    const msg = err?.message || 'Tente novamente';
                    if (Platform.OS === 'web') window.alert(`Erro ao exportar\n\n${msg}`);
                    else Alert.alert('Erro ao exportar', msg);
                  } finally {
                    setExportando(false);
                  }
                }}
              />
              <View style={{ height: spacing.sm }} />
            </>
          )}

          <Button
            titulo="Voltar para sessoes"
            variante="secondary"
            onPress={() => navigation.navigate('Sessoes', { loja })}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CardConfirmado({ item, resp, erro }) {
  if (erro) {
    return (
      <View style={[estilos.card, { borderLeftColor: colors.danger }]}>
        <Text style={estilos.cardNome}>{item.descricao || item.codigoQr}</Text>
        <Text style={estilos.textoErro}>{erro}</Text>
      </View>
    );
  }

  const primeiraContagem = resp.contagem.numero_contagem === 1;

  return (
    <View style={[estilos.card, { borderLeftColor: colors.success }]}>
      <View style={estilos.cardTopo}>
        <View style={estilos.cardTextos}>
          <Text style={estilos.cardNome}>{item.descricao || item.codigoQr}</Text>
          <Text style={estilos.cardSku}>{item.sku || item.codigoQr}</Text>
        </View>
        <View style={[estilos.badge, { backgroundColor: colors.successSoft }]}>
          <Text style={[estilos.badgeTexto, { color: colors.success }]}>OK</Text>
        </View>
      </View>

      <View style={estilos.cardLinha}>
        <Text style={estilos.cardLabel}>
          Contado ({resp.contagem.numero_contagem}ª vez)
        </Text>
        <Text style={estilos.cardValor}>
          {resp.contagem.quantidade_contada} {item.unidadeMedida}
        </Text>
      </View>

      {primeiraContagem && (
        <>
          <View style={estilos.cardLinha}>
            <Text style={estilos.cardLabel}>Sistema</Text>
            <Text style={estilos.cardValor}>
              {resp.quantidade_sistema} {item.unidadeMedida}
            </Text>
          </View>
          <View style={[estilos.cardLinha, estilos.cardLinhaDestaque]}>
            <Text style={estilos.cardLabel}>Diferenca</Text>
            <Text style={[
              estilos.cardValor,
              { color: resp.diferenca_vs_sistema === 0 ? colors.success : colors.warning },
            ]}>
              {resp.diferenca_vs_sistema > 0 ? '+' : ''}
              {resp.diferenca_vs_sistema} {item.unidadeMedida}
            </Text>
          </View>
        </>
      )}
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
  scroll: {
    padding: spacing.lg,
  },
  cabecalho: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  cabecalhoTitulo: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  cabecalhoSubtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  secao: {
    marginBottom: spacing.md,
  },
  secaoTitulo: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  secaoSubtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  // Card de item pendente de recontagem
  cardPendente: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    overflow: 'hidden',
  },
  cardPendenteNaoBipado: {
    borderLeftColor: colors.danger,
    backgroundColor: colors.dangerSoft + '22',
  },
  cardNaoContadoInfo: {
    fontSize: fontSize.xs,
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontStyle: 'italic',
  },
  cardPendenteAtivo: {
    borderColor: colors.warning,
    borderWidth: 2,
    borderLeftWidth: 4,
  },
  cardPendenteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  badgeContagem: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  badgeContagemTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  areaRecontagem: {
    padding: spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recontagemLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  inputGrande: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
  },
  // Card de item confirmado
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTextos: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardNome: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  cardSku: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  cardLinhaDestaque: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  cardLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cardValor: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  dica: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  textoErro: {
    fontSize: fontSize.sm,
    color: colors.danger,
    marginTop: 4,
  },
  bannerSessaoEncerrada: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  bannerSessaoEncerradaTitulo: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 4,
  },
  bannerSessaoEncerradaTexto: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  textoCarregandoSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Banner de erro critico (todos os itens falharam)
  bannerErroCritico: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  bannerErroCriticoTitulo: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  bannerErroCriticoTexto: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  botaoTentarNovamente: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  botaoTentarNovamenteTexto: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  // Banner de erros parciais (alguns itens falharam)
  bannerErrosParciais: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  bannerErrosParciaistTitulo: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: 4,
  },
  bannerErrosParcisTexto: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
});
