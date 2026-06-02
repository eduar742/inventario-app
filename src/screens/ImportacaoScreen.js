// Tela de importacao. Duas abas:
//  1. Estoque — importa saldos de estoque (comportamento atual)
//  2. Historico — importa inventario ja realizado (cria sessao concluida)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { avisar } from '../utils/alertas';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { listarLojas, listarNaturezas, importarPlanilha, importarInventarioHistorico } from '../services/api';


const MODOS = [
  { valor: 'completo', rotulo: 'Completo', descricao: 'Processa tudo e zera produtos ausentes' },
  { valor: 'parcial', rotulo: 'Parcial', descricao: 'Somente atualiza o que esta no arquivo' },
];

export default function ImportacaoScreen({ navigation }) {
  const [aba, setAba] = useState('estoque'); // 'estoque' ou 'historico'
  const [lojas, setLojas] = useState([]);
  const [naturezas, setNaturezas] = useState([]);
  const [carregandoLojas, setCarregandoLojas] = useState(true);
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [mesAno, setMesAno] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [modo, setModo] = useState('completo');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [expandirLojas, setExpandirLojas] = useState(false);
  // Campos extras para importacao historica
  const [nomeSessao, setNomeSessao] = useState('');
  const [naturezaSel, setNaturezaSel] = useState(null); // objeto natureza

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const [ls, ns] = await Promise.all([listarLojas(), listarNaturezas().catch(() => [])]);
      setLojas(ls);
      setNaturezas(ns);
    } catch (err) {
      avisar('Erro', 'Nao foi possivel carregar as lojas');
    } finally {
      setCarregandoLojas(false);
    }
  }

  async function selecionarArquivo() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
          'application/vnd.ms-excel',                                           // xls
          'text/csv',
          'text/comma-separated-values',
          '*/*', // fallback para dispositivos que nao filtram corretamente
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;

      const asset = res.assets[0];
      const nome = asset.name.toLowerCase();
      if (!nome.endsWith('.xlsx') && !nome.endsWith('.xls') && !nome.endsWith('.csv')) {
        avisar('Formato invalido', 'Use arquivos .xlsx, .xls ou .csv');
        return;
      }

      setArquivo(asset);
      setResultado(null);
    } catch (err) {
      avisar('Erro', 'Nao foi possivel selecionar o arquivo');
    }
  }

  function validarMesAno(valor) {
    // Aceita MM/YYYY
    return /^\d{2}\/\d{4}$/.test(valor);
  }

  function converterMesReferencia(mmYYYY) {
    // MM/YYYY -> YYYY-MM
    const [mm, yyyy] = mmYYYY.split('/');
    return `${yyyy}-${mm}`;
  }

  async function handleImportar() {
    if (!lojaSelecionada) { avisar('Atencao', 'Selecione uma loja'); return; }
    if (!validarMesAno(mesAno)) { avisar('Atencao', 'Informe o mes no formato MM/AAAA (ex: 01/2026)'); return; }
    if (!arquivo) { avisar('Atencao', 'Selecione o arquivo da planilha'); return; }

    setImportando(true); setResultado(null);
    try {
      const res = await importarPlanilha({
        lojaId: lojaSelecionada.id,
        mesReferencia: converterMesReferencia(mesAno),
        arquivo, modo,
      });
      setResultado({ ...res, tipo: 'estoque' });
    } catch (err) {
      avisar('Erro na importacao', err.message || 'Tente novamente');
    } finally { setImportando(false); }
  }

  async function handleImportarHistorico() {
    if (!lojaSelecionada) { avisar('Atencao', 'Selecione uma loja'); return; }
    if (!validarMesAno(mesAno)) { avisar('Atencao', 'Informe o mes no formato MM/AAAA'); return; }
    if (!arquivo) { avisar('Atencao', 'Selecione o arquivo da planilha'); return; }

    setImportando(true); setResultado(null);
    try {
      const res = await importarInventarioHistorico({
        lojaId: lojaSelecionada.id,
        mesReferencia: converterMesReferencia(mesAno),
        nomeSessao: nomeSessao.trim() || null,
        naturezaId: naturezaSel?.id || null,
        arquivo,
      });
      setResultado({ ...res, tipo: 'historico' });
    } catch (err) {
      avisar('Erro na importacao', err.message || 'Tente novamente');
    } finally { setImportando(false); }
  }

  function novaImportacao() {
    setArquivo(null); setResultado(null);
    setMesAno(''); setLojaSelecionada(null);
    setNomeSessao(''); setNaturezaSel(null);
  }

  if (carregandoLojas) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Tela de resultado
  if (resultado) {
    const icone = resultado.status === 'sucesso' ? '✓' : resultado.status === 'parcial' ? '!' : '✗';
    const corStatus = resultado.status === 'sucesso' ? colors.success
      : resultado.status === 'parcial' ? colors.warning : colors.danger;
    const isHistorico = resultado.tipo === 'historico';

    return (
      <SafeAreaView style={estilos.container}>
        <ScrollView contentContainerStyle={estilos.scroll}>
          <View style={[estilos.resultadoIcone, { backgroundColor: corStatus + '22' }]}>
            <Text style={[estilos.resultadoIconeTexto, { color: corStatus }]}>{icone}</Text>
          </View>

          <Text style={[estilos.resultadoTitulo, { color: corStatus }]}>
            {resultado.status === 'sucesso'
              ? (isHistorico ? 'Inventario historico importado!' : 'Importacao concluida!')
              : resultado.status === 'parcial'
                ? (isHistorico ? 'Importado com alertas' : 'Importacao parcial')
                : 'Importacao falhou'}
          </Text>

          <View style={estilos.cardResultado}>
            {isHistorico ? (
              <>
                <LinhaStat rotulo="Produtos importados" valor={resultado.linhas_importadas} cor={colors.success} />
                <LinhaStat rotulo="Divergencias criadas" valor={resultado.divergencias_criadas} cor={resultado.divergencias_criadas > 0 ? colors.warning : colors.success} />
                {resultado.linhas_erro > 0 && (
                  <LinhaStat rotulo="Linhas com erro" valor={resultado.linhas_erro} cor={colors.danger} />
                )}
                {resultado.sessao_nome && (
                  <LinhaStat rotulo="Sessao criada" valor={resultado.sessao_nome} />
                )}
              </>
            ) : (
              <>
                <LinhaStat rotulo="Total de linhas" valor={resultado.linhas_total} />
                <LinhaStat rotulo="Importadas com sucesso" valor={resultado.linhas_sucesso} cor={colors.success} />
                {resultado.linhas_erro > 0 && (
                  <LinhaStat rotulo="Com erro" valor={resultado.linhas_erro} cor={colors.danger} />
                )}
              </>
            )}
          </View>

          {resultado.erros && resultado.erros.length > 0 && (
            <View style={estilos.secaoErros}>
              <Text style={estilos.secaoErrosTitulo}>
                Primeiros {Math.min(resultado.erros.length, 10)} erros:
              </Text>
              {resultado.erros.slice(0, 10).map((e, i) => (
                <View key={i} style={estilos.cardErro}>
                  <Text style={estilos.erroLinha}>Linha {e.linha} — {e.campo}</Text>
                  <Text style={estilos.erroMsg}>{e.mensagem}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: spacing.xl }} />
          <Button titulo="Nova importacao" onPress={novaImportacao} />
          <View style={{ height: spacing.sm }} />
          <Button titulo="Ver historico" variante="secondary" onPress={() => navigation.navigate('HistoricoImportacoes')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Componente reutilizavel: seletor de loja
  const SeletorLoja = () => (
    <>
      <Text style={estilos.rotulo}>Loja</Text>
      <TouchableOpacity style={estilos.seletor} onPress={() => setExpandirLojas(!expandirLojas)}>
        <Text style={lojaSelecionada ? estilos.seletorTexto : estilos.seletorPlaceholder}>
          {lojaSelecionada ? `${lojaSelecionada.codigo} — ${lojaSelecionada.nome}` : 'Selecione a loja'}
        </Text>
        <Text style={estilos.seletorSeta}>{expandirLojas ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expandirLojas && (
        <ScrollView style={estilos.dropdown} nestedScrollEnabled>
          {lojas.map(loja => (
            <TouchableOpacity key={loja.id}
              style={[estilos.dropdownItem, lojaSelecionada?.id === loja.id && estilos.dropdownItemAtivo]}
              onPress={() => { setLojaSelecionada(loja); setExpandirLojas(false); }}>
              <Text style={[estilos.dropdownItemTexto, lojaSelecionada?.id === loja.id && estilos.dropdownItemTextoAtivo]}>
                {loja.codigo} — {loja.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </>
  );

  // Componente reutilizavel: seletor de mes
  const SeletorMes = () => (
    <>
      <View style={{ height: spacing.md }} />
      <Text style={estilos.rotulo}>Mes de referencia</Text>
      <View style={estilos.inputContainer}>
        <Text style={estilos.inputDica}>Formato: MM/AAAA</Text>
        <View style={estilos.inputRow}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => {
            const anoAtual = new Date().getFullYear();
            const val = `${m}/${anoAtual}`;
            const ativo = mesAno === val;
            return (
              <TouchableOpacity key={m} style={[estilos.chipMes, ativo && estilos.chipMesAtivo]} onPress={() => setMesAno(val)}>
                <Text style={[estilos.chipMesTexto, ativo && estilos.chipMesTextoAtivo]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {mesAno ? <Text style={estilos.mesSelecionado}>Selecionado: {mesAno} → {converterMesReferencia(mesAno)}</Text> : null}
      </View>
    </>
  );

  // Componente reutilizavel: seletor de arquivo
  const SeletorArquivo = () => (
    <>
      <View style={{ height: spacing.md }} />
      <Text style={estilos.rotulo}>Arquivo</Text>
      <TouchableOpacity style={estilos.botaoArquivo} onPress={selecionarArquivo}>
        {arquivo ? (
          <View>
            <Text style={estilos.arquivoNome}>{arquivo.name}</Text>
            <Text style={estilos.arquivoTamanho}>{arquivo.size ? `${(arquivo.size / 1024).toFixed(1)} KB` : ''}</Text>
          </View>
        ) : (
          <Text style={estilos.botaoArquivoTexto}>Toque para selecionar .xlsx / .xls / .csv</Text>
        )}
      </TouchableOpacity>
    </>
  );

  // Tela de formulario
  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">

        {/* Abas: Estoque / Historico */}
        <View style={estilos.abaRow}>
          <TouchableOpacity
            style={[estilos.aba, aba === 'estoque' && estilos.abaAtiva]}
            onPress={() => { setAba('estoque'); setResultado(null); setArquivo(null); }}
          >
            <Text style={[estilos.abaTxt, aba === 'estoque' && estilos.abaTxtAtivo]}>📦 Estoque</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[estilos.aba, aba === 'historico' && estilos.abaAtiva]}
            onPress={() => { setAba('historico'); setResultado(null); setArquivo(null); }}
          >
            <Text style={[estilos.abaTxt, aba === 'historico' && estilos.abaTxtAtivo]}>📋 Inventário Histórico</Text>
          </TouchableOpacity>
        </View>

        {/* ── ABA ESTOQUE (comportamento atual) ────────────────────── */}
        {aba === 'estoque' && (
          <>
            <View style={estilos.infoBox}>
              <Text style={estilos.infoTxt}>
                Importa saldos de estoque do ERP.{'\n'}
                Colunas: Natureza, Codigo, Descricao, UnidadeMedida, SaldoEstoque, CustoUnitario
              </Text>
            </View>
            <SeletorLoja />
            <SeletorMes />

            <View style={{ height: spacing.md }} />
            <Text style={estilos.rotulo}>Modo de importacao</Text>
            {MODOS.map(m => (
              <TouchableOpacity key={m.valor} style={[estilos.cardModo, modo === m.valor && estilos.cardModoAtivo]} onPress={() => setModo(m.valor)}>
                <View style={estilos.cardModoHeader}>
                  <View style={[estilos.radio, modo === m.valor && estilos.radioAtivo]} />
                  <Text style={[estilos.cardModoRotulo, modo === m.valor && estilos.cardModoRotuloAtivo]}>{m.rotulo}</Text>
                </View>
                <Text style={estilos.cardModoDescricao}>{m.descricao}</Text>
              </TouchableOpacity>
            ))}

            <SeletorArquivo />
            <View style={{ height: spacing.xl }} />
            <Button titulo="Importar estoque" onPress={handleImportar} carregando={importando}
              desabilitado={!lojaSelecionada || !validarMesAno(mesAno) || !arquivo || importando} />
          </>
        )}

        {/* ── ABA HISTÓRICO ─────────────────────────────────────────── */}
        {aba === 'historico' && (
          <>
            <View style={[estilos.infoBox, { borderColor: '#0D9488', backgroundColor: '#F0FDFA' }]}>
              <Text style={[estilos.infoTxt, { color: '#0D9488' }]}>
                Importa inventário realizado antes do app.{'\n'}
                Cria uma sessão já concluída com contagens e divergências.{'\n\n'}
                Colunas obrigatórias:{'\n'}
                Natureza | Codigo | Descricao | UnidadeMedida{'\n'}
                SaldoSistema | QuantidadeContada{'\n\n'}
                Opcional: CustoUnitario | GrupoMaterial
              </Text>
            </View>

            <SeletorLoja />
            <SeletorMes />

            {/* Natureza (opcional) */}
            <View style={{ height: spacing.md }} />
            <Text style={estilos.rotulo}>Natureza (opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TouchableOpacity
                  style={[estilos.chipMes, !naturezaSel && estilos.chipMesAtivo]}
                  onPress={() => setNaturezaSel(null)}
                >
                  <Text style={[estilos.chipMesTexto, !naturezaSel && estilos.chipMesTextoAtivo]}>Todas</Text>
                </TouchableOpacity>
                {naturezas.map(n => (
                  <TouchableOpacity key={n.id}
                    style={[estilos.chipMes, naturezaSel?.id === n.id && estilos.chipMesAtivo]}
                    onPress={() => setNaturezaSel(n)}>
                    <Text style={[estilos.chipMesTexto, naturezaSel?.id === n.id && estilos.chipMesTextoAtivo]}>
                      {n.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Nome da sessao */}
            <View style={{ height: spacing.sm }} />
            <Text style={estilos.rotulo}>Nome da sessão (opcional)</Text>
            <TextInput
              style={estilos.inputNome}
              value={nomeSessao}
              onChangeText={setNomeSessao}
              placeholder={lojaSelecionada && mesAno
                ? `Inventario Historico ${lojaSelecionada.codigo} ${converterMesReferencia(mesAno)}`
                : 'Ex: Inventario Maio 2025 — ACM'}
              placeholderTextColor={colors.textMuted}
            />

            <SeletorArquivo />
            <View style={{ height: spacing.xl }} />
            <Button titulo="Importar inventario historico" onPress={handleImportarHistorico} carregando={importando}
              desabilitado={!lojaSelecionada || !validarMesAno(mesAno) || !arquivo || importando} />
          </>
        )}

        <View style={{ height: spacing.sm }} />
        <Button titulo="Ver historico de importacoes" variante="secondary" onPress={() => navigation.navigate('HistoricoImportacoes')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function LinhaStat({ rotulo, valor, cor }) {
  return (
    <View style={estilos.linhaStat}>
      <Text style={estilos.linhaStatRotulo}>{rotulo}</Text>
      <Text style={[estilos.linhaStatValor, cor && { color: cor }]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  // Abas
  abaRow: { flexDirection: 'row', marginBottom: spacing.md, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  aba:     { flex: 1, padding: spacing.sm, alignItems: 'center', backgroundColor: colors.backgroundSoft },
  abaAtiva: { backgroundColor: colors.primary },
  abaTxt:   { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  abaTxtAtivo: { color: colors.white },
  // Info box
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#BFDBFE' },
  infoTxt: { fontSize: 11, color: '#1E40AF', lineHeight: 18 },
  // Input nome sessao
  inputNome: { backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.sm, color: colors.text },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
  },
  rotulo: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seletor: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seletorTexto: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  seletorPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  seletorSeta: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  dropdown: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    maxHeight: 220,
    overflow: 'scroll',
  },
  dropdownItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemAtivo: {
    backgroundColor: colors.primarySoft,
  },
  dropdownItemTexto: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  dropdownItemTextoAtivo: {
    color: colors.primary,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inputDica: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipMes: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  chipMesAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipMesTexto: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipMesTextoAtivo: {
    color: colors.white,
    fontWeight: '600',
  },
  mesSelecionado: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  cardModo: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardModoAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardModoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  radioAtivo: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  cardModoRotulo: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  cardModoRotuloAtivo: {
    color: colors.primary,
  },
  cardModoDescricao: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: 24,
  },
  botaoArquivo: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  botaoArquivoTexto: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  arquivoNome: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  arquivoTamanho: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  // Resultado
  resultadoIcone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  resultadoIconeTexto: {
    fontSize: 30,
    fontWeight: '800',
  },
  resultadoTitulo: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cardResultado: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  linhaStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linhaStatRotulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  linhaStatValor: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  secaoErros: {
    marginBottom: spacing.md,
  },
  secaoErrosTitulo: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardErro: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  erroLinha: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 2,
  },
  erroMsg: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
});
