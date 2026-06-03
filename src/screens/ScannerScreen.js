// Tela do scanner de QR Code.
// O operador aponta a camera para o QR do produto e o sistema le automaticamente.

import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { listarContagensDaSessao, pegarUsuario } from '../services/api';

// Sufixos de ordinal feminino (contagem)
const ORDINAL = { 1: '1ª', 2: '2ª', 3: '3ª' };

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
  const [modalVisivel, setModalVisivel] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [contagens, setContagens] = useState([]);
  // Cache de contagens de outros operadores: { [codigoQr]: qtd }
  const [qtdOutrosRef, setQtdOutros] = useState({});

  // Reseta a lista de contagens quando uma nova rodada começa
  useEffect(() => {
    if (route.params?.resetContagens) {
      setContagens([]);
      navigation.setParams({ resetContagens: undefined });
    }
  }, [route.params?.resetContagens]);

  // Carrega contagens existentes de outros operadores na sessao (multi-operador)
  useEffect(() => {
    async function carregarOutros() {
      try {
        const usuario = await pegarUsuario();
        const lista = await listarContagensDaSessao(sessao.id);
        // Agrupa por codigoQr a soma de contagens de OUTROS usuarios
        const mapa = {};
        for (const c of lista) {
          if (c.nome_usuario && usuario && c.usuario_id === usuario.id) continue;
          const qr = c.sku || c.produto_id;
          mapa[qr] = (mapa[qr] || 0) + parseFloat(c.quantidade_contada || 0);
        }
        setQtdOutros(mapa);
      } catch (_) {}
    }
    carregarOutros();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.id]);

  function adicionarContagem(novaContagem) {
    setContagens(prev => [...prev, novaContagem]);
  }

  useEffect(() => {
    if (!permissao) return;
    if (!permissao.granted && permissao.canAskAgain) {
      solicitarPermissao();
    }
  }, [permissao]);

  // Remove caracteres extras que alguns coletores adicionam (asterisco, CR, LF, espacos)
  function limparCodigo(raw) {
    return (raw || '').trim().replace(/[*\r\n\t]+/g, '').trim();
  }

   function confirmarCodigoManual() {
    const codigo = limparCodigo(codigoManual);
    if (!codigo) return;
    setModalVisivel(false);
    navigation.navigate('Contagem', {
      codigoQr: codigo,
      sessao,
      loja,
      onAdicionar: adicionarContagem,
      quantidadeAnterior: totalAcumulado(codigo),
      qtdPorOutros: qtdOutrosRef[codigo] || 0,
    });
  }

  function handleFinalizar() {
    navigation.navigate('Resumo', { contagens, sessao, loja, rodada });
  }

  const skusUnicos = new Set(contagens.map(c => c.codigoQr)).size;

  // Calcula total ja acumulado para um QR code especifico
  function totalAcumulado(codigoQr) {
    return contagens
      .filter(c => c.codigoQr === codigoQr)
      .reduce((soma, c) => soma + (c.quantidade || 0), 0);
  }

  function handleBarCodeScanned({ data }) {
    const codigo = limparCodigo(data);
    if (!codigo) return;
    if (escaneado || codigo === ultimoCodigoRef.current) return;
    setEscaneado(true);
    ultimoCodigoRef.current = codigo;

    navigation.navigate('Contagem', {
      codigoQr: codigo,
      sessao,
      loja,
      onAdicionar: adicionarContagem,
      quantidadeAnterior: totalAcumulado(codigo),
      qtdPorOutros: qtdOutrosRef[codigo] || 0, // quantidade ja contada por outros operadores
    });

    // Reseta apos um pequeno delay para permitir nova leitura ao voltar
    setTimeout(() => {
      setEscaneado(false);
      ultimoCodigoRef.current = null;
    }, 1000);
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
        onBarcodeScanned={escaneado ? undefined : handleBarCodeScanned}
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
              <Text style={estilos.painelPendentesTitle}>
                {ORDINAL[rodada] || `${rodada}ª`} contagem — {itensPendentes.length} produto(s):
              </Text>
              {itensPendentes.slice(0, 5).map((item, i) => (
                <Text key={i}
                  style={[estilos.painelPendentesItem, item.naoBipado && { color: '#FCA5A5' }]}
                  numberOfLines={1}>
                  {item.naoBipado ? '○' : '↻'} {item.sku || item.codigoQr}
                  {item.descricao ? ` — ${item.descricao}` : ''}
                  {item.naoBipado ? ' (não bipado)' : ''}
                </Text>
              ))}
              {itensPendentes.length > 5 && (
                <Text style={estilos.painelPendentesItem}>
                  ...e mais {itensPendentes.length - 5}
                </Text>
              )}
            </View>
          )}

          {/* Barra de progresso: Total / Contados / Faltam */}
          {contagens.length > 0 && (
            <View style={estilos.barraContagem}>
              {/* Progresso em relacao ao total de SKUs da sessao */}
              <View style={estilos.progressoBloco}>
                {/* Linha de numeros */}
                <View style={estilos.progressoNums}>
                  <View style={estilos.progressoStat}>
                    <Text style={estilos.progressoValor}>{sessao.total_produtos_loja ?? '—'}</Text>
                    <Text style={estilos.progressoLabel}>Total</Text>
                  </View>
                  <View style={estilos.progressoDiv} />
                  <View style={estilos.progressoStat}>
                    <Text style={[estilos.progressoValor, { color: '#4ADE80' }]}>{skusUnicos}</Text>
                    <Text style={estilos.progressoLabel}>Bipados</Text>
                  </View>
                  <View style={estilos.progressoDiv} />
                  <View style={estilos.progressoStat}>
                    {(() => {
                      const faltam = (sessao.total_produtos_loja ?? 0) - skusUnicos;
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
                {(sessao.total_produtos_loja ?? 0) > 0 && (
                  <View style={estilos.progressoBarraFundo}>
                    <View style={[
                      estilos.progressoBarraFill,
                      { width: `${Math.min(skusUnicos / sessao.total_produtos_loja * 100, 100)}%` }
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
  painelPendentesTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  painelPendentesItem: {
    color: colors.white,
    fontSize: 11,
    opacity: 0.85,
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