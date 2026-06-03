// Tela de Auditoria — exportacao do audit log e participacao de operadores por sessao.
// Acesso: apenas ADM.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from '../components/Button';
import { exportarAuditLog, listarSessoes, buscarParticipacaoOperadores } from '../services/api';

const TIPOS_ACAO = [
  { valor: null,          rotulo: 'Todos' },
  { valor: 'sessao',      rotulo: 'Sessões' },
  { valor: 'contagem',    rotulo: 'Contagens' },
  { valor: 'divergencia', rotulo: 'Divergências' },
  { valor: 'importacao',  rotulo: 'Importações' },
  { valor: 'usuario',     rotulo: 'Usuários' },
];

function _mesesRecentes(n = 6) {
  const arr = [];
  const hoje = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return arr;
}

export default function AuditoriaScreen({ navigation }) {
  const meses = _mesesRecentes();
  const [tipoAcao, setTipoAcao] = useState(null);
  const [mesInicio, setMesInicio] = useState(meses[1]);
  const [mesFim, setMesFim] = useState(meses[0]);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');

  // Participacao de operadores
  const [sessoes, setSessoes] = useState([]);
  const [sessaoSel, setSessaoSel] = useState(null);
  const [participacao, setParticipacao] = useState(null);
  const [carregandoPart, setCarregandoPart] = useState(false);

  useEffect(() => {
    listarSessoes({ status: 'concluida' }, 1, 20)
      .then(d => setSessoes(d.items || []))
      .catch(() => {});
  }, []);

  async function handleExportar() {
    setExportando(true); setErro('');
    try {
      const dataInicio = mesInicio ? mesInicio + '-01' : undefined;
      const dataFim    = mesFim    ? mesFim    + '-31' : undefined;
      const { base64, nomeArquivo } = await exportarAuditLog({ dataInicio, dataFim, tipoAcao: tipoAcao || undefined });
      if (Platform.OS === 'web') {
        const byteChars = atob(base64);
        const blob = new Blob([new Uint8Array(Array.from(byteChars).map(c => c.charCodeAt(0)))], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nomeArquivo; a.click();
        URL.revokeObjectURL(url);
      } else {
        const FileSystem = require('expo-file-system');
        const Sharing    = require('expo-sharing');
        const caminho = `${FileSystem.documentDirectory}${nomeArquivo}`;
        await FileSystem.writeAsStringAsync(caminho, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(caminho);
      }
    } catch (err) {
      setErro(err.message || 'Erro ao exportar');
    } finally { setExportando(false); }
  }

  async function handleVerParticipacao(sessao) {
    setSessaoSel(sessao); setCarregandoPart(true); setParticipacao(null);
    try {
      const d = await buscarParticipacaoOperadores(sessao.id);
      setParticipacao(d);
    } catch (err) {
      setErro(err.message || 'Erro ao buscar participacao');
    } finally { setCarregandoPart(false); }
  }

  function _fmtMin(min) {
    if (!min) return '< 1 min';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
  }

  function _fmtHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <SafeAreaView style={est.container}>
      <ScrollView contentContainerStyle={est.scroll}>

        {/* ── Exportação do Audit Log ─────────────────────── */}
        <View style={est.card}>
          <Text style={est.cardTitulo}>📋 Exportar Audit Log</Text>
          <Text style={est.cardSub}>Exporta eventos do sistema em Excel (.xlsx)</Text>

          <Text style={est.rotulo}>Tipo de ação</Text>
          <View style={est.chips}>
            {TIPOS_ACAO.map(t => (
              <TouchableOpacity key={String(t.valor)}
                style={[est.chip, tipoAcao === t.valor && est.chipAtivo]}
                onPress={() => setTipoAcao(t.valor)}>
                <Text style={[est.chipTxt, tipoAcao === t.valor && est.chipTxtAtivo]}>{t.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={est.periodoRow}>
            <View style={{ flex: 1 }}>
              <Text style={est.rotulo}>Mês início</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {meses.map(m => (
                    <TouchableOpacity key={m} style={[est.chip, mesInicio === m && est.chipAtivo]}
                      onPress={() => setMesInicio(m)}>
                      <Text style={[est.chipTxt, mesInicio === m && est.chipTxtAtivo]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={est.rotulo}>Mês fim</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {meses.map(m => (
                    <TouchableOpacity key={m} style={[est.chip, mesFim === m && est.chipAtivo]}
                      onPress={() => setMesFim(m)}>
                      <Text style={[est.chipTxt, mesFim === m && est.chipTxtAtivo]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {erro ? <Text style={est.erroTxt}>{erro}</Text> : null}

          <View style={{ height: spacing.md }} />
          <Button titulo={exportando ? 'Gerando...' : 'Exportar Audit Log (.xlsx)'}
            carregando={exportando} onPress={handleExportar} />
        </View>

        {/* ── Participação de Operadores por Sessão ──────── */}
        <View style={[est.card, { marginTop: spacing.md }]}>
          <Text style={est.cardTitulo}>👥 Participação por Operador</Text>
          <Text style={est.cardSub}>Selecione uma sessão concluída para ver as métricas</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {sessoes.map(s => (
                <TouchableOpacity key={s.id}
                  style={[est.chipSessao, sessaoSel?.id === s.id && est.chipSessaoAtivo]}
                  onPress={() => handleVerParticipacao(s)}>
                  <Text style={[est.chipSessaoTxt, sessaoSel?.id === s.id && { color: colors.white }]}
                    numberOfLines={1}>{s.nome}</Text>
                  <Text style={[est.chipSessaoSub, sessaoSel?.id === s.id && { color: 'rgba(255,255,255,0.7)' }]}>
                    {s.codigo_loja} · {s.mes_referencia}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {carregandoPart && <ActivityIndicator size="small" color={colors.primary} />}

          {participacao && (
            <View>
              <Text style={est.partTitulo}>{participacao.sessao_nome}</Text>
              {/* Cabeçalho da tabela */}
              <View style={est.tabelaHeader}>
                {['Operador', 'SKUs', 'Leituras', '1ª', 'Última', 'Ativo'].map((c, i) => (
                  <Text key={i} style={[est.tabelaHeaderTxt, i === 0 && { flex: 2 }]}>{c}</Text>
                ))}
              </View>
              {participacao.operadores.map((op, i) => (
                <View key={op.operador_id} style={[est.tabelaLinha, i % 2 === 0 && { backgroundColor: '#F8FAFC' }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={est.opNome} numberOfLines={1}>{op.operador_nome}</Text>
                    <Text style={est.opEmail} numberOfLines={1}>{op.operador_email}</Text>
                  </View>
                  <Text style={est.tabelaCel}>{op.skus_contados}</Text>
                  <Text style={est.tabelaCel}>{op.num_leituras}</Text>
                  <Text style={est.tabelaCel}>{_fmtHora(op.primeira_leitura)}</Text>
                  <Text style={est.tabelaCel}>{_fmtHora(op.ultima_leitura)}</Text>
                  <Text style={est.tabelaCel}>{_fmtMin(op.minutos_ativo)}</Text>
                </View>
              ))}
              {participacao.operadores.length === 0 && (
                <Text style={est.vazio}>Nenhuma contagem registrada nesta sessão</Text>
              )}
            </View>
          )}
        </View>

        <View style={{ height: spacing.xl }} />
        <Button titulo="Voltar" variante="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const est = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  scroll:    { padding: spacing.md },
  card: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardTitulo: { fontSize: fontSize.lg, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  cardSub:    { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  rotulo: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.sm },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip:     { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.full,
              backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border },
  chipAtivo:{ backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt:  { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  chipTxtAtivo: { color: colors.white },
  periodoRow: { flexDirection: 'row', marginTop: spacing.xs },
  erroTxt: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.sm },
  // Sessoes
  chipSessao: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.backgroundSoft, maxWidth: 180,
  },
  chipSessaoAtivo:   { backgroundColor: colors.primary, borderColor: colors.primary },
  chipSessaoTxt:     { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },
  chipSessaoSub:     { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  // Tabela de participação
  partTitulo: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  tabelaHeader: {
    flexDirection: 'row', backgroundColor: '#1E3A5F',
    paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
    marginBottom: 2,
  },
  tabelaHeaderTxt: { flex: 1, fontSize: 10, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  tabelaLinha: { flexDirection: 'row', alignItems: 'center',
                 paddingVertical: 7, paddingHorizontal: spacing.sm,
                 borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  opNome:  { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },
  opEmail: { fontSize: 10, color: colors.textMuted },
  tabelaCel: { flex: 1, fontSize: 11, color: colors.text, textAlign: 'center' },
  vazio: { textAlign: 'center', color: colors.textMuted, padding: spacing.md, fontSize: fontSize.sm },
});
