import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import {
  registrarContagem,
  encerrarSessao,
  gerarDivergencias,
  processarRodada,
  pegarUsuario,
  buscarPerfilAtual,
} from '../services/api';
import { avisar, confirmar as confirmarAlerta } from '../utils/alertas';

const ORDINAL = { 1: '1ª', 2: '2ª', 3: '3ª' };

export default function ResumoScreen({ navigation, route }) {
  const { contagens, sessao, loja } = route.params;
  const rodada = route.params?.rodada ?? 1;

  const [processando, setProcessando] = useState(true);
  const [totalSalvos, setTotalSalvos] = useState(0);
  const [pendentes, setPendentes] = useState([]);
  const [papel, setPapel] = useState('operador');
  const [erroGeral, setErroGeral] = useState('');
  const [sessaoEncerrada, setSessaoEncerrada] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  // Conjunto de indices ja salvos — evita duplo envio em retentativas
  const itensSalvosRef = React.useRef(new Set());

  useEffect(() => {
    finalizarInventario();
    carregarPapel();
  }, []);

  async function carregarPapel() {
    try {
      let usuario = await pegarUsuario();
      if (!usuario?.papel) usuario = await buscarPerfilAtual();
      setPapel(usuario?.papel || 'operador');
    } catch (_) {}
  }

  // Encerramento forcado quando operador clica em "Finalizar agora" com pendentes
  async function encerrarSessaoAgora() {
    setEncerrando(true);
    try {
      await encerrarSessao(sessao.id);
      await gerarDivergencias(sessao.id);
      setSessaoEncerrada(true);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('aguardando') || msg.includes('concluida') || err.status === 400) {
        setSessaoEncerrada(true);
      } else {
        avisar('Erro ao encerrar', msg);
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

    let totalErros = 0;
    let primeiroErro = '';
    let salvos = itensSalvosRef.current.size;

    // Envia cada bipagem individualmente — o backend soma por produto/rodada
    for (let i = 0; i < contagens.length; i++) {
      if (itensSalvosRef.current.has(i)) continue;

      const item = contagens[i];
      try {
        await registrarContagem({
          sessaoId: sessao.id,
          codigoQr: item.codigoQr,
          quantidadeContada: item.quantidade,
          observacoes: item.observacoes || null,
          rodada: item.rodada || rodada,
        });
        itensSalvosRef.current.add(i);
        salvos++;
      } catch (err) {
        totalErros++;
        const msg = err.message || 'Erro desconhecido';
        if (!primeiroErro) primeiroErro = msg;
      }
    }

    setTotalSalvos(salvos);

    if (totalErros > 0) {
      const ehColdStart = primeiroErro.includes('inesperada') || primeiroErro.includes('demorou');
      setErroGeral(
        ehColdStart
          ? `O servidor demorou para responder (pode estar iniciando).\n\nAguarde alguns segundos e tente novamente.`
          : `${totalErros} item(ns) nao foram salvos. Erro: ${primeiroErro}\n\nTente novamente para reenviar apenas os itens com erro.`
      );
      setProcessando(false);
      return;
    }

    // Solicita ao backend o processamento da rodada: calcula totais, detecta pendentes
    try {
      const resultado = await processarRodada(sessao.id, rodada);
      if (resultado.sessao_encerrada) {
        setSessaoEncerrada(true);
      } else {
        setPendentes(resultado.pendentes || []);
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('aguardando') || msg.includes('concluida') || err.status === 400) {
        setSessaoEncerrada(true);
      } else {
        avisar('Erro ao processar rodada', msg);
      }
    }

    setProcessando(false);
  }

  // Cada item pendente traz "motivo" (nao_contado | divergente) e
  // "proxima_rodada" (calculada pelo backend a partir da sequencia real de
  // contagens do produto, nao do numero global da rodada) — usados aqui pra
  // separar em 3 grupos distintos, cada um com a rodada certa pra reabrir o Scanner.
  const naoContados  = pendentes.filter(p => p.motivo === 'nao_contado');
  const aguardando2  = pendentes.filter(p => p.motivo === 'divergente' && p.proxima_rodada === 2);
  const aguardando3  = pendentes.filter(p => p.motivo === 'divergente' && p.proxima_rodada === 3);
  const podeDesempatar = papel === 'lider' || papel === 'admin';

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

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">

        {/* Banner sessao encerrada */}
        {sessaoEncerrada && !erroGeral && (
          <View style={estilos.bannerSessaoEncerrada}>
            <Text style={estilos.bannerSessaoEncerradaTitulo}>Inventario finalizado!</Text>
            <Text style={estilos.bannerSessaoEncerradaTexto}>
              Sessao encerrada com sucesso.{'\n'}
              O gestor revisara as divergencias para concluir o inventario.
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
        ) : null}

        {/* Cabecalho */}
        {!erroGeral && (
          <View style={estilos.cabecalho}>
            <Text style={estilos.cabecalhoTitulo}>
              {sessaoEncerrada
                ? 'Inventario finalizado!'
                : pendentes.length > 0
                  ? `${ORDINAL[rodada] || `${rodada}ª`} contagem concluida`
                  : 'Tudo conferido!'}
            </Text>
            <Text style={estilos.cabecalhoSubtitulo}>
              {totalSalvos} item(ns) registrado(s)
              {pendentes.length > 0 ? ` · ${pendentes.length} para proxima rodada` : ''}
            </Text>
          </View>
        )}

        {/* Itens que faltou bipar — nunca tiveram nenhuma contagem */}
        {naoContados.length > 0 && !sessaoEncerrada && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>
              Itens que faltou bipar ({naoContados.length})
            </Text>
            {naoContados.map((item) => (
              <View key={item.codigo_qr} style={[estilos.cardPendente, { borderLeftColor: colors.danger }]}>
                <Text style={estilos.cardNome} numberOfLines={2}>{item.descricao || item.sku}</Text>
                <Text style={estilos.cardSku}>{item.sku}</Text>
              </View>
            ))}
            <View style={{ height: spacing.md }} />
            <Button titulo="Bipar itens que faltaram" onPress={() => iniciarContagem(1, naoContados)} />
          </View>
        )}

        {/* Itens contados mas divergentes — aguardando 2a contagem */}
        {aguardando2.length > 0 && !sessaoEncerrada && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>
              Aguardando 2ª contagem ({aguardando2.length})
            </Text>
            {aguardando2.map((item) => (
              <View key={item.codigo_qr} style={estilos.cardPendente}>
                <Text style={estilos.cardNome} numberOfLines={2}>{item.descricao || item.sku}</Text>
                <Text style={estilos.cardSku}>{item.sku}</Text>
              </View>
            ))}
            <View style={{ height: spacing.md }} />
            <Button titulo="Iniciar 2ª contagem" onPress={() => iniciarContagem(2, aguardando2)} />
          </View>
        )}

        {/* Itens que nao convergiram entre 1a e 2a — aguardando desempate (so lider/admin) */}
        {aguardando3.length > 0 && !sessaoEncerrada && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>
              Aguardando 3ª contagem — desempate ({aguardando3.length})
            </Text>
            {aguardando3.map((item) => (
              <View key={item.codigo_qr} style={[estilos.cardPendente, { borderLeftColor: colors.info }]}>
                <Text style={estilos.cardNome} numberOfLines={2}>{item.descricao || item.sku}</Text>
                <Text style={estilos.cardSku}>{item.sku}</Text>
              </View>
            ))}
            <View style={{ height: spacing.md }} />
            {podeDesempatar ? (
              <Button titulo="Iniciar 3ª contagem (desempate)" onPress={() => iniciarContagem(3, aguardando3)} />
            ) : (
              <Text style={estilos.dica}>
                Apenas um usuario com papel Lider pode fazer o desempate.
              </Text>
            )}
          </View>
        )}

        {pendentes.length > 0 && !sessaoEncerrada && (
          <View style={estilos.secao}>
            <Button
              titulo={encerrando ? 'Encerrando...' : 'Finalizar inventario agora'}
              variante="secondary"
              carregando={encerrando}
              onPress={() => {
                const msg = `Ainda ha ${pendentes.length} produto(s) pendente(s).\n\nAo finalizar agora, o gestor decidira sobre as divergencias. Deseja continuar?`;
                confirmarAlerta('Finalizar inventario?', msg)
                  .then(ok => { if (ok) encerrarSessaoAgora(); });
              }}
            />
            <Text style={estilos.dica}>
              Ao finalizar agora, o gestor revisara os itens pendentes.
            </Text>
          </View>
        )}

        <View style={{ height: spacing.xl }} />

        <Button
          titulo="Voltar para sessoes"
          variante="secondary"
          onPress={() => navigation.navigate('Sessoes', { loja })}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  textoCarregando: {
    marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary,
  },
  textoCarregandoSub: {
    fontSize: fontSize.xs, color: colors.textMuted,
    marginTop: spacing.xs, textAlign: 'center',
  },
  scroll: { padding: spacing.lg },
  cabecalho: { marginBottom: spacing.lg, alignItems: 'center' },
  cabecalhoTitulo: {
    fontSize: fontSize.xl, fontWeight: '700', color: colors.text,
    textAlign: 'center', marginBottom: spacing.xs,
  },
  cabecalhoSubtitulo: { fontSize: fontSize.sm, color: colors.textSecondary },
  secao: { marginBottom: spacing.md },
  secaoTitulo: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  cardPendente: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  cardNome: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  cardSku: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  bannerSessaoEncerrada: {
    backgroundColor: colors.successSoft, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderLeftWidth: 4, borderLeftColor: colors.success,
  },
  bannerSessaoEncerradaTitulo: {
    fontSize: fontSize.md, fontWeight: '700', color: colors.success, marginBottom: 4,
  },
  bannerSessaoEncerradaTexto: {
    fontSize: fontSize.sm, color: colors.text, lineHeight: 20,
  },
  bannerErroCritico: {
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: spacing.lg, marginBottom: spacing.md,
    borderLeftWidth: 4, borderLeftColor: colors.danger,
  },
  bannerErroCriticoTitulo: {
    fontSize: fontSize.md, fontWeight: '700', color: colors.danger, marginBottom: spacing.xs,
  },
  bannerErroCriticoTexto: {
    fontSize: fontSize.sm, color: colors.text, lineHeight: 20, marginBottom: spacing.md,
  },
  botaoTentarNovamente: {
    backgroundColor: colors.danger, borderRadius: radius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  botaoTentarNovamenteTexto: {
    color: colors.white, fontWeight: '700', fontSize: fontSize.sm,
  },
  dica: {
    fontSize: fontSize.xs, color: colors.textMuted,
    textAlign: 'center', marginTop: spacing.xs,
  },
});
