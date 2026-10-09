// Tela do scanner de QR Code.
// O operador aponta a camera para o QR do produto e o sistema le automaticamente.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AppState,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { limparCodigoQr } from '../utils/qrCode';
import {
  entrarSessao, heartbeatSessao, sairSessao, buscarSessao,
  listarPendentes, listarRecontagemNecessaria,
} from '../services/api';

// Chave de comparacao de codigos (etiqueta bipada x codigo/sku do produto)
const chaveCodigo = (c) => String(c || '').trim().toUpperCase();

// Sufixos de ordinal feminino (contagem)
const ORDINAL = { 1: '1ª', 2: '2ª', 3: '3ª' };

// Intervalo do heartbeat de presenca — por tempo, nao por acao do operador,
// entao continua rodando igual mesmo se ele demorar preenchendo um item na
// tela de Contagem (este componente fica montado por baixo o tempo todo).
const INTERVALO_HEARTBEAT = 60000;

// Ao voltar da tela de Contagem, a etiqueta que acabou de ser lancada costuma
// continuar na frente da camera. Durante este tempo o MESMO codigo e ignorado
// (outro codigo le normalmente). Depois disso, rebipar o mesmo produto (outra
// localizacao) volta a funcionar.
const BLOQUEIO_MESMO_CODIGO_MS = 3000;

