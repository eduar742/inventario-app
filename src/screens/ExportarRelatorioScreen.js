// Tela de selecao de perfil e formato para exportacao de relatorio de sessao.
// Apenas para ADM e Gestor, apenas em sessoes concluidas.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { listarPerfisRelatorio, baixarRelatorio } from '../services/api';


const FORMATOS = [
  { id: 'xlsx', rotulo: 'Excel (.xlsx)', descricao: 'Multi-aba, completo, com formatacao' },
  { id: 'pdf',  rotulo: 'PDF (.pdf)',    descricao: 'Visual resumido, top 50 divergencias' },
  { id: 'csv',  rotulo: 'CSV (.zip)',    descricao: '1 arquivo por aba, separador ponto-e-virgula' },
];

const ABAS_DISPONIVEIS = [
  { id: 'resumo',          rotulo: 'Resumo' },
  { id: 'contagens',       rotulo: 'Contagens' },
  { id: 'pendentes',       rotulo: 'Pendentes' },
  { id: 'divergencias',    rotulo: 'Divergencias' },
  { id: 'top_divergencias', rotulo: 'Top 10 Divergencias' },
  { id: 'audit_log',       rotulo: 'Audit Log' },
  { id: 'metadados',       rotulo: 'Metadados' },
];

export default function ExportarRelatorioScreen({ navigation, route }) {
  const { sessao, loja } = route.params;

  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formato, setFormato] = useState('xlsx');
  const [perfilId, setPerfilId] = useState('operacional');
  const [abasSelecionadas, setAbasSelecionadas] = useState(['resumo', 'contagens']);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    carregarPerfis();
  }, []);

  async function carregarPerfis() {
    try {
      const dados = await listarPerfisRelatorio();
      setPerfis(dados);
    } catch (err) {
      Alert.alert('Erro', 'Nao foi possivel carregar os perfis');
    } finally {
      setCarregando(false);
    }
  }

  function toggleAba(abaId) {
    setAbasSelecionadas(prev =>
      prev.includes(abaId) ? prev.filter(a => a !== abaId) : [...prev, abaId]
    );
  }

  function _avisar(titulo, msg) {
    if (Platform.OS === 'web') window.alert(msg ? `${titulo}\n\n${msg}` : titulo);
    else Alert.alert(titulo, msg);
  }

  async function handleGerar() {
    if (perfilId === 'customizado' && abasSelecionadas.length === 0) {
      _avisar('Atencao', 'Selecione pelo menos uma aba para o perfil customizado');
      return;
    }

    setGerando(true);
    try {
      const { base64, nomeArquivo } = await baixarRelatorio({
        sessaoId: sessao.id,
        formato,
        perfil: perfilId,
        abas: perfilId === 'customizado' ? abasSelecionadas : undefined,
      });

      if (Platform.OS === 'web') {
        // Web: download direto via <a>
        const mime = nomeArquivo.endsWith('.pdf') ? 'application/pdf'
          : nomeArquivo.endsWith('.zip') ? 'application/zip'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const bytes = atob(base64);
        const buf = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
        const blob = new Blob([buf], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
      } else {
        // Mobile: salva e compartilha
        const { default: FileSystem } = await import('expo-file-system');
        const Sharing = await import('expo-sharing');
        const destino = FileSystem.documentDirectory + nomeArquivo;
        await FileSystem.writeAsStringAsync(destino, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const podeCompartilhar = await Sharing.isAvailableAsync();
        if (podeCompartilhar) {
          await Sharing.shareAsync(destino, { dialogTitle: 'Exportar relatorio' });
        } else {
          _avisar('Arquivo salvo', `Salvo: ${nomeArquivo}`);
        }
        try { await FileSystem.deleteAsync(destino, { idempotent: true }); } catch (_) {}
      }
    } catch (err) {
      _avisar('Erro ao gerar relatorio', err?.message || 'Tente novamente');
      console.error('[ExportarRelatorio]', err);
    } finally {
      setGerando(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const perfilAtual = perfis.find(p => p.id === perfilId);

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">

        {/* Info da sessao */}
        <View style={estilos.cardSessao}>
          <Text style={estilos.sessaoNome}>{sessao.nome}</Text>
          <Text style={estilos.sessaoInfo}>{loja?.codigo} — {sessao.mes_referencia || ''}</Text>
        </View>

        {/* Formato */}
        <Text style={estilos.secaoTitulo}>Formato</Text>
        {FORMATOS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[estilos.opcao, formato === f.id && estilos.opcaoAtiva]}
            onPress={() => setFormato(f.id)}
          >
            <View style={[estilos.radio, formato === f.id && estilos.radioAtivo]} />
            <View style={estilos.opcaoTextos}>
              <Text style={[estilos.opcaoRotulo, formato === f.id && estilos.opcaoRotuloAtivo]}>
                {f.rotulo}
              </Text>
              <Text style={estilos.opcaoDescricao}>{f.descricao}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Perfil */}
        <View style={{ height: spacing.md }} />
        <Text style={estilos.secaoTitulo}>Perfil de auditoria</Text>
        {perfis.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[estilos.opcao, perfilId === p.id && estilos.opcaoAtiva]}
            onPress={() => setPerfilId(p.id)}
          >
            <View style={[estilos.radio, perfilId === p.id && estilos.radioAtivo]} />
            <View style={estilos.opcaoTextos}>
              <Text style={[estilos.opcaoRotulo, perfilId === p.id && estilos.opcaoRotuloAtivo]}>
                {p.nome}
              </Text>
              <Text style={estilos.opcaoDescricao}>{p.descricao}</Text>
              {p.abas && (
                <Text style={estilos.opcaoAbas}>{p.abas.join(', ')}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Abas customizadas */}
        {perfilId === 'customizado' && (
          <>
            <View style={{ height: spacing.sm }} />
            <Text style={estilos.secaoTitulo}>Abas a incluir</Text>
            <View style={estilos.checkboxLista}>
              {ABAS_DISPONIVEIS.map(aba => {
                const marcado = abasSelecionadas.includes(aba.id);
                return (
                  <TouchableOpacity
                    key={aba.id}
                    style={estilos.checkboxItem}
                    onPress={() => toggleAba(aba.id)}
                  >
                    <View style={[estilos.checkbox, marcado && estilos.checkboxMarcado]}>
                      {marcado && <Text style={estilos.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={estilos.checkboxTexto}>{aba.rotulo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: spacing.xl }} />
        <Button
          titulo={gerando ? 'Gerando relatorio...' : 'Gerar e baixar'}
          onPress={handleGerar}
          carregando={gerando}
          desabilitado={gerando}
        />
        <View style={{ height: spacing.sm }} />
        <Button
          titulo="Cancelar"
          variante="secondary"
          onPress={() => navigation.goBack()}
          desabilitado={gerando}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg },
  cardSessao: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  sessaoNome: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  sessaoInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  secaoTitulo: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  opcao: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  opcaoAtiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.border,
    marginRight: spacing.sm, marginTop: 2,
  },
  radioAtivo: { borderColor: colors.primary, backgroundColor: colors.primary },
  opcaoTextos: { flex: 1 },
  opcaoRotulo: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  opcaoRotuloAtivo: { color: colors.primary },
  opcaoDescricao: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  opcaoAbas: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  checkboxLista: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 2, borderColor: colors.border,
    marginRight: spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  checkboxMarcado: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.white, fontWeight: '700', fontSize: 13 },
  checkboxTexto: { fontSize: fontSize.md, color: colors.text },
});
