// Tela para ADM criar e iniciar sessoes de inventario.
// Permite tambem importar a planilha de referencia (SKU, descricao, saldos)
// diretamente na criacao, sem precisar ir ate a tela de Importacao separadamente.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { listarLojas, listarMesesImportados, criarSessao, iniciarSessao, importarPlanilha } from '../services/api';


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
  const [etapaCriando, setEtapaCriando] = useState('');
  const [erroVisivel, setErroVisivel] = useState(''); // banner de erro (web)

  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('geral');
  const [mesReferencia, setMesReferencia] = useState('');
  const [mesManual, setMesManual] = useState('');  // MM/AAAA digitado manualmente
  const [observacoes, setObservacoes] = useState('');
  const [iniciarImediatamente, setIniciarImediatamente] = useState(true);

  // Planilha de referencia (arquivo do coletor)
  const [arquivo, setArquivo] = useState(null);
  const [modoImport, setModoImport] = useState('completo');

  // Controle do modal de selecao de loja
  const [modalLojas, setModalLojas] = useState(false);

  // Exibe erro: banner na web, Alert no mobile
  function mostrarErro(msg) {
    setErroVisivel(msg);
    if (Platform.OS !== 'web') Alert.alert('Atencao', msg);
  }

  function mostrarSucesso(titulo, msg, aoFechar) {
    setErroVisivel('');
    if (Platform.OS === 'web') {
      // Web: mostra mensagem de sucesso no etapaCriando por 2s depois navega
      setEtapaCriando(`✓ ${titulo}`);
      setTimeout(() => { setEtapaCriando(''); if (aoFechar) aoFechar(); }, 1500);
    } else {
      Alert.alert(titulo, msg, [{ text: 'OK', onPress: aoFechar }]);
    }
  }

  useEffect(() => {
    listarLojas()
      .then(data => setLojas(data.filter(l => l.ativa)))
      .catch(() => mostrarErro('Nao foi possivel carregar as lojas'))
      .finally(() => setCarregando(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aoSelecionarLoja(loja) {
    setLojaSelecionada(loja);
    setModalLojas(false);
    setMesReferencia('');
    setMeses([]);
    setCarregandoMeses(true);
    try {
      const lista = await listarMesesImportados(loja.id);
      setMeses(lista);
      if (lista.length > 0) setMesReferencia(lista[0]);
    } catch (_) {
      setMeses([]);
    } finally {
      setCarregandoMeses(false);
    }
  }

  async function selecionarArquivo() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const nomeArq = (asset.name || '').toLowerCase();
      if (!nomeArq.endsWith('.xlsx') && !nomeArq.endsWith('.xls') && !nomeArq.endsWith('.csv')) {
        mostrarErro('Formato invalido. Use arquivos .xlsx, .xls ou .csv');
        return;
      }
      setErroVisivel('');
      setArquivo(asset);
    } catch (_) {
      mostrarErro('Nao foi possivel selecionar o arquivo');
    }
  }

  // Converte MM/AAAA → YYYY-MM
  function converterMes(mmaaaa) {
    const partes = mmaaaa.trim().split('/');
    if (partes.length === 2 && partes[0].length === 2 && partes[1].length === 4) {
      return `${partes[1]}-${partes[0]}`;
    }
    return '';
  }

  function mesEfetivo() {
    if (mesReferencia) return mesReferencia;
    return converterMes(mesManual);
  }

  function nomeSugerido() {
    if (!lojaSelecionada || !mesEfetivo()) return '';
    const [ano, mes] = mesEfetivo().split('-');
    const mesesNomes = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `Inventario ${mesesNomes[parseInt(mes, 10)]} ${ano} - ${lojaSelecionada.codigo}`;
  }

  async function handleCriar() {
    setErroVisivel('');
    if (!lojaSelecionada) { mostrarErro('Selecione uma loja'); return; }
    const mesRef = mesEfetivo();
    if (!mesRef) {
      mostrarErro(arquivo
        ? 'Informe o mes de referencia no formato MM/AAAA (ex: 06/2026)'
        : 'Selecione o mes de referencia');
      return;
    }
    const nomeFinal = nome.trim() || nomeSugerido();
    if (!nomeFinal) { mostrarErro('Informe o nome da sessao'); return; }

    setCriando(true);
    try {
      // Etapa 1: importar planilha (se arquivo selecionado)
      if (arquivo) {
        setEtapaCriando('Importando planilha de referencia...');
        const resultado = await importarPlanilha({
          lojaId: lojaSelecionada.id,
          mesReferencia: mesRef,
          arquivo,
          modo: modoImport,
        });
        if (resultado.status === 'falhou') {
          mostrarErro(`Falha na importacao: ${resultado.erros?.[0]?.mensagem || 'Verifique o arquivo'}`);
          return;
        }
        if (resultado.linhas_erro > 0) {
          // Na web mostra no etapaCriando; no mobile mostra Alert com confirmacao
          if (Platform.OS === 'web') {
            setEtapaCriando(`${resultado.linhas_sucesso} linhas importadas, ${resultado.linhas_erro} com erro. Criando sessao...`);
            await new Promise(r => setTimeout(r, 1500));
          } else {
            await new Promise(resolve => Alert.alert(
              'Importacao com erros',
              `${resultado.linhas_sucesso} linha(s) importadas, ${resultado.linhas_erro} com erro. A sessao sera criada mesmo assim.`,
              [{ text: 'Continuar', onPress: resolve }],
            ));
          }
        }
      }

      // Etapa 2: criar sessao
      setEtapaCriando('Criando sessao...');
      const sessao = await criarSessao({
        lojaId: lojaSelecionada.id,
        nome: nomeFinal,
        tipo,
        mesReferencia: mesRef,
        observacoes,
      });

      // Etapa 3: iniciar (opcional)
      if (iniciarImediatamente) {
        setEtapaCriando('Iniciando sessao...');
        await iniciarSessao(sessao.id);
        mostrarSucesso(
          'Sessao criada e iniciada!',
          `"${sessao.nome}" esta em andamento.`,
          () => navigation.goBack(),
        );
      } else {
        mostrarSucesso(
          'Sessao criada!',
          `"${sessao.nome}" foi criada com sucesso.`,
          () => navigation.goBack(),
        );
      }
    } catch (err) {
      mostrarErro(err.message || 'Tente novamente');
    } finally {
      setCriando(false);
      setEtapaCriando('');
    }
  }

  const podeSubmeter = lojaSelecionada && (mesReferencia || converterMes(mesManual)) && !criando;

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

        {/* ── LOJA ── */}
        <Text style={estilos.rotulo}>Loja *</Text>
        <TouchableOpacity style={estilos.seletor} onPress={() => setModalLojas(true)}>
          <Text style={lojaSelecionada ? estilos.seletorTexto : estilos.seletorPlaceholder} numberOfLines={1}>
            {lojaSelecionada ? `${lojaSelecionada.codigo} — ${lojaSelecionada.nome}` : 'Toque para selecionar a loja'}
          </Text>
          <Text style={estilos.seletorSeta}>▼</Text>
        </TouchableOpacity>

        {/* ── PLANILHA DE REFERENCIA ── */}
        <View style={{ height: spacing.lg }} />
        <Text style={estilos.rotulo}>Planilha de referencia (opcional)</Text>
        <Text style={estilos.descricaoBloco}>
          Arquivo .xlsx ou .csv com SKU, descricao, saldo e custo dos produtos.
          Se informado, sera importado automaticamente antes de criar a sessao.
        </Text>

        <TouchableOpacity style={estilos.botaoArquivo} onPress={selecionarArquivo}>
          {arquivo ? (
            <View style={estilos.arquivoSelecionado}>
              <Text style={estilos.arquivoIcone}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={estilos.arquivoNome} numberOfLines={1}>{arquivo.name}</Text>
                <Text style={estilos.arquivoTamanho}>
                  {arquivo.size ? `${(arquivo.size / 1024).toFixed(1)} KB` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setArquivo(null)} style={estilos.botaoRemoverArquivo}>
                <Text style={estilos.botaoRemoverTexto}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={estilos.botaoArquivoTexto}>Toque para selecionar planilha (.xlsx / .csv)</Text>
          )}
        </TouchableOpacity>

        {arquivo && (
          <View style={estilos.modoRow}>
            {['completo', 'parcial'].map(m => (
              <TouchableOpacity
                key={m}
                style={[estilos.chipModo, modoImport === m && estilos.chipModoAtivo]}
                onPress={() => setModoImport(m)}
              >
                <Text style={[estilos.chipModoTexto, modoImport === m && estilos.chipModoTextoAtivo]}>
                  {m === 'completo' ? 'Completo (zera ausentes)' : 'Parcial (so atualiza)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── MES DE REFERENCIA ── */}
        <View style={{ height: spacing.lg }} />
        <Text style={estilos.rotulo}>Mes de referencia *</Text>

        {carregandoMeses ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.sm }} />
        ) : meses.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={estilos.chipRow}>
                {meses.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[estilos.chipMes, mesReferencia === m && estilos.chipMesAtivo]}
                    onPress={() => { setMesReferencia(m); setMesManual(''); }}
                  >
                    <Text style={[estilos.chipMesTexto, mesReferencia === m && estilos.chipMesTextoAtivo]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={estilos.dica}>Ou informe um novo mes abaixo (caso tenha carregado nova planilha)</Text>
          </>
        ) : lojaSelecionada && !arquivo ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTexto}>
              Nenhum estoque importado para esta loja. Selecione uma planilha acima para importar, ou importe pela tela de Importacao.
            </Text>
          </View>
        ) : null}

        {/* Input manual de mes (quando ha arquivo ou sem meses pre-existentes) */}
        {(arquivo || (lojaSelecionada && meses.length === 0)) && (
          <TextInput
            style={[estilos.input, { marginTop: spacing.sm }]}
            value={mesManual}
            onChangeText={t => { setMesManual(t); setMesReferencia(''); }}
            placeholder="MM/AAAA  ex: 06/2026"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            maxLength={7}
          />
        )}

        {!lojaSelecionada && (
          <Text style={estilos.dica}>Selecione a loja para ver os meses disponíveis</Text>
        )}

        {/* ── NOME ── */}
        <View style={{ height: spacing.lg }} />
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

        {/* ── TIPO ── */}
        <View style={{ height: spacing.lg }} />
        <Text style={estilos.rotulo}>Tipo</Text>
        {TIPOS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[estilos.opcao, tipo === t.id && estilos.opcaoAtiva]}
            onPress={() => setTipo(t.id)}
          >
            <View style={[estilos.radio, tipo === t.id && estilos.radioAtivo]} />
            <View style={{ flex: 1 }}>
              <Text style={[estilos.opcaoRotulo, tipo === t.id && estilos.opcaoRotuloAtivo]}>{t.rotulo}</Text>
              <Text style={estilos.opcaoDescricao}>{t.descricao}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* ── OBSERVACOES ── */}
        <View style={{ height: spacing.lg }} />
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

        {/* ── INICIAR IMEDIATAMENTE ── */}
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

        {/* ── BOTOES ── */}
        <View style={{ height: spacing.lg }} />

        {/* Banner de erro visivel (essencial na web onde Alert nao aparece) */}
        {erroVisivel ? (
          <View style={estilos.bannerErro}>
            <Text style={estilos.bannerErroTexto}>{erroVisivel}</Text>
          </View>
        ) : null}

        {criando && etapaCriando ? (
          <View style={estilos.etapaContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={estilos.etapaTexto}>{etapaCriando}</Text>
          </View>
        ) : null}
        <Button
          titulo={arquivo ? 'Importar e criar sessao' : 'Criar sessao'}
          onPress={handleCriar}
          carregando={criando}
          desabilitado={!podeSubmeter}
        />
        <View style={{ height: spacing.sm }} />
        <Button titulo="Cancelar" variante="secondary" onPress={() => navigation.goBack()} desabilitado={criando} />
        <View style={{ height: spacing.lg }} />
      </ScrollView>

      {/* ── MODAL DE SELECAO DE LOJA (rolagem correta) ── */}
      <Modal visible={modalLojas} animationType="slide" transparent onRequestClose={() => setModalLojas(false)}>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContainer}>

            <View style={estilos.modalHeader}>
              <Text style={estilos.modalTitulo}>Selecione a loja</Text>
              <TouchableOpacity onPress={() => setModalLojas(false)} style={estilos.modalFechar}>
                <Text style={estilos.modalFecharTexto}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={estilos.modalLista}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {lojas.map(loja => {
                const ativa = lojaSelecionada?.id === loja.id;
                return (
                  <TouchableOpacity
                    key={loja.id}
                    style={[estilos.modalItem, ativa && estilos.modalItemAtivo]}
                    onPress={() => aoSelecionarLoja(loja)}
                    activeOpacity={0.7}
                  >
                    <View style={[estilos.modalItemBadge, ativa && estilos.modalItemBadgeAtivo]}>
                      <Text style={[estilos.modalItemCodigo, ativa && { color: colors.white }]}>
                        {loja.codigo}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[estilos.modalItemNome, ativa && estilos.modalItemNomeAtivo]}
                        numberOfLines={1}
                      >
                        {loja.nome}
                      </Text>
                      {loja.cidade ? (
                        <Text style={estilos.modalItemCidade} numberOfLines={1}>{loja.cidade}</Text>
                      ) : null}
                    </View>
                    {ativa && <Text style={estilos.modalItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: spacing.lg },

  rotulo: {
    fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  descricaoBloco: {
    fontSize: fontSize.sm, color: colors.textSecondary,
    marginBottom: spacing.sm, lineHeight: 20,
  },
  dica: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },

  // Seletor de loja (abre modal)
  seletor: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, padding: spacing.md,
  },
  seletorTexto:       { fontSize: fontSize.md, color: colors.text, flex: 1 },
  seletorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted, flex: 1 },
  seletorSeta:        { fontSize: fontSize.sm, color: colors.primary, marginLeft: spacing.sm },

  // Planilha de referencia
  botaoArquivo: {
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md, padding: spacing.md, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.background, minHeight: 70,
  },
  botaoArquivoTexto: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  arquivoSelecionado: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  arquivoIcone:  { fontSize: 24, marginRight: spacing.sm },
  arquivoNome:   { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  arquivoTamanho:{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  botaoRemoverArquivo: { padding: spacing.sm },
  botaoRemoverTexto:   { fontSize: fontSize.md, color: colors.danger, fontWeight: '700' },
  modoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chipModo: {
    flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.backgroundSoft,
  },
  chipModoAtivo: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipModoTexto: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  chipModoTextoAtivo: { color: colors.primary, fontWeight: '600' },

  // Chips de mes
  chipRow:          { flexDirection: 'row', gap: spacing.xs, paddingBottom: 4 },
  chipMes:          { paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
                      backgroundColor: colors.backgroundSoft },
  chipMesAtivo:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipMesTexto:     { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  chipMesTextoAtivo:{ color: colors.white, fontWeight: '700' },

  // Aviso sem estoque
  aviso:      { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md,
                borderLeftWidth: 4, borderLeftColor: colors.warning },
  avisoTexto: { fontSize: fontSize.sm, color: colors.text },

  // Input texto
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text,
  },

  // Tipo de sessao
  opcao:           { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
                     borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs,
                     borderWidth: 1, borderColor: colors.border },
  opcaoAtiva:      { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio:           { width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                     borderColor: colors.border, marginRight: spacing.sm, flexShrink: 0 },
  radioAtivo:      { borderColor: colors.primary, backgroundColor: colors.primary },
  opcaoRotulo:     { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  opcaoRotuloAtivo:{ color: colors.primary },
  opcaoDescricao:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Toggle iniciar
  toggleIniciar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  checkbox:        { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2,
                     borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxAtivo:   { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick:    { color: colors.white, fontWeight: '700', fontSize: 13 },
  toggleRotulo:    { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  toggleDescricao: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Etapa de progresso
  etapaContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    marginBottom: spacing.sm, gap: spacing.sm },
  etapaTexto:     { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },
  bannerErro: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  bannerErroTexto: {
    fontSize: fontSize.sm,
    color: '#DC2626',
    fontWeight: '500',
  },

  // Modal de selecao de loja
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitulo:      { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalFechar:      { padding: spacing.xs },
  modalFecharTexto: { fontSize: fontSize.lg, color: colors.textMuted },
  modalLista:       { flexGrow: 0 },   // nao cresce alem do maxHeight do pai

  modalItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalItemAtivo:   { backgroundColor: colors.primarySoft },
  modalItemBadge: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.backgroundSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0,
    borderWidth: 1, borderColor: colors.border,
  },
  modalItemBadgeAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  modalItemCodigo:  { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  modalItemNome:    { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  modalItemNomeAtivo: { color: colors.primary },
  modalItemCidade:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  modalItemCheck:   { fontSize: fontSize.lg, color: colors.primary, marginLeft: spacing.sm },
});
