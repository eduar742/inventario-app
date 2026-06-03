import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import {
  registrarContagem,
  encerrarSessao,
  gerarDivergencias,
  listarPendentes,
  listarDivergencias,
} from '../services/api';
import { exportarSessao } from '../services/exportacao';

const ORDINAL = { 1: '1ª', 2: '2ª', 3: '3ª' };

function _fmtNum(v) {
  if (v == null) return '—';
  const n = parseFloat(v);
  return (n > 0 ? '+' : '') + n.toFixed(0);
}

export default function ResumoScreen({ navigation, route }) {
  const { contagens, sessao, loja } = route.params;
  const rodada = route.params?.rodada ?? 1;

  const [processando, setProcessando] = useState(true);
  const [confirmados, setConfirmados] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [erroGeral, setErroGeral] = useState('');
  const [sessaoEncerrada, setSessaoEncerrada] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  // M2: divergencias carregadas apos encerramento
  const [divergencias, setDivergencias] = useState([]);
  const [carregandoDivs, setCarregandoDivs] = useState(false);

  useEffect(() => {
    finalizarInventario();
  }, []);

  async function carregarDivergencias(sessaoId) {
    setCarregandoDivs(true);
    try {
      const divs = await listarDivergencias(sessaoId);
      setDivergencias(divs || []);
    } catch (_) {}
    finally { setCarregandoDivs(false); }
  }

  async function encerrarSessaoAgora() {
    setEncerrando(true);
    try {
      await encerrarSessao(sessao.id);
      await gerarDivergencias(sessao.id);
      setSessaoEncerrada(true);
      carregarDivergencias(sessao.id);
    } catch (err) {
      const msg = err.message || '';
      // Ja encerrada por outro processo
      if (msg.includes('aguardando') || msg.includes('concluida') || err.status === 400) {
        setSessaoEncerrada(true);
        carregarDivergencias(sessao.id);
      } else {
        if (Platform.OS === 'web') window.alert(`Erro ao encerrar\n\n${msg}`);
        else Alert.alert('Erro ao encerrar', msg);
      }
    } finally {
      setEncerrando(false);
    }
  }

  async function finalizarInventario() {
    setProcessando(true);
    setErroGeral('');

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
          codigoQr: c.codigoQr, sku: c.sku, descricao: c.descricao,
          unidadeMedida: c.unidadeMedida, quantidadeTotal: 0, obsLista: [],
        };
      }
      mapa[c.codigoQr].quantidadeTotal += c.quantidade;
      if (c.observacoes) mapa[c.codigoQr].obsLista.push(c.observacoes);
    }

    const novosPendentes = [];
    const novosConfirmados = [];
    let totalErros = 0;
    let primeiroErro = '';

    for (const item of Object.values(mapa)) {
      try {
        const obs = item.obsLista.length > 0 ? item.obsLista.join('; ') : null;
        const resp = await registrarContagem({
          sessaoId: sessao.id, codigoQr: item.codigoQr,
          quantidadeContada: item.quantidadeTotal,
          localizacao: item.localizacao || null,
          observacoes: obs,
        });
        if (resp.status_produto === 'aguardando_recontagem') {
          novosPendentes.push({ item, resp });
        } else {
          novosConfirmados.push({ item, resp, erro: null });
        }
      } catch (err) {
        totalErros++;
        const msg = err.message || 'Erro desconhecido';
        if (!primeiroErro) primeiroErro = msg;
        novosConfirmados.push({ item, resp: null, erro: msg });
      }
    }

    if (totalErros === Object.keys(mapa).length && Object.keys(mapa).length > 0) {
      setErroGeral(
        `Nenhum item foi salvo. Erro: ${primeiroErro}\n\n` +
        `Verifique se a sessao ainda esta em andamento e se os produtos estao cadastrados.`
      );
      setPendentes(novosPendentes);
      setConfirmados(novosConfirmados);
      setProcessando(false);
      return;
    }

    // Busca nao-bipados para proxima rodada
    if (rodada < 3) {
      try {
        const naoBipados = await listarPendentes(sessao.id);
        if (naoBipados && naoBipados.length > 0) {
          const extras = naoBipados.map(p => ({
            item: {
              codigoQr: p.codigo_qr || p.sku, sku: p.sku,
              descricao: p.descricao || p.sku, unidadeMedida: p.unidade_medida || 'UN',
              naoBipado: true, quantidadeSistema: p.quantidade_sistema,
            },
            resp: null, naoBipado: true,
          }));
          const codigosJaPendentes = new Set(novosPendentes.map(p => p.item.codigoQr));
          novosPendentes.push(...extras.filter(e => !codigosJaPendentes.has(e.item.codigoQr)));
        }
      } catch (_) {}
    }

    // M1: encerra automaticamente quando nao ha pendentes ou chegou na 3a rodada
    const deveEncerrar = novosPendentes.length === 0 || rodada >= 3;

    if (deveEncerrar) {
      try {
        await encerrarSessao(sessao.id);
        await gerarDivergencias(sessao.id);
        setSessaoEncerrada(true);
        // M2: carrega divergencias para exibir lista de diferenças
        carregarDivergencias(sessao.id);
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('aguardando') || msg.includes('concluida') || err.status === 400) {
          setSessaoEncerrada(true);
          carregarDivergencias(sessao.id);
        }
      }
    }

    setPendentes(novosPendentes);
    setConfirmados(novosConfirmados);
    setProcessando(false);
  }

  function iniciarProximaRodada() {
    navigation.navigate('Scanner', {
      sessao, loja, rodada: rodada + 1,
      itensPendentes: pendentes.map(p => ({
        codigoQr: p.item.codigoQr, sku: p.item.sku,
        descricao: p.item.descricao, unidadeMedida: p.item.unidadeMedida,
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

  const totalComErro = confirmados.filter(c => c.erro).length;
  const totalOk = confirmados.filter(c => !c.erro).length;

  // M2: separa divergencias com e sem diferenca
  const divsComDif  = divergencias.filter(d => parseFloat(d.diferenca || 0) !== 0);
  const divsSemDif  = divergencias.filter(d => parseFloat(d.diferenca || 0) === 0);

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">

        {/* Banner sessao encerrada */}
        {sessaoEncerrada && !erroGeral && (
          <View style={estilos.bannerSessaoEncerrada}>
            <Text style={estilos.bannerSessaoEncerradaTitulo}>Inventario finalizado!</Text>
            <Text style={estilos.bannerSessaoEncerradaTexto}>
              Sessao encerrada. O scanner esta bloqueado.{'\n'}
              ADM/Gestor revisara as divergencias para concluir o inventario.
            </Text>
          </View>
        )}

        {/* Erro critico */}
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

        {/* Cabecalho */}
        <View style={estilos.cabecalho}>
          <Text style={estilos.cabecalhoTitulo}>
            {sessaoEncerrada
              ? 'Inventario finalizado!'
              : pendentes.length > 0
                ? `${ORDINAL[rodada] || `${rodada}ª`} contagem concluida`
                : 'Tudo conferido!'}
          </Text>
          <Text style={estilos.cabecalhoSubtitulo}>
            {confirmados.filter(c => !c.erro).length} ok · {pendentes.length} para recontar · {totalComErro} erro(s)
          </Text>
        </View>

        {/* M2: Lista de divergencias apos encerramento */}
        {sessaoEncerrada && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>
              Resumo do inventario inventariado
            </Text>
            {carregandoDivs ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : divergencias.length === 0 ? (
              <View style={[estilos.cardDivSemDif]}>
                <Text style={[estilos.cardDivTexto, { color: colors.success }]}>
                  Nenhuma divergencia registrada nesta sessao.
                </Text>
              </View>
            ) : (
              <>
                {/* Produtos COM diferenca */}
                {divsComDif.length > 0 && (
                  <>
                    <Text style={[estilos.secaoSubTitulo, { color: colors.warning }]}>
                      {divsComDif.length} produto(s) com diferenca
                    </Text>
                    {divsComDif.map(div => (
                      <CardDivergencia key={div.id} div={div} />
                    ))}
                  </>
                )}
                {/* Produtos SEM diferenca (nao bipados) */}
                {divsSemDif.length > 0 && (
                  <>
                    <Text style={[estilos.secaoSubTitulo, { color: colors.textSecondary }]}>
                      {divsSemDif.length} produto(s) nao bipado(s)
                    </Text>
                    {divsSemDif.map(div => (
                      <CardDivergencia key={div.id} div={div} />
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* Pendentes de recontagem */}
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
                  <View style={[estilos.badgeContagem, naoBipado && { backgroundColor: colors.dangerSoft }]}>
                    <Text style={[estilos.badgeContagemTexto, naoBipado && { color: colors.danger }]}>
                      {naoBipado ? 'NAO BIPADO' : ORDINAL[rodada + 1] || `${rodada + 1}ª`}
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

            {rodada < 3 && (
              <>
                <View style={{ height: spacing.md }} />
                <Button
                  titulo={`Iniciar ${ORDINAL[rodada + 1] || `${rodada + 1}ª`} contagem com o scanner`}
                  onPress={iniciarProximaRodada}
                />
              </>
            )}

            {/* M1: botao para finalizar mesmo com pendentes */}
            <View style={{ height: spacing.sm }} />
            <Button
              titulo={encerrando ? 'Encerrando...' : 'Finalizar inventario agora'}
              variante="secondary"
              carregando={encerrando}
              onPress={() => {
                const msg = `Ainda ha ${pendentes.length} produto(s) pendente(s).\n\nAo finalizar agora, eles serao registrados como nao bipados. Deseja continuar?`;
                if (Platform.OS === 'web') {
                  if (window.confirm(`Finalizar inventario?\n\n${msg}`)) encerrarSessaoAgora();
                } else {
                  Alert.alert('Finalizar inventario?', msg, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Finalizar agora', style: 'destructive', onPress: encerrarSessaoAgora },
                  ]);
                }
              }}
            />
            <Text style={estilos.dica}>
              Ao finalizar agora, os pendentes serao marcados como nao bipados.
            </Text>
          </View>
        )}

        {/* Confirmados */}
        {confirmados.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Confirmados ({confirmados.filter(c => !c.erro).length})</Text>
            {confirmados.map(({ item, resp, erro }) => (
              <CardConfirmado key={item.codigoQr} item={item} resp={resp} erro={erro} />
            ))}
          </View>
        )}

        <View style={{ height: spacing.xl }} />

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
    </SafeAreaView>
  );
}

// M2: card de divergencia individual
function CardDivergencia({ div }) {
  const diferenca = parseFloat(div.diferenca || 0);
  const temDif = diferenca !== 0;
  const corBorda = temDif ? (diferenca > 0 ? colors.warning : colors.danger) : colors.border;
  return (
    <View style={[estilos.cardDiv, { borderLeftColor: corBorda }]}>
      <View style={estilos.cardDivTopo}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={estilos.cardDivNome} numberOfLines={2}>{div.descricao_produto || div.sku}</Text>
          <Text style={estilos.cardDivSku}>{div.sku}</Text>
        </View>
        {temDif && (
          <Text style={[estilos.cardDivDif, { color: diferenca > 0 ? colors.warning : colors.danger }]}>
            {_fmtNum(diferenca)} {div.unidade_medida || ''}
          </Text>
        )}
      </View>
      <View style={estilos.cardDivNums}>
        <View style={estilos.cardDivNum}>
          <Text style={estilos.cardDivNumVal}>{_fmtNum(div.quantidade_sistema)}</Text>
          <Text style={estilos.cardDivNumLabel}>Sistema</Text>
        </View>
        <View style={estilos.cardDivSep} />
        <View style={estilos.cardDivNum}>
          <Text style={estilos.cardDivNumVal}>{_fmtNum(div.quantidade_final)}</Text>
          <Text style={estilos.cardDivNumLabel}>Contado</Text>
        </View>
        <View style={estilos.cardDivSep} />
        <View style={estilos.cardDivNum}>
          <Text style={[estilos.cardDivNumVal, {
            color: !temDif ? colors.success : diferenca > 0 ? colors.warning : colors.danger
          }]}>
            {_fmtNum(diferenca)}
          </Text>
          <Text style={estilos.cardDivNumLabel}>Diferenca</Text>
        </View>
      </View>
    </View>
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
  const primeiraContagem = resp?.contagem?.numero_contagem === 1;
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
        <Text style={estilos.cardLabel}>Contado ({resp?.contagem?.numero_contagem}ª vez)</Text>
        <Text style={estilos.cardValor}>{resp?.contagem?.quantidade_contada} {item.unidadeMedida}</Text>
      </View>
      {primeiraContagem && resp && (
        <>
          <View style={estilos.cardLinha}>
            <Text style={estilos.cardLabel}>Sistema</Text>
            <Text style={estilos.cardValor}>{resp.quantidade_sistema} {item.unidadeMedida}</Text>
          </View>
          <View style={[estilos.cardLinha, estilos.cardLinhaDestaque]}>
            <Text style={estilos.cardLabel}>Diferenca</Text>
            <Text style={[estilos.cardValor, {
              color: resp.diferenca_vs_sistema === 0 ? colors.success : colors.warning,
            }]}>
              {resp.diferenca_vs_sistema > 0 ? '+' : ''}{resp.diferenca_vs_sistema} {item.unidadeMedida}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  textoCarregandoSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  scroll: { padding: spacing.lg },
  cabecalho: { marginBottom: spacing.lg, alignItems: 'center' },
  cabecalhoTitulo: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  cabecalhoSubtitulo: { fontSize: fontSize.sm, color: colors.textSecondary },
  secao: { marginBottom: spacing.md },
  secaoTitulo: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  secaoSubTitulo: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  // Card de divergencia (M2)
  cardDiv: {
    backgroundColor: colors.background, borderRadius: radius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, overflow: 'hidden',
  },
  cardDivTopo: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingBottom: spacing.xs },
  cardDivNome: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  cardDivSku: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cardDivDif: { fontSize: fontSize.lg, fontWeight: '800' },
  cardDivNums: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  cardDivNum: { flex: 1, alignItems: 'center' },
  cardDivSep: { width: 1, backgroundColor: colors.border },
  cardDivNumVal: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  cardDivNumLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cardDivSemDif: {
    backgroundColor: colors.successSoft, borderRadius: radius.md,
    padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.success,
  },
  cardDivTexto: { fontSize: fontSize.sm, fontWeight: '600' },
  // Card de item pendente
  cardPendente: {
    backgroundColor: colors.background, borderRadius: radius.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  cardPendenteNaoBipado: { borderLeftColor: colors.danger },
  cardNaoContadoInfo: { fontSize: fontSize.xs, color: colors.danger, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  cardPendenteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  badgeContagem: {
    backgroundColor: colors.warningSoft, paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.sm, marginLeft: spacing.sm,
  },
  badgeContagemTexto: { fontSize: 11, fontWeight: '700', color: colors.warning },
  // Card confirmado
  card: {
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderLeftWidth: 4, borderWidth: 1, borderColor: colors.border,
  },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  cardTextos: { flex: 1, marginRight: spacing.sm },
  cardNome: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  cardSku: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeTexto: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  cardLinhaDestaque: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
  cardLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  cardValor: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  // Banners
  bannerSessaoEncerrada: {
    backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.success,
  },
  bannerSessaoEncerradaTitulo: { fontSize: fontSize.md, fontWeight: '700', color: colors.success, marginBottom: 4 },
  bannerSessaoEncerradaTexto: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  bannerErroCritico: {
    backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.lg,
    marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.danger,
  },
  bannerErroCriticoTitulo: { fontSize: fontSize.md, fontWeight: '700', color: colors.danger, marginBottom: spacing.xs },
  bannerErroCriticoTexto: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20, marginBottom: spacing.md },
  botaoTentarNovamente: { backgroundColor: colors.danger, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  botaoTentarNovamenteTexto: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  bannerErrosParciais: {
    backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  bannerErrosParciaistTitulo: { fontSize: fontSize.md, fontWeight: '700', color: colors.warning, marginBottom: 4 },
  bannerErrosParcisTexto: { fontSize: fontSize.sm, color: colors.text },
  dica: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