export default function ScannerScreen({ navigation, route }) {
  const { sessao, loja } = route.params;
  // rodada: 1 = primeira contagem, 2 = recontagem, 3 = desempate
  const rodada = route.params?.rodada ?? 1;
  // Lista de itens que precisam ser contados nesta rodada (vazia na 1a)
  const itensPendentes = route.params?.itensPendentes ?? [];

  const [permissao, solicitarPermissao] = useCameraPermissions();
  const [escaneado, setEscaneado] = useState(false);
  const [flash, setFlash] = useState(false);
  const ultimoCodigoRef = useRef(null);
  // Ate quando o ultimo codigo fica bloqueado (Infinity enquanto a Contagem
  // dele esta aberta; BLOQUEIO_MESMO_CODIGO_MS depois de voltar)
  const bloqueioAteRef = useRef(0);
  // A tela de Scanner continua montada (com a camera ligada) por baixo da
  // Contagem. Sem checar o foco, a camera lia de novo a etiqueta enquanto o
  // operador digitava a quantidade e empilhava uma 2a Contagem do mesmo item:
  // ao "Adicionar inventario" ele caia nela e recebia "item ja coletado".
  const focado = useIsFocused();
  const [modalVisivel, setModalVisivel] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [contagens, setContagens] = useState([]);
  // Modal de lista completa de pendentes (Bug 5)
  const [modalListaPendentes, setModalListaPendentes] = useState(false);

  // Reseta a lista de contagens quando uma nova rodada começa
  useEffect(() => {
    if (route.params?.resetContagens) {
      setContagens([]);
      navigation.setParams({ resetContagens: undefined });
    }
  }, [route.params?.resetContagens]);

  // Presenca na sessao: entra ao montar, manda heartbeat periodico enquanto
  // estiver aqui (mesmo com Contagem/Resumo empilhados por cima — este
  // componente continua montado por baixo) e sai ao desmontar (operador
  // apertou "Voltar" ou a pilha foi resetada de volta para "Sessoes"). Usado
  // pelo Lider/Gestor para saber quando pode liberar a 2a contagem.
  // Best-effort: falha de rede aqui nao pode travar o fluxo de bipagem.
  useEffect(() => {
    entrarSessao(sessao.id).catch(() => {});
    const intervalo = setInterval(() => {
      heartbeatSessao(sessao.id).catch(() => {});
      atualizarProgresso();
    }, INTERVALO_HEARTBEAT);
    return () => {
      clearInterval(intervalo);
      sairSessao(sessao.id).catch(() => {});
    };
  }, [sessao.id]);

  // Progresso vindo da API (fonte da verdade). A lista `contagens` acima vive
  // so na memoria desta visita: se o celular bloqueia, o navegador costuma
  // descarregar a aba e ao voltar a pagina recarrega — o contador zerava
  // ("Bipados 1 / Faltam 101") embora tudo estivesse gravado no servidor.
  const [progressoServidor, setProgressoServidor] = useState(null);

  // Codigos que o SERVIDOR ainda considera pendentes nesta rodada (todos os
  // operadores). null = ainda nao carregou / sem rede: usa so o que este
  // celular bipou. Mesma regra da tela "Itens pendentes".
  const [pendentesServidor, setPendentesServidor] = useState(null);

  const atualizarPendentes = useCallback(async () => {
    if (itensPendentes.length === 0) return;
    try {
      let itens;
      if (rodada === 1) {
        itens = await listarPendentes(sessao.id);
      } else {
        const lista = await listarRecontagemNecessaria(sessao.id);
        itens = (lista || []).filter(item => {
          const rodadas = new Set((item.contagens || []).map(c => c.rodada || 1));
          // 2a contagem: so tem a 1a rodada; 3a: tem duas rodadas e falta a 3a
          return rodada === 2 ? rodadas.size < 2 : (rodadas.size >= 2 && !rodadas.has(3));
        });
      }
      const chaves = new Set();
      for (const p of itens || []) {
        chaves.add(chaveCodigo(p.codigo_qr));
        chaves.add(chaveCodigo(p.sku));
      }
      setPendentesServidor(chaves);
    } catch (_) {
      // Best-effort: sem rede, mantem a ultima lista
    }
  }, [sessao.id, rodada, itensPendentes.length]);

  const atualizarProgresso = useCallback(async () => {
    atualizarPendentes();
    try {
      const s = await buscarSessao(sessao.id);
      setProgressoServidor({
        rodada: s.rodada_atual,
        total: s.total_produtos_rodada_atual,
        contados: s.total_produtos_contados_rodada_atual,
      });
    } catch (_) {
      // Best-effort: sem rede, mantem o ultimo valor (ou o contador local)
    }
  }, [sessao.id, atualizarPendentes]);

  // Recarrega ao entrar/voltar para a tela e quando o app volta do
  // bloqueio de tela (no navegador, AppState segue a visibilidade da aba)
  useFocusEffect(useCallback(() => {
    atualizarProgresso();
    // Voltou para a camera: libera a leitura, mas segura o ultimo codigo por
    // alguns segundos (a etiqueta ainda esta na frente da camera)
    if (bloqueioAteRef.current === Infinity) {
      bloqueioAteRef.current = Date.now() + BLOQUEIO_MESMO_CODIGO_MS;
    }
    setEscaneado(false);
  }, [atualizarProgresso]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') atualizarProgresso();
    });
    return () => sub?.remove?.();
  }, [atualizarProgresso]);

  // Chamado pela tela de Contagem depois que ela ja registrou a bipagem na
  // API — aqui so acumulamos localmente para detectar itens repetidos nesta
  // rodada (multi-localizacao) e atualizamos o progresso a partir da API.
  function adicionarContagem(novaContagem) {
    setContagens(prev => [...prev, novaContagem]);
    atualizarProgresso();
  }

  useEffect(() => {
    if (!permissao) return;
    if (!permissao.granted && permissao.canAskAgain) {
      solicitarPermissao();
    }
  }, [permissao]);

  function confirmarCodigoManual() {
    const codigo = limparCodigoQr(codigoManual);
    if (!codigo) return;
    setModalVisivel(false);
    navigation.navigate('Contagem', {
      codigoQr: codigo,
      sessao,
      loja,
      rodada,
      onAdicionar: adicionarContagem,
      jaContadoNestaRodada: contagens.some(c => c.codigoQr === codigo),
    });
  }

  const skusUnicos = new Set(contagens.map(c => c.codigoQr)).size;

  // Lista de pendentes da rodada: o item SAI da lista assim que a quantidade
  // e confirmada (por este celular, na hora; por outro operador, na proxima
  // atualizacao com o servidor — a cada bipagem, ao voltar para a camera e a
  // cada minuto).
  const bipadosAqui = new Set(contagens.map(c => chaveCodigo(c.codigoQr)));
  const pendentesRestantes = itensPendentes.filter(item => {
    const chaves = [chaveCodigo(item.codigoQr), chaveCodigo(item.sku)].filter(Boolean);
    if (chaves.some(k => bipadosAqui.has(k))) return false;
    if (pendentesServidor && !chaves.some(k => pendentesServidor.has(k))) return false;
    return true;
  });

  // Progresso da RODADA. Preferencia: o que a API calcula para a rodada atual
  // da sessao (sobrevive a recarga da pagina e soma todos os operadores).
  // Reserva (sem rede / rodada diferente): contador local desta visita —
  // com lista de itens (2a contagem, desempate, "bipar itens que faltaram")
  // o universo e so essa lista, nao o total de SKUs da sessao.
  const temListaRodada = itensPendentes.length > 0;
  const usaServidor = !!progressoServidor && progressoServidor.rodada === rodada && progressoServidor.total > 0;
  const totalRodada = usaServidor
    ? progressoServidor.total
    : (temListaRodada ? itensPendentes.length : (sessao.total_produtos_loja ?? 0));
  const bipadosRodada = usaServidor
    ? progressoServidor.contados
    : (temListaRodada
      ? itensPendentes.filter(p => contagens.some(c => c.codigoQr === p.codigoQr)).length
      : skusUnicos);
  // Mostra a barra (e o "Finalizar") se ha qualquer bipagem: desta visita ou
  // ja registrada no servidor antes de uma recarga da pagina
  const temBipagens = contagens.length > 0 || (usaServidor && bipadosRodada > 0);

  function handleFinalizar() {
    navigation.navigate('Resumo', { contagens, sessao, loja, rodada, contadosServidor: usaServidor ? bipadosRodada : 0 });
  }

  // Calcula total ja acumulado para um QR code especifico
  function totalAcumulado(codigoQr) {
    return contagens
      .filter(c => c.codigoQr === codigoQr)
      .reduce((soma, c) => soma + (c.quantidade || 0), 0);
  }

  function handleBarCodeScanned({ data }) {
    const codigo = limparCodigoQr(data);
    if (!codigo) return;
    if (!focado || escaneado) return;
    if (codigo === ultimoCodigoRef.current && Date.now() < bloqueioAteRef.current) return;
    setEscaneado(true);
    ultimoCodigoRef.current = codigo;
    bloqueioAteRef.current = Infinity; // ate voltar da Contagem (ver useFocusEffect)

    navigation.navigate('Contagem', {
      codigoQr: codigo,
      sessao,
      loja,
      rodada,
      onAdicionar: adicionarContagem,
      jaContadoNestaRodada: contagens.some(c => c.codigoQr === codigo),
    });
  }

  if (!permissao) {
    return (
      <SafeAreaView style={estilos.containerCentro}>
        <Text style={estilos.textoBranco}>Carregando camera...</Text>
      </SafeAreaView>
    );
  }

  if (!permissao.granted) {
    return (
      <SafeAreaView style={estilos.containerCentro}>
        <StatusBar barStyle="light-content" />
        <Text style={estilos.tituloSemPermissao}>Camera necessaria</Text>
        <Text style={estilos.textoSemPermissao}>
          Para bipar produtos, o app precisa acessar a camera do seu celular.
        </Text>
        {permissao.canAskAgain ? (
          <Button
            titulo="Permitir camera"
            onPress={solicitarPermissao}
            fullWidth={false}
          />
        ) : (
          <View>
            <Text style={estilos.textoSemPermissao}>
              Voce negou a permissao anteriormente. Abra as configuracoes do app e habilite a camera manualmente.
            </Text>
            <Button
              titulo="Abrir configuracoes"
              onPress={() => Linking.openSettings()}
              fullWidth={false}
            />
          </View>
        )}
        <View style={{ height: 24 }} />
        <Button
          titulo="Voltar"
          variante="secondary"
          onPress={() => navigation.goBack()}
          fullWidth={false}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={estilos.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CameraView
        style={estilos.camera}
        facing="back"
        enableTorch={flash}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'],
        }}
        onBarcodeScanned={focado && !escaneado ? handleBarCodeScanned : undefined}
      >
        <SafeAreaView style={estilos.cabecalho}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={estilos.botaoVoltar}
          >
            <Text style={estilos.botaoVoltarTexto}>Voltar</Text>
          </TouchableOpacity>
          <View style={estilos.cabecalhoInfo}>
            <Text style={estilos.cabecalhoTitulo}>Bipe o QR Code</Text>
            <Text style={estilos.cabecalhoSubtitulo} numberOfLines={1}>
              {sessao.nome}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setFlash(!flash)}
            style={estilos.botaoFlash}
          >
            <Text style={estilos.botaoFlashTexto}>
              {flash ? 'Flash ON' : 'Flash OFF'}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Overlay escuro ao redor do quadrado de leitura */}
        <View style={estilos.scannerArea}>
          {/* Faixa escura superior */}
          <View style={estilos.overlayTop} />

          {/* Linha do meio: lateral esq. + quadrado limpo + lateral dir. */}
          <View style={estilos.overlayMeio}>
            <View style={estilos.overlayLateral} />

            {/* Quadrado de leitura — sem background, camera visivel */}
            <View style={estilos.scanFrame}>
              <View style={[estilos.cantoBase, estilos.cantoSE]} />
              <View style={[estilos.cantoBase, estilos.cantoSD]} />
              <View style={[estilos.cantoBase, estilos.cantoIE]} />
              <View style={[estilos.cantoBase, estilos.cantoID]} />
              {/* Linha animada opcional — indica area ativa */}
              <View style={estilos.scanLinha} />
            </View>

            <View style={estilos.overlayLateral} />
          </View>

          {/* Faixa escura inferior com instrucao */}
          <View style={estilos.overlayBottom}>
            <Text style={estilos.instrucao}>
              Aponte para o QR Code do produto
            </Text>
          </View>
        </View>

        <SafeAreaView style={estilos.rodape}>
          {/* Painel de itens pendentes (rodadas 2 e 3) */}
          {itensPendentes.length > 0 && (
            <View style={estilos.painelPendentes}>
              <View style={estilos.painelPendentesHeader}>
                <Text style={estilos.painelPendentesTitle}>
                  {ORDINAL[rodada] || `${rodada}ª`} contagem — faltam {pendentesRestantes.length} de {itensPendentes.length}:
                </Text>
                {pendentesRestantes.length > 0 && (
                  <TouchableOpacity onPress={() => setModalListaPendentes(true)} style={estilos.btnVerTodos}>
                    <Text style={estilos.btnVerTodosTxt}>Ver todos</Text>
                  </TouchableOpacity>
                )}
              </View>
              {pendentesRestantes.length === 0 && (
                <View style={estilos.painelPendentesLinha}>
                  <View style={[estilos.bolinha, estilos.bolinhaVerde]} />
                  <Text style={estilos.painelPendentesItem}>Todos os itens da lista foram contados</Text>
                </View>
              )}
              {pendentesRestantes.slice(0, 4).map((item, i) => (
                <View key={item.codigoQr || item.sku || i} style={estilos.painelPendentesLinha}>
                  <View style={estilos.bolinha} />
                  <Text style={estilos.painelPendentesItem} numberOfLines={1}>
                    {item.sku || item.codigoQr}{item.descricao ? ` — ${item.descricao}` : ''}
                  </Text>
                </View>
              ))}
              {pendentesRestantes.length > 4 && (
                <TouchableOpacity onPress={() => setModalListaPendentes(true)}>
                  <Text style={[estilos.painelPendentesItem, { color: colors.warning, marginTop: 2 }]}>
                    ...e mais {pendentesRestantes.length - 4} — toque para ver todos
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Barra de progresso: Total / Contados / Faltam */}
          {temBipagens && (
            <View style={estilos.barraContagem}>
              {/* Progresso da rodada (API quando disponivel) */}
              <View style={estilos.progressoBloco}>
                {/* Linha de numeros */}
                <View style={estilos.progressoNums}>
                  <View style={estilos.progressoStat}>
                    <Text style={estilos.progressoValor}>{totalRodada || '—'}</Text>
                    <Text style={estilos.progressoLabel}>Total</Text>
                  </View>
                  <View style={estilos.progressoDiv} />
                  <View style={estilos.progressoStat}>
                    <Text style={[estilos.progressoValor, { color: '#4ADE80' }]}>{bipadosRodada}</Text>
                    <Text style={estilos.progressoLabel}>Bipados</Text>
                  </View>
                  <View style={estilos.progressoDiv} />
                  <View style={estilos.progressoStat}>
                    {(() => {
                      const faltam = totalRodada - bipadosRodada;
                      return (
                        <>
                          <Text style={[estilos.progressoValor, { color: faltam > 0 ? '#FCA5A5' : '#4ADE80' }]}>
                            {faltam > 0 ? faltam : 0}
                          </Text>
                          <Text style={estilos.progressoLabel}>Faltam</Text>
                        </>
                      );
                    })()}
                  </View>
                  <View style={estilos.progressoDiv} />
                  <View style={estilos.progressoStat}>
                    <Text style={estilos.progressoValor}>{contagens.length}</Text>
                    <Text style={estilos.progressoLabel}>Leituras</Text>
                  </View>
                </View>
                {/* Barra de progresso visual */}
                {totalRodada > 0 && (
                  <View style={estilos.progressoBarraFundo}>
                    <View style={[
                      estilos.progressoBarraFill,
                      { width: `${Math.min(bipadosRodada / totalRodada * 100, 100)}%` }
                    ]} />
                  </View>
                )}
              </View>

              <TouchableOpacity style={estilos.botaoFinalizar} onPress={handleFinalizar}>
                <Text style={estilos.botaoFinalizarTexto}>
                  Finalizar {ORDINAL[rodada] || `${rodada}ª`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={estilos.botaoManual}
            onPress={() => {
              setCodigoManual('');
              setModalVisivel(true);
            }}
          >
            <Text style={estilos.botaoManualTexto}>Digitar codigo manualmente</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </CameraView>

      {/* Modal de lista completa de pendentes (Bug 5 + Bug 6) */}
      <Modal
        visible={modalListaPendentes}
        transparent
        animationType="slide"
        onRequestClose={() => setModalListaPendentes(false)}
      >
        <View style={estilos.modalOverlay}>
          <View style={[estilos.modalContainer, { maxHeight: '80%' }]}>
            <Text style={estilos.modalTitulo}>
              {ORDINAL[rodada] || `${rodada}ª`} contagem
            </Text>
            <Text style={estilos.modalSubtitulo}>
              Faltam {pendentesRestantes.length} de {itensPendentes.length} produto(s)
            </Text>
            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator>
              {pendentesRestantes.length === 0 && (
                <Text style={estilos.pendenteDesc}>Todos os itens da lista foram contados.</Text>
              )}
              {pendentesRestantes.map((item, i) => {
                const codigoRef = item.codigoQr || item.sku;
                return (
                  <View key={codigoRef || i} style={estilos.pendenteLinha}>
                    <View style={estilos.bolinhaGrande} />
                    <View style={{ flex: 1 }}>
                      <Text style={estilos.pendenteSku}>{item.sku || codigoRef}</Text>
                      {item.descricao ? (
                        <Text style={estilos.pendenteDesc} numberOfLines={2}>{item.descricao}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ height: spacing.md }} />
            <TouchableOpacity style={estilos.btnFecharModal} onPress={() => setModalListaPendentes(false)}>
              <Text style={estilos.btnFecharModalTxt}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalVisivel}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisivel(false)}
      >
        <KeyboardAvoidingView
          style={estilos.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={estilos.modalContainer}>
            <Text style={estilos.modalTitulo}>Digitar codigo</Text>
            <Text style={estilos.modalSubtitulo}>
              Digite o codigo QR ou codigo de barras do produto
            </Text>

            <TextInput
              style={estilos.modalInput}
              value={codigoManual}
              onChangeText={setCodigoManual}
              placeholder="Ex: QR-001234"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (codigoManual.trim()) confirmarCodigoManual();
              }}
            />

            <View style={estilos.modalBotoes}>
              <TouchableOpacity
                style={estilos.modalBotaoCancelar}
                onPress={() => setModalVisivel(false)}
              >
                <Text style={estilos.modalBotaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  estilos.modalBotaoConfirmar,
                  !codigoManual.trim() && estilos.modalBotaoDesabilitado,
                ]}
                onPress={confirmarCodigoManual}
                disabled={!codigoManual.trim()}
              >
                <Text style={estilos.modalBotaoConfirmarTexto}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerCentro: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  textoBranco: {
    color: colors.white,
    fontSize: 16,
  },
  tituloSemPermissao: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  textoSemPermissao: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  camera: {
    flex: 1,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  botaoVoltar: {
    padding: 8,
  },
  botaoVoltarTexto: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cabecalhoInfo: {
    flex: 1,
    alignItems: 'center',
  },
  cabecalhoTitulo: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cabecalhoSubtitulo: {
    color: colors.white,
    opacity: 0.8,
    fontSize: 12,
    marginTop: 2,
  },
  botaoFlash: {
    padding: 8,
  },
  botaoFlashTexto: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Layout do scanner com overlay escuro ──────────────────────────────────
  scannerArea: {
    flex: 1,
  },
  // Faixa preta acima do quadrado
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  // Linha do meio: lateral esq. + janela + lateral dir.
  overlayMeio: {
    flexDirection: 'row',
    height: 260,          // deve ser igual a scanFrame
  },
  overlayLateral: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  // Quadrado limpo — camera visivel, sem background
  scanFrame: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  // Faixa preta abaixo do quadrado com instrucao
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    paddingTop: 20,
  },
  // Cantos do frame
  cantoBase: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#4ADE80',  // verde brilhante para contraste
  },
  cantoSE: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cantoSD: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cantoIE: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cantoID: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  // Linha central que indica a area de leitura
  scanLinha: {
    position: 'absolute',
    top: '50%',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: 'rgba(74,222,128,0.5)',
    borderRadius: 2,
  },
  instrucao: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  rodape: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  painelPendentes: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  painelPendentesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  painelPendentesTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  btnVerTodos: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  btnVerTodosTxt: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  painelPendentesLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 6,
  },
  bolinha: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  bolinhaVerde: {
    backgroundColor: '#4ADE80',
  },
  painelPendentesItem: {
    color: colors.white,
    fontSize: 11,
    opacity: 0.85,
    flex: 1,
  },
  // Modal lista completa de pendentes
  pendenteLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  bolinhaGrande: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#CBD5E1',
    flexShrink: 0,
  },
  bolinhaGrandeVerde: {
    backgroundColor: '#22C55E',
  },
  pendenteSku: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  pendenteDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  pendenteBipado: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  btnFecharModal: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  btnFecharModalTxt: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  barraContagem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  // Bloco de progresso (Total / Bipados / Faltam / Leituras)
  progressoBloco: {
    flex: 1,
  },
  progressoNums: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressoStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressoDiv: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressoValor: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  progressoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  // Barra de progresso visual
  progressoBarraFundo: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressoBarraFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },
  botaoFinalizar: {
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  botaoFinalizarTexto: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  botaoManual: {
    padding: 16,
    alignItems: 'center',
  },
  botaoManualTexto: {
    color: colors.white,
    fontSize: 14,
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitulo: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  modalSubtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
    letterSpacing: 1,
  },
  modalBotoes: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBotaoCancelar: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalBotaoCancelarTexto: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalBotaoConfirmar: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalBotaoDesabilitado: {
    opacity: 0.4,
  },
  modalBotaoConfirmarTexto: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
});