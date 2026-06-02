// Tela de relatorio consolidado — todas as lojas em um unico Excel.
// Separado por natureza (Venda / Quarentena) e com filtro de mes.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { listarNaturezas, baixarRelatorioConsolidado } from '../services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function RelatorioConsolidadoScreen({ navigation }) {
  const [naturezas, setNaturezas] = useState([]);
  const [naturezaSel, setNaturezaSel] = useState(null); // null = todas
  const [mesSel, setMesSel] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarNaturezas().then(setNaturezas).catch(() => {});
  }, []);

  async function gerarRelatorio() {
    setGerando(true);
    setErro('');
    try {
      const { base64, nomeArquivo } = await baixarRelatorioConsolidado({
        naturezaId: naturezaSel,
        mesReferencia: mesSel || undefined,
      });

      if (Platform.OS === 'web') {
        // Download direto no browser
        const byteChars = atob(base64);
        const byteNums = Array.from(byteChars).map(c => c.charCodeAt(0));
        const blob = new Blob([new Uint8Array(byteNums)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const caminho = `${FileSystem.documentDirectory}${nomeArquivo}`;
        await FileSystem.writeAsStringAsync(caminho, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(caminho, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Salvar relatorio consolidado',
        });
      }
    } catch (err) {
      setErro(err.message || 'Erro ao gerar relatorio');
    } finally {
      setGerando(false);
    }
  }

  const MESES_OPCOES = (() => {
    const arr = [];
    const hoje = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      arr.push(val);
    }
    return arr;
  })();

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll}>

        <View style={estilos.cabecalho}>
          <Text style={estilos.cabecalhoTitulo}>Relatorio Geral</Text>
          <Text style={estilos.cabecalhoSub}>
            Exporta todas as lojas em um unico Excel, separado por natureza.
          </Text>
        </View>

        {/* Filtro natureza */}
        <Text style={estilos.label}>Natureza</Text>
        <View style={estilos.chips}>
          <TouchableOpacity
            style={[estilos.chip, naturezaSel === null && estilos.chipAtivo]}
            onPress={() => setNaturezaSel(null)}
          >
            <Text style={[estilos.chipTexto, naturezaSel === null && estilos.chipTextoAtivo]}>
              Todas
            </Text>
          </TouchableOpacity>
          {naturezas.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[estilos.chip, naturezaSel === n.id && estilos.chipAtivo]}
              onPress={() => setNaturezaSel(n.id)}
            >
              <Text style={[estilos.chipTexto, naturezaSel === n.id && estilos.chipTextoAtivo]}>
                {n.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtro mes */}
        <Text style={[estilos.label, { marginTop: spacing.md }]}>Mes de referencia (opcional)</Text>
        <View style={estilos.chips}>
          <TouchableOpacity
            style={[estilos.chip, mesSel === '' && estilos.chipAtivo]}
            onPress={() => setMesSel('')}
          >
            <Text style={[estilos.chipTexto, mesSel === '' && estilos.chipTextoAtivo]}>Todos</Text>
          </TouchableOpacity>
          {MESES_OPCOES.map(m => (
            <TouchableOpacity
              key={m}
              style={[estilos.chip, mesSel === m && estilos.chipAtivo]}
              onPress={() => setMesSel(m)}
            >
              <Text style={[estilos.chipTexto, mesSel === m && estilos.chipTextoAtivo]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Descricao do que sera gerado */}
        <View style={estilos.info}>
          <Text style={estilos.infoTexto}>
            O relatorio incluira a sessao mais recente concluida de cada loja
            {naturezaSel
              ? ` para ${naturezas.find(n => n.id === naturezaSel)?.nome || naturezaSel}`
              : ' (todas as naturezas)'}
            {mesSel ? ` no mes ${mesSel}` : ''}.
          </Text>
          <Text style={estilos.infoTexto}>
            Cores: verde = acuracidade >= 99%, amarelo = 90-99%, vermelho = abaixo de 90%.
          </Text>
        </View>

        {erro ? (
          <View style={estilos.erroCard}>
            <Text style={estilos.erroTexto}>{erro}</Text>
          </View>
        ) : null}

        <View style={{ height: spacing.lg }} />

        <Button
          titulo={gerando ? 'Gerando relatorio...' : 'Gerar e baixar Excel'}
          carregando={gerando}
          onPress={gerarRelatorio}
        />

        <View style={{ height: spacing.sm }} />

        <Button
          titulo="Voltar"
          variante="secondary"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  scroll: { padding: spacing.lg },
  cabecalho: { marginBottom: spacing.lg },
  cabecalhoTitulo: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  cabecalhoSub: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipTextoAtivo: { color: colors.white },
  info: {
    backgroundColor: colors.primarySoft, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.lg,
    borderLeftWidth: 4, borderLeftColor: colors.primary,
    gap: spacing.xs,
  },
  infoTexto: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  erroCard: {
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
    borderLeftWidth: 4, borderLeftColor: colors.danger,
  },
  erroTexto: { fontSize: fontSize.sm, color: colors.danger },
});
