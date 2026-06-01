// Tela para ADM criar e iniciar sessoes de inventario.
// Apenas ADM pode criar sessoes; operadores e gestores usam sessoes ja abertas.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import Input from '../components/Input';
import { listarLojas, listarMesesImportados, criarSessao, iniciarSessao } from '../services/api';


const TIPOS = [
  { id: 'geral',      rotulo: 'Geral',      descricao: 'Todos os produtos da loja' },
  { id: 'parcial',    rotulo: 'Parcial',     descricao: 'Subset de produtos (categorias especificas)' },
  { id: 'ciclico',    rotulo: 'Ciclico',     descricao: 'Rodizio periodico de produtos' },
  { id: 'recontagem', rotulo: 'Recontagem',  descricao: 'Verificacao de divergencias anteriores' },
];

export default function CriarSessaoScreen({ navigation }) {
  const [lojas, setLojas] = useState([]);
  const [meses, setMeses] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMeses, setCarregandoMeses] = useState(false);
  const [criando, setCriando] = useState(false);

  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('geral');
  const [mesReferencia, setMesReferencia] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [iniciarImediatamente, setIniciarImediatamente] = useState(true);
  const [expandirLojas, setExpandirLojas] = useState(false);

  useEffect(() => {
    listarLojas()
      .then(data => setLojas(data.filter(l => l.ativa)))
      .catch(() => Alert.alert('Erro', 'Nao foi possivel carregar as lojas'))
      .finally(() => setCarregando(false));
  }, []);

  async function aoSelecionarLoja(loja) {
    setLojaSelecionada(loja);
    setExpandirLojas(false);
    setMesReferencia('');
    setMeses([]);
    setCarregandoMeses(true);
    try {
      const lista = await listarMesesImportados(loja.id);
      setMeses(lista);
      if (lista.length > 0) setMesReferencia(lista[0]); // pre-seleciona o mais recente
    } catch (_) {
      setMeses([]);
    } finally {
      setCarregandoMeses(false);
    }
  }

  function nomeSugerido() {
    if (!lojaSelecionada || !mesReferencia) return '';
    const [ano, mes] = mesReferencia.split('-');
    const mesesNomes = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `Inventario ${mesesNomes[parseInt(mes, 10)]} ${ano} - ${lojaSelecionada.codigo}`;
  }

  async function handleCriar() {
    if (!lojaSelecionada) { Alert.alert('Atencao', 'Selecione uma loja'); return; }
    if (!mesReferencia)    { Alert.alert('Atencao', 'Selecione o mes de referencia'); return; }

    const nomeFinal = nome.trim() || nomeSugerido();
    if (!nomeFinal)        { Alert.alert('Atencao', 'Informe o nome da sessao'); return; }

    setCriando(true);
    try {
      const sessao = await criarSessao({
        lojaId: lojaSelecionada.id,
        nome: nomeFinal,
        tipo,
        mesReferencia,
        observacoes,
      });

      if (iniciarImediatamente) {
        await iniciarSessao(sessao.id);
        Alert.alert(
          'Sessao criada e iniciada!',
          `"${sessao.nome}" esta em andamento. Operadores ja podem bipar produtos.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert(
          'Sessao criada!',
          `"${sessao.nome}" foi criada. Use o botao "Iniciar" na tela de sessoes para liberar para operadores.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err) {
      Alert.alert('Erro ao criar sessao', err.message || 'Tente novamente');
    } finally {
      setCriando(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">

        {/* Loja */}
        <Text style={estilos.rotulo}>Loja *</Text>
        <TouchableOpacity
          style={estilos.seletor}
          onPress={() => setExpandirLojas(!expandirLojas)}
        >
          <Text style={lojaSelecionada ? estilos.seletorTexto : estilos.seletorPlaceholder}>
            {lojaSelecionada ? `${lojaSelecionada.codigo} — ${lojaSelecionada.nome}` : 'Selecione a loja'}
          </Text>
          <Text style={estilos.seletorSeta}>{expandirLojas ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {expandirLojas && (
          <View style={estilos.dropdown}>
            {lojas.map(loja => (
              <TouchableOpacity
                key={loja.id}
                style={[estilos.dropdownItem, lojaSelecionada?.id === loja.id && estilos.dropdownItemAtivo]}
                onPress={() => aoSelecionarLoja(loja)}
              >
                <Text style={[estilos.dropdownTexto, lojaSelecionada?.id === loja.id && estilos.dropdownTextoAtivo]}>
                  {loja.codigo} — {loja.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Mes de referencia */}
        <View style={{ height: spacing.md }} />
        <Text style={estilos.rotulo}>Mes de referencia *</Text>
        {carregandoMeses ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.sm }} />
        ) : meses.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={estilos.chipRow}>
              {meses.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[estilos.chipMes, mesReferencia === m && estilos.chipMesAtivo]}
                  onPress={() => setMesReferencia(m)}
                >
                  <Text style={[estilos.chipMesTexto, mesReferencia === m && estilos.chipMesTextoAtivo]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : lojaSelecionada ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTexto}>
              Nenhum estoque importado para esta loja. Importe uma planilha antes de criar a sessao.
            </Text>
          </View>
        ) : (
          <Text style={estilos.dica}>Selecione uma loja para ver os meses disponíveis</Text>
        )}

        {/* Nome */}
        <View style={{ height: spacing.md }} />
        <Text style={estilos.rotulo}>Nome da sessao</Text>
        <TextInput
          style={estilos.input}
          value={nome}
          onChangeText={setNome}
          placeholder={nomeSugerido() || 'Ex: Inventario Geral Janeiro 2026'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
        {!nome && nomeSugerido() ? (
          <Text style={estilos.dica}>Sera usado: "{nomeSugerido()}"</Text>
        ) : null}

        {/* Tipo */}
        <View style={{ height: spacing.md }} />
        <Text style={estilos.rotulo}>Tipo</Text>
        {TIPOS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[estilos.opcao, tipo === t.id && estilos.opcaoAtiva]}
            onPress={() => setTipo(t.id)}
          >
            <View style={[estilos.radio, tipo === t.id && estilos.radioAtivo]} />
            <View style={{ flex: 1 }}>
              <Text style={[estilos.opcaoRotulo, tipo === t.id && estilos.opcaoRotuloAtivo]}>
                {t.rotulo}
              </Text>
              <Text style={estilos.opcaoDescricao}>{t.descricao}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Observacoes */}
        <View style={{ height: spacing.md }} />
        <Text style={estilos.rotulo}>Observacoes (opcional)</Text>
        <TextInput
          style={[estilos.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={observacoes}
          onChangeText={setObservacoes}
          placeholder="Ex: Inventario mensal completo, foco em chapas"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
        />

        {/* Iniciar imediatamente */}
        <View style={{ height: spacing.md }} />
        <TouchableOpacity
          style={estilos.toggleIniciar}
          onPress={() => setIniciarImediatamente(v => !v)}
        >
          <View style={[estilos.checkbox, iniciarImediatamente && estilos.checkboxAtivo]}>
            {iniciarImediatamente && <Text style={estilos.checkboxTick}>✓</Text>}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={estilos.toggleRotulo}>Iniciar imediatamente</Text>
            <Text style={estilos.toggleDescricao}>
              Libera a sessao para operadores biparem produtos assim que criada
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
        <Button
          titulo="Criar sessao"
          onPress={handleCriar}
          carregando={criando}
          desabilitado={!lojaSelecionada || !mesReferencia || criando}
        />
        <View style={{ height: spacing.sm }} />
        <Button titulo="Cancelar" variante="secondary" onPress={() => navigation.goBack()} desabilitado={criando} />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:      { padding: spacing.lg },
  rotulo:      { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary,
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  dica:        { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  // Seletor de loja
  seletor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
             backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
             borderRadius: radius.md, padding: spacing.md },
  seletorTexto:       { fontSize: fontSize.md, color: colors.text, flex: 1 },
  seletorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted, flex: 1 },
  seletorSeta:        { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: spacing.sm },
  dropdown: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
              borderTopWidth: 0, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
              maxHeight: 200 },
  dropdownItem:       { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownItemAtivo:  { backgroundColor: colors.primarySoft },
  dropdownTexto:      { fontSize: fontSize.md, color: colors.text },
  dropdownTextoAtivo: { color: colors.primary, fontWeight: '600' },
  // Chips de mes
  chipRow:         { flexDirection: 'row', gap: spacing.xs, paddingBottom: 4 },
  chipMes:         { paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                     borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
                     backgroundColor: colors.backgroundSoft },
  chipMesAtivo:    { backgroundColor: colors.primary, borderColor: colors.primary },
  chipMesTexto:    { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  chipMesTextoAtivo: { color: colors.white, fontWeight: '700' },
  // Aviso sem estoque
  aviso:      { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md,
                borderLeftWidth: 4, borderLeftColor: colors.warning },
  avisoTexto: { fontSize: fontSize.sm, color: colors.text },
  // Input
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
           borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  // Opcoes de tipo
  opcao:           { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
                     borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs,
                     borderWidth: 1, borderColor: colors.border },
  opcaoAtiva:      { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio:           { width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                     borderColor: colors.border, marginRight: spacing.sm },
  radioAtivo:      { borderColor: colors.primary, backgroundColor: colors.primary },
  opcaoRotulo:     { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  opcaoRotuloAtivo: { color: colors.primary },
  opcaoDescricao:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  // Toggle iniciar
  toggleIniciar: { flexDirection: 'row', alignItems: 'center',
                   backgroundColor: colors.background, borderRadius: radius.md,
                   padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  checkbox:       { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2,
                    borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxAtivo:  { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick:   { color: colors.white, fontWeight: '700', fontSize: 13 },
  toggleRotulo:   { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  toggleDescricao: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
