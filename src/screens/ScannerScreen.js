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

export default function ScannerScreen({ navigation, route }) {
  const { sessao, loja } = route.params;

  const [permissao, solicitarPermissao] = useCameraPermissions();
  const [escaneado, setEscaneado] = useState(false);
  const [flash, setFlash] = useState(false);
  const ultimoCodigoRef = useRef(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [contagens, setContagens] = useState([]);

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
    });
  }

  function handleFinalizar() {
    navigation.navigate('Resumo', { contagens, sessao, loja });
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
      quantidadeAnterior: totalAcumulado(codigo), // total ja bipado para este SKU
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

        <View style={estilos.scannerArea}>
          <View style={estilos.scanFrame}>
            <View style={[estilos.cantoBase, estilos.cantoSE]} />
            <View style={[estilos.cantoBase, estilos.cantoSD]} />
            <View style={[estilos.cantoBase, estilos.cantoIE]} />
            <View style={[estilos.cantoBase, estilos.cantoID]} />
          </View>
          <Text style={estilos.instrucao}>
            Aponte a camera para o QR Code do produto
          </Text>
        </View>

        <SafeAreaView style={estilos.rodape}>
          {contagens.length > 0 && (
            <View style={estilos.barraContagem}>
              <View style={estilos.barraTotais}>
                <Text style={estilos.barraTotaisTexto}>
                  {contagens.length} {contagens.length === 1 ? 'leitura' : 'leituras'}
                </Text>
                <Text style={estilos.barraTotaisSub}>
                  {skusUnicos} SKU{skusUnicos !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity style={estilos.botaoFinalizar} onPress={handleFinalizar}>
                <Text style={estilos.botaoFinalizarTexto}>Finalizar inventario</Text>
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
  scannerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  cantoBase: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.success,
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
  instrucao: {
    color: colors.white,
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  rodape: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  barraContagem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  barraTotais: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  barraTotaisTexto: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  barraTotaisSub: {
    color: colors.white,
    fontSize: 12,
    opacity: 0.7,
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