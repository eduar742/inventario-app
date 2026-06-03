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

import { avisar, confirmar } from '../utils/alertas';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { buscarProdutoPorQR } from '../services/api';

export default function ContagemScreen({ navigation, route }) {
  // Limpa asteriscos e caracteres extras que alguns coletores adicionam ao codigo
  const codigoQr = (route.params.codigoQr || '').trim().replace(/[*\r\n\t]+/g, '').trim();
  const { sessao, loja, quantidadeAnterior = 0 } = route.params;
  // Quantidade ja contada por OUTROS operadores nesta sessao (multi-operador)
  const qtdPorOutros = route.params?.qtdPorOutros ?? 0;

  // Localização obrigatória somente para Loja 01 (L01 - Matriz)
  const localizacaoObrigatoria = loja?.codigo === 'L01';

  const [carregandoProduto, setCarregandoProduto] = useState(true);
  const [produto, setProduto] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  // Controle de confirmação de localização diferente da esperada
  const [locDiferente, setLocDiferente] = useState(false);      // alerta visivel
  const [locConfirmada, setLocConfirmada] = useState(false);    // operador confirmou

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
        // Na web: avisa e navega de volta; no mobile: Alert com botao Voltar
        avisar('Erro ao buscar produto', err.message || 'Nao foi possivel verificar o produto.');
        navigation.goBack();
      }
    } finally {
      setCarregandoProduto(false);
    }
  }

  // Localização esperada do produto (cadastrada na importação)
  const locEsperada = (produto?.localizacao || '').trim();
  const locDigitada = localizacao.trim();
  const locDifereDoEsperado = Boolean(
    locEsperada && locDigitada && locDigitada.toUpperCase() !== locEsperada.toUpperCase()
  );

  function handleConfirmar() {
    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (isNaN(qtd) || qtd < 0) {
      avisar('Quantidade invalida', 'Digite um numero valido (ex: 60 ou 12,5)');
      return;
    }
    // Valida campo obrigatorio para L01
    if (localizacaoObrigatoria && !locDigitada) {
      avisar('Localizacao obrigatoria', 'Informe a localizacao do produto (ex: Prateleira A3).');
      return;
    }
    // Se localização difere e ainda não confirmou, exibe o alerta de confirmação
    if (locDifereDoEsperado && !locConfirmada) {
      setLocDiferente(true);
      return;
    }

    route.params.onAdicionar({
      codigoQr,
      sku: produto.sku,
      descricao: produto.descricao,
      unidadeMedida: produto.unidade_medida,
      quantidade: qtd,
      localizacao: locDigitada || null,
      confirmarLocalizacao: locConfirmada,
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

          {/* Aviso: outro operador ja bipou este produto nesta sessao */}
          {qtdPorOutros > 0 && (
            <View style={[estilos.cardSoma, { borderLeftColor: '#7C3AED', backgroundColor: '#F5F3FF' }]}>
              <Text style={[estilos.somaLabel, { color: '#7C3AED' }]}>
                Outro operador ja contou este produto
              </Text>
              <Text style={estilos.somaTexto}>
                Total ja registrado por outros:{' '}
                <Text style={[estilos.somaValor, { color: '#7C3AED' }]}>
                  {qtdPorOutros} {produto?.unidade_medida || ''}
                </Text>
                {'\n'}Digite apenas a quantidade do SEU local. Os totais serao somados.
              </Text>
            </View>
          )}

          {/* Aviso de soma quando o mesmo SKU ja foi bipado pelo MESMO operador */}
          {quantidadeAnterior > 0 && qtdPorOutros === 0 && (
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

          {/* Label com indicador de obrigatório para L01 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xs, gap: 6 }}>
            <Text style={estilos.inputLabelPequeno} numberOfLines={1}>
              Localização{localizacaoObrigatoria ? '' : ' (opcional)'}
            </Text>
            {localizacaoObrigatoria && (
              <View style={estilos.badgeObrigatorio}>
                <Text style={estilos.badgeObrigatorioTxt}>Obrigatório · L01</Text>
              </View>
            )}
          </View>
          <TextInput
            style={[estilos.inputLoc, localizacaoObrigatoria && !locDigitada && { borderColor: colors.danger }]}
            value={localizacao}
            onChangeText={v => { setLocalizacao(v); setLocDiferente(false); setLocConfirmada(false); }}
            placeholder={localizacaoObrigatoria ? 'Obrigatório: ex. Prateleira A3' : 'Ex: Prateleira A3, Corredor 2...'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={100}
            returnKeyType="next"
          />

          {/* Localização esperada do produto */}
          {locEsperada && !locDifereDoEsperado && (
            <Text style={estilos.locEsperadaDica}>
              Localização cadastrada no sistema: {locEsperada}
            </Text>
          )}

          {/* Alerta: localização diferente da esperada */}
          {locDiferente && locDifereDoEsperado && !locConfirmada && (
            <View style={estilos.cardLocDiferente}>
              <Text style={estilos.cardLocDiferenteTitulo}>
                ⚠️ Localização diferente da esperada
              </Text>
              <Text style={estilos.cardLocDiferenteTexto}>
                Sistema registra: <Text style={{ fontWeight: '700' }}>{locEsperada}</Text>
                {'\n'}Você informou: <Text style={{ fontWeight: '700' }}>{locDigitada}</Text>
              </Text>
              <Text style={estilos.cardLocDiferenteTexto}>
                Confirme apenas se o produto foi encontrado em local diferente do cadastrado.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <TouchableOpacity
                  style={[estilos.botaoLocAcao, { flex: 1, backgroundColor: colors.backgroundSoft, borderColor: colors.border }]}
                  onPress={() => { setLocalizacao(locEsperada); setLocDiferente(false); }}
                >
                  <Text style={[estilos.botaoLocAcaoTxt, { color: colors.textSecondary }]}>
                    Usar {locEsperada}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[estilos.botaoLocAcao, { flex: 1, backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}
                  onPress={() => { setLocConfirmada(true); setLocDiferente(false); }}
                >
                  <Text style={[estilos.botaoLocAcaoTxt, { color: '#92400E' }]}>
                    Confirmar {locDigitada}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirmação visual quando localização foi aceita */}
          {locConfirmada && locDifereDoEsperado && (
            <View style={estilos.locConfirmadaBox}>
              <Text style={estilos.locConfirmadaTxt}>
                ✓ Nova localização confirmada: {locDigitada} (esperada: {locEsperada})
              </Text>
            </View>
          )}

          <Text style={estilos.inputLabelPequeno}>Observacoes (opcional)</Text>
          <TextInput
            style={estilos.inputObs}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Ex: produto danificado, embalagem aberta..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />

          <View style={{ height: spacing.lg }} />

          <Button
            titulo="Adicionar ao inventario"
            onPress={handleConfirmar}
            desabilitado={!quantidade || (localizacaoObrigatoria && !locDigitada)}
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
  inputLoc: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 0.5,
  },
  // Badge obrigatório (L01)
  badgeObrigatorio: {
    backgroundColor: '#FEF2F2', borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FECACA',
  },
  badgeObrigatorioTxt: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  // Dica da localização esperada
  locEsperadaDica: {
    fontSize: 11, color: colors.textMuted, marginTop: 4,
    fontStyle: 'italic',
  },
  // Card de alerta de localização diferente
  cardLocDiferente: {
    backgroundColor: '#FFFBEB', borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
    borderWidth: 1, borderColor: '#FDE68A',
    borderLeftWidth: 4, borderLeftColor: '#D97706',
  },
  cardLocDiferenteTitulo: { fontSize: fontSize.sm, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  cardLocDiferenteTexto: { fontSize: fontSize.xs, color: '#78350F', lineHeight: 18, marginBottom: 2 },
  botaoLocAcao: {
    padding: spacing.sm, borderRadius: radius.md,
    alignItems: 'center', borderWidth: 1,
  },
  botaoLocAcaoTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  // Confirmação aceita
  locConfirmadaBox: {
    backgroundColor: '#F0FDF4', borderRadius: radius.sm,
    padding: spacing.xs, marginTop: 4,
    borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  locConfirmadaTxt: { fontSize: 11, color: '#166534', fontWeight: '500' },
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