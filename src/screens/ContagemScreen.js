// Tela de Contagem - o coracao do app!
// Inventario AS CEGAS: operador NAO ve o saldo sistemico antes de contar.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { buscarProdutoPorQR } from '../services/api';

export default function ContagemScreen({ navigation, route }) {
  // Limpa asteriscos e caracteres extras que alguns coletores adicionam ao codigo
  const codigoQr = (route.params.codigoQr || '').trim().replace(/[*\r\n\t]+/g, '').trim();
  const { sessao, loja, quantidadeAnterior = 0 } = route.params;

  const [carregandoProduto, setCarregandoProduto] = useState(true);
  const [produto, setProduto] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    carregarProduto();
  }, []);

  async function carregarProduto() {
    try {
      const dadosProduto = await buscarProdutoPorQR(codigoQr);
      setProduto(dadosProduto);
    } catch (err) {
      if (err.status === 404) {
        // Produto não cadastrado - permite contagem pelo código QR
        setProduto({
          codigo_qr: codigoQr,
          sku: null,
          descricao: null,
          unidade_medida: 'UN',
          nao_cadastrado: true,
        });
      } else {
        Alert.alert(
          'Erro ao buscar produto',
          err.message || 'Nao foi possivel verificar o produto.',
          [{ text: 'Voltar', onPress: () => navigation.goBack() }]
        );
      }
    } finally {
      setCarregandoProduto(false);
    }
  }

  function handleConfirmar() {
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (isNaN(qtd) || qtd < 0) {
      Alert.alert('Quantidade invalida', 'Digite um numero valido (ex: 60 ou 12,5)');
      return;
    }

    route.params.onAdicionar({
      codigoQr,
      sku: produto.sku,
      descricao: produto.descricao,
      unidadeMedida: produto.unidade_medida,
      quantidade: qtd,
      observacoes: observacoes || null,
    });

    navigation.goBack();
  }

  if (carregandoProduto) {
    return (
      <SafeAreaView style={estilos.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.loadingTexto}>Buscando produto...</Text>
      </SafeAreaView>
    );
  }

  // ====== Tela de Entrada (CEGA) ======
  return (
    <SafeAreaView style={estilos.container}>
      <KeyboardAvoidingView
        style={estilos.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={estilos.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {produto.nao_cadastrado ? (
            <View style={[estilos.cardProduto, estilos.cardProdutoAlerta]}>
              <Text style={estilos.alertaLabel}>Produto nao cadastrado</Text>
              <Text style={estilos.nomeProduto}>{produto.codigo_qr}</Text>
              <Text style={estilos.alertaTexto}>
                Codigo nao encontrado na base. Sera registrado somente o codigo e a quantidade informada.
              </Text>
            </View>
          ) : (
            <View style={estilos.cardProduto}>
              <Text style={estilos.skuCodigo}>
                {produto.codigo_qr} | {produto.sku}
              </Text>
              <Text style={estilos.nomeProduto}>{produto.descricao}</Text>
              <View style={estilos.dadosProduto}>
                <Text style={estilos.dadoProduto}>UN: {produto.unidade_medida}</Text>
              </View>
            </View>
          )}

          {/* Aviso de soma quando o mesmo SKU ja foi bipado antes */}
          {quantidadeAnterior > 0 && (
            <View style={estilos.cardSoma}>
              <Text style={estilos.somaLabel}>Bipagem adicional — sera somada</Text>
              <Text style={estilos.somaTexto}>
                Ja bipado nesta sessao: <Text style={estilos.somaValor}>{quantidadeAnterior} {produto?.unidade_medida || ''}</Text>
                {'\n'}Digite a quantidade deste local. O total sera somado automaticamente.
              </Text>
            </View>
          )}

          <View style={estilos.cardAviso}>
            <Text style={estilos.avisoLabel}>Inventario as cegas</Text>
            <Text style={estilos.avisoTexto}>
              Conte fisicamente o produto e digite a quantidade encontrada.
              O sistema vai comparar apos sua confirmacao.
            </Text>
          </View>

          <Text style={estilos.inputLabel}>Quantidade contada</Text>
          <TextInput
            style={estilos.inputGrande}
            value={quantidade}
            onChangeText={setQuantidade}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
          />

          <Text style={estilos.inputLabelPequeno}>Observacoes (opcional)</Text>
          <TextInput
            style={estilos.inputObs}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Ex: produto danificado, na prateleira X..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />

          <View style={{ height: spacing.lg }} />

          <Button
            titulo="Adicionar ao inventario"
            onPress={handleConfirmar}
            desabilitado={!quantidade}
          />

          <View style={{ height: spacing.sm }} />

          <Button
            titulo="Cancelar"
            variante="secondary"
            onPress={() => navigation.goBack()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingTexto: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  cardProduto: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardProdutoAlerta: {
    borderColor: colors.warning,
    borderLeftWidth: 4,
  },
  alertaLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertaTexto: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  skuCodigo: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  nomeProduto: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  dadosProduto: {
    flexDirection: 'row',
  },
  dadoProduto: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.md,
  },
  cardSoma: {
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  somaLabel: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '700',
    marginBottom: 4,
  },
  somaTexto: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  somaValor: {
    fontWeight: '700',
    color: colors.success,
  },
  cardAviso: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  avisoLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  avisoTexto: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputLabelPequeno: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputGrande: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
  },
  inputObs: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
  },
});