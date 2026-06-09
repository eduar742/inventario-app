// Tela de relatorio geral.
// Secao 1: relatorio consolidado de todas as lojas em Excel.
// Secao 2: exportar sessao individual — filtro por loja e status.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import {
  listarNaturezas, baixarRelatorioConsolidado,
  listarLojas, listarSessoes,
} from '../services/api';

function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const MESES_OPCOES = (() => {
  const arr = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
})();

export default function RelatorioConsolidadoScreen({ navigation }) {
  // ── Secao 1: consolidado ─────────────────────────────────────────────
  const [naturezas, setNaturezas]     = useState([]);
  const [naturezaSel, setNaturezaSel] = useState(null);
  const [mesSel, setMesSel]           = useState('');
  const [gerando, setGerando]         = useState(false);
  const [erro, setErro]               = useState('');

  // ── Secao 2: sessao individual ───────────────────────────────────────
  const [lojas, setLojas]                   = useState([]);
  const [lojaSel, setLojaSel]               = useState(null);
  const [statusSessoes, setStatusSessoes]   = useState('concluida');
  const [sessoes, setSessoes]               = useState([]);
  const [carregandoSessoes, setCarregandoSessoes] = useState(false);

  useEffect(() => {
    listarNaturezas().then(setNaturezas).catch(() => {});
    listarLojas().then(dados => setLojas(dados || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!lojaSel) { setSessoes([]); return; }
    carregarSessoes();
  }, [lojaSel, statusSessoes]);

  async function carregarSessoes() {
    setCarregandoSessoes(true);
    try {
      if (statusSessoes === 'ativas') {
        const [andamento, aguardando] = await Promise.all([
          listarSessoes({ loja_id: lojaSel, status: 'em_andamento' }, 1, 100),
          listarSessoes({ loja_id: lojaSel, status: 'aguardando_aprovacao' }, 1, 100),
        ]);
        setSessoes([...(aguardando.items || []), ...(andamento.items || [])]);
      } else {
        const dados = await listarSessoes({ loja_id: lojaSel, status: 'concluida' }, 1, 100);
        setSessoes(dados.items || []);
      }
    } catch (_) {
      setSessoes([]);
    } finally {
      setCarregandoSessoes(false);
    }
  }

  async function gerarRelatorio() {
    setGerando(true);
    setErro('');
    try {
      const { base64, nomeArquivo } = await baixarRelatorioConsolidado({
        naturezaId: naturezaSel,
        mesReferencia: mesSel || undefined,
      });

      if (Platform.OS === 'web') {
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
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');
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

  function badgeStatusCor(status) {
    const m = {
      'em_andamento':         { bg: colors.infoSoft,    txt: colors.info,    label: 'Em andamento' },
      'aguardando_aprovacao': { bg: colors.warningSoft, txt: colors.warning, label: 'Aguard. aprovacao' },
      'concluida':            { bg: colors.successSoft, txt: colors.success, label: 'Concluida' },
    };
    return m[status] || { bg: colors.backgroundSoft, txt: colors.textSecondary, label: status };
  }

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll}>

        {/* ── SECAO 1: Relatorio consolidado ───────────────────────── */}
        <View style={estilos.secaoCard}>
          <Text style={estilos.secaoTitulo}>Relatorio Consolidado</Text>
          <Text style={estilos.secaoSub}>
            Todas as lojas em um unico Excel, separado por natureza.
          </Text>

          <Text style={[estilos.label, { marginTop: spacing.md }]}>Natureza</Text>
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

          <Text style={[estilos.label, { marginTop: spacing.md }]}>Mes de referencia</Text>
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

          {erro ? (
            <View style={estilos.erroCard}>
              <Text style={estilos.erroTexto}>{erro}</Text>
            </View>
          ) : null}

          <View style={{ height: spacing.md }} />
          <Button
            titulo={gerando ? 'Gerando...' : 'Gerar e baixar Excel'}
            carregando={gerando}
            onPress={gerarRelatorio}
          />
        </View>

        {/* ── SECAO 2: Exportar sessao individual ──────────────────── */}
        <View style={[estilos.secaoCard, { marginTop: spacing.lg }]}>
          <Text style={estilos.secaoTitulo}>Exportar Sessao Individual</Text>
          <Text style={estilos.secaoSub}>
            Selecione a loja e o status para localizar a sessao.
          </Text>

          {/* Filtro status */}
          <Text style={[estilos.label, { marginTop: spacing.md }]}>Status</Text>
          <View style={estilos.chips}>
            {[
              { id: 'concluida', label: 'Concluidas' },
              { id: 'ativas',    label: 'Ativas' },
            ].map(op => (
              <TouchableOpacity
                key={op.id}
                style={[estilos.chip, statusSessoes === op.id && estilos.chipAtivo]}
                onPress={() => { setStatusSessoes(op.id); setSessoes([]); }}
              >
                <Text style={[estilos.chipTexto, statusSessoes === op.id && estilos.chipTextoAtivo]}>
                  {op.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtro loja */}
          <Text style={[estilos.label, { marginTop: spacing.md }]}>Loja</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[estilos.chips, { flexWrap: 'nowrap' }]}>
              {lojas.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[estilos.chip, lojaSel === l.id && estilos.chipAtivo]}
                  onPress={() => setLojaSel(l.id)}
                >
                  <Text style={[estilos.chipTexto, lojaSel === l.id && estilos.chipTextoAtivo]}>
                    {l.codigo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Lista de sessoes */}
          {carregandoSessoes && (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          )}

          {!carregandoSessoes && lojaSel && sessoes.length === 0 && (
            <Text style={estilos.vazioTexto}>Nenhuma sessao encontrada.</Text>
          )}

          {!lojaSel && (
            <Text style={estilos.vazioTexto}>Selecione uma loja para listar as sessoes.</Text>
          )}

          {sessoes.map(s => {
            const { bg, txt, label } = badgeStatusCor(s.status);
            const loja = lojas.find(l => l.id === s.loja_id);
            return (
              <TouchableOpacity
                key={s.id}
                style={estilos.sessaoCard}
                onPress={() => navigation.navigate('ExportarRelatorio', { sessao: s, loja })}
                activeOpacity={0.75}
              >
                <View style={estilos.sessaoTopo}>
                  <Text style={estilos.sessaoNome} numberOfLines={1}>{s.nome}</Text>
                  <View style={[estilos.badge, { backgroundColor: bg }]}>
                    <Text style={[estilos.badgeTxt, { color: txt }]}>{label}</Text>
                  </View>
                </View>
                <View style={estilos.sessaoMeta}>
                  {s.mes_referencia ? (
                    <Text style={estilos.sessaoMetaTxt}>{s.mes_referencia}</Text>
                  ) : null}
                  {s.iniciada_em ? (
                    <Text style={estilos.sessaoMetaTxt}>
                      Iniciada {formatarData(s.iniciada_em)}
                    </Text>
                  ) : null}
                </View>
                <View style={estilos.sessaoProgresso}>
                  <View style={estilos.progressoFundo}>
                    <View style={[estilos.progressoFill, { width: `${s.percentual_progresso || 0}%` }]} />
                  </View>
                  <Text style={estilos.progressoPct}>{s.percentual_progresso || 0}%</Text>
                </View>
                <Text style={estilos.exportarHint}>Toque para exportar →</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: spacing.lg }} />
        <Button titulo="Voltar" variante="secondary" onPress={() => navigation.goBack()} />
        <View style={{ height: spacing.lg }} />

      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.backgroundSoft },
  scroll:       { padding: spacing.lg },
  secaoCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secaoTitulo:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  secaoSub:     { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  label:        { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.full, backgroundColor: colors.backgroundSoft,
    borderWidth: 1, borderColor: colors.border,
  },
  chipAtivo:    { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexto:    { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipTextoAtivo: { color: colors.white },
  erroCard: {
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
    borderLeftWidth: 4, borderLeftColor: colors.danger,
  },
  erroTexto:    { fontSize: fontSize.sm, color: colors.danger },
  vazioTexto:   { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md, fontStyle: 'italic' },
  // Cards de sessao
  sessaoCard: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  sessaoTopo:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sessaoNome:   { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  badge: {
    paddingHorizontal: spacing.xs, paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeTxt:     { fontSize: fontSize.xs, fontWeight: '700' },
  sessaoMeta:   { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  sessaoMetaTxt:{ fontSize: fontSize.xs, color: colors.textSecondary },
  progressoFundo: {
    flex: 1, height: 4, backgroundColor: colors.border,
    borderRadius: radius.full, overflow: 'hidden',
  },
  progressoFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  sessaoProgresso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  progressoPct: { fontSize: fontSize.xs, color: colors.textSecondary, width: 36, textAlign: 'right' },
  exportarHint: { fontSize: fontSize.xs, color: colors.primary, textAlign: 'right', marginTop: 2 },
});
