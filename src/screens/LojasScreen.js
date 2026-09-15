// Tela de selecao de loja — usa AppLayout (sidebar + header centralizado).
// Logica de negocio preservada: operador com loja unica e redirecionado automaticamente.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, useWindowDimensions,
} from 'react-native';

import AppLayout from '../components/AppLayout';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarLojas, pegarUsuario } from '../services/api';
import { formatarDataCurta } from '../utils/formatadores';

// ── Ilustracao do predio (puro Views, sem SVG) ────────────────────────────────
function IlustracaoPredi({ codigo }) {
  const num  = parseInt(codigo?.replace(/\D/g, '') || '1', 10);
  const BKGS = ['#BFDBFE', '#C7D2FE', '#BBF7D0', '#FDE68A', '#DDD6FE', '#FBCFE8'];
  const PRDS = ['#1E40AF', '#3730A3', '#065F46', '#92400E', '#5B21B6', '#9D174D'];
  const bg   = BKGS[(num - 1) % BKGS.length];
  const pr   = PRDS[(num - 1) % PRDS.length];

  return (
    <View style={[est.imgBox, { backgroundColor: bg }]}>
      <View style={[est.predioLateral, { left: '8%',  height: 48, backgroundColor: pr, opacity: 0.45 }]} />
      <View style={[est.predioPrincipal, { backgroundColor: pr }]}>
        {[0, 1, 2].map(r => (
          <View key={r} style={est.janelaLinha}>
            {[0, 1, 2].map(c => <View key={c} style={est.janela} />)}
          </View>
        ))}
      </View>
      <View style={[est.predioLateral, { right: '8%', height: 56, backgroundColor: pr, opacity: 0.35 }]} />
      <View style={[est.arvTronco, { left:  '20%' }]} />
      <View style={[est.arvCopa,   { left:  '17%' }]} />
      <View style={[est.arvTronco, { right: '22%' }]} />
      <View style={[est.arvCopa,   { right: '19%' }]} />
      <View style={[est.chao, { backgroundColor: pr, opacity: 0.15 }]} />
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function LojasScreen({ navigation }) {
  const { width: largura } = useWindowDimensions();
  const telaLarga = largura >= 768;

  const [lojas,      setLojas]      = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [usuario,    setUsuario]    = useState(null);
  const [busca,      setBusca]      = useState('');
  const [vizGrid,    setVizGrid]    = useState(true);

  useEffect(() => { carregarDados(); }, []);

  // Logica de negocio preservada integralmente:
  // operador com loja unica e redirecionado automaticamente para a sessao.
  async function carregarDados() {
    try {
      const u = await pegarUsuario();
      setUsuario(u);
      const dados  = await listarLojas();
      const ativas = dados.filter(l => l.ativa);

      // Operador: sempre filtrado pelas lojas vinculadas
      if (u?.papel === 'operador') {
        const ids = u?.lojas_ids || (u?.loja_id ? [u.loja_id] : []);
        if (ids.length === 1) {
          const lojaVinculada = ativas.find(l => l.id === ids[0]);
          if (lojaVinculada) { navigation.replace('Sessoes', { loja: lojaVinculada }); return; }
        } else if (ids.length > 1) {
          setLojas(ativas.filter(l => ids.includes(l.id)));
          setCarregando(false); return;
        } else {
          setLojas([]); setCarregando(false); return;
        }
      }

      // Gestor e Lider: filtra pela loja vinculada SOMENTE se o cadastro tiver loja_id definido.
      // Se ainda nao tiver (migracao pendente), mostra todas as lojas para nao bloquear acesso.
      if (u?.papel === 'gestor' || u?.papel === 'lider') {
        const ids = u?.lojas_ids || (u?.loja_id ? [u.loja_id] : []);
        if (ids.length === 1) {
          const lojaVinculada = ativas.find(l => l.id === ids[0]);
          if (lojaVinculada) { navigation.replace('Sessoes', { loja: lojaVinculada }); return; }
        } else if (ids.length > 1) {
          setLojas(ativas.filter(l => ids.includes(l.id)));
          setCarregando(false); return;
        }
        // ids.length === 0: loja_id nao cadastrado — mostra todas (fallback seguro)
      }

      setLojas(ativas);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar as lojas');
    } finally {
      setCarregando(false);
    }
  }

  const lojasFiltradas = lojas.filter(l => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      l.nome.toLowerCase().includes(q) ||
      l.codigo.toLowerCase().includes(q) ||
      (l.cidade || '').toLowerCase().includes(q) ||
      (l.estado || '').toLowerCase().includes(q)
    );
  });

  // Largura disponivel para o grid apos a sidebar do AppLayout (210px no desktop)
  const mainWidth = telaLarga ? largura - 210 : largura;
  const numCols   = mainWidth > 600 ? 4 : mainWidth > 380 ? 2 : 1;

  // ── Estado de carregamento ────────────────────────────────────────────────────
  if (carregando) {
    return (
      <AppLayout navigation={navigation} telaAtual="Lojas" titulo="Selecionar Loja" scrollavel={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, fontSize: fontSize.md, color: colors.textMuted }}>
            Carregando lojas...
          </Text>
        </View>
      </AppLayout>
    );
  }

  // ── Card modo lista ───────────────────────────────────────────────────────────
  function CardLista({ item }) {
    const cidade = item.cidade ? `${item.cidade}${item.estado ? ', ' + item.estado : ''}` : '';
    return (
      <TouchableOpacity
        style={est.cardLista}
        onPress={() => navigation.navigate('Sessoes', { loja: item })}
        activeOpacity={0.75}
      >
        <View style={[est.cardListaBadge, { backgroundColor: colors.primarySoft }]}>
          <Text style={est.cardListaBadgeTxt}>{item.codigo}</Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: spacing.md }}>
          <Text style={est.cardListaNome} numberOfLines={1}>{item.nome}</Text>
          {cidade ? <Text style={est.cardListaCidade} numberOfLines={1}>📍 {cidade}</Text> : null}
        </View>
        <View style={est.badgeOnlineLista}>
          <View style={est.pontoVerde} />
          <Text style={est.onlineTxtLista}>Online</Text>
        </View>
        <Text style={est.cardListaSeta}>›</Text>
      </TouchableOpacity>
    );
  }

  // ── Card modo grid ────────────────────────────────────────────────────────────
  function CardGrid({ item }) {
    const cidade = item.cidade ? `${item.cidade}${item.estado ? ', ' + item.estado : ''}` : '';
    const cardW  = (mainWidth - spacing.md * 3) / numCols - spacing.xs;

    return (
      <TouchableOpacity
        style={[est.cardGrid, { width: cardW }]}
        onPress={() => navigation.navigate('Sessoes', { loja: item })}
        activeOpacity={0.8}
      >
        <IlustracaoPredi codigo={item.codigo} />
        <View style={est.badgeOnlineAbs}>
          <View style={est.pontoVerde} />
          <Text style={est.onlineTxtAbs}>Online</Text>
        </View>

        <View style={est.cardGridCorpo}>
          <View style={est.chipCodigo}>
            <Text style={est.chipCodigoTxt}>{item.codigo}</Text>
          </View>

          <Text style={est.cardGridNome} numberOfLines={2}>{item.nome}</Text>

          {cidade ? (
            <View style={est.cardGridLinha}>
              <Text style={est.icnLocal}>📍</Text>
              <Text style={est.cardGridCidade} numberOfLines={1}>{cidade}</Text>
            </View>
          ) : null}

          <View style={est.cardGridLinha}>
            <Text style={est.icnCal}>📅</Text>
            <View>
              <Text style={est.syncRotulo}>Ultima sincronizacao</Text>
              <Text style={est.syncValor}>{formatarDataCurta(item.atualizado_em)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={est.botaoEntrar}
            onPress={() => navigation.navigate('Sessoes', { loja: item })}
            activeOpacity={0.8}
          >
            <Text style={est.botaoEntrarTxt}>›</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AppLayout navigation={navigation} telaAtual="Lojas" titulo="Selecionar Loja" scrollavel={false} semPadding>
      <ScrollView contentContainerStyle={est.mainScroll} showsVerticalScrollIndicator={false}>

        {/* Cabecalho da secao */}
        <View style={est.mainHeader}>
          <Text style={est.mainTitulo}>Lojas Disponiveis</Text>
          <Text style={est.mainSub}>Selecione a loja onde voce deseja trabalhar</Text>
        </View>

        {/* Barra de busca + toggle de visualizacao */}
        <View style={est.controles}>
          <View style={est.buscaBox}>
            <Text style={est.buscaIcone}>🔍</Text>
            <TextInput
              style={est.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar loja ou cidade..."
              placeholderTextColor={colors.textMuted}
              clearButtonMode="while-editing"
            />
          </View>
          <View style={est.toggleViz}>
            <TouchableOpacity
              style={[est.toggleBtn, vizGrid && est.toggleBtnAtivo]}
              onPress={() => setVizGrid(true)}
            >
              <Text style={[est.toggleBtnTxt, vizGrid && est.toggleBtnTxtAtivo]}>⊞</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[est.toggleBtn, !vizGrid && est.toggleBtnAtivo]}
              onPress={() => setVizGrid(false)}
            >
              <Text style={[est.toggleBtnTxt, !vizGrid && est.toggleBtnTxtAtivo]}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cards */}
        {lojasFiltradas.length === 0 ? (
          <View style={est.vazio}>
            <Text style={est.vazioTxt}>
              {busca ? `Nenhuma loja encontrada para "${busca}"` : 'Nenhuma loja disponivel'}
            </Text>
          </View>
        ) : vizGrid ? (
          <View style={est.grid}>
            {lojasFiltradas.map(item => <CardGrid key={item.id} item={item} />)}
          </View>
        ) : (
          <View style={est.listaBox}>
            {lojasFiltradas.map(item => <CardLista key={item.id} item={item} />)}
          </View>
        )}

        {/* Rodape */}
        <View style={est.rodapeSeguranca}>
          <Text style={est.rodapeSegurancaTxt}>🔒 Todos os dados estao seguros e sincronizados</Text>
        </View>

      </ScrollView>
    </AppLayout>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const BORDER_CARD = colors.border;
const DARK_TXT    = colors.text;
const GRAY_TXT    = colors.textMuted;

const est = StyleSheet.create({

  // Scroll do conteudo principal
  mainScroll: { padding: spacing.md, paddingBottom: 32 },

  // Cabecalho da secao
  mainHeader: { marginBottom: spacing.md },
  mainTitulo: { fontSize: fontSize.xl, fontWeight: '800', color: DARK_TXT },
  mainSub:    { fontSize: fontSize.sm, color: GRAY_TXT, marginTop: 2 },

  // Controles de busca + toggle
  controles: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  buscaBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: BORDER_CARD,
    paddingHorizontal: spacing.md, height: 44,
  },
  buscaIcone: { fontSize: 16, marginRight: spacing.xs },
  buscaInput: { flex: 1, fontSize: fontSize.sm, color: DARK_TXT, padding: 0 },

  toggleViz: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: BORDER_CARD, overflow: 'hidden',
  },
  toggleBtn:        { paddingHorizontal: 14, paddingVertical: 10 },
  toggleBtnAtivo:   { backgroundColor: colors.primary },
  toggleBtnTxt:     { fontSize: 18, color: GRAY_TXT },
  toggleBtnTxtAtivo:{ color: colors.onDark },

  // Grid de cards
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  listaBox: { gap: spacing.xs },

  // Card lista
  cardLista: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: BORDER_CARD,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  cardListaBadge: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardListaBadgeTxt: { fontSize: fontSize.xs, fontWeight: '800', color: colors.primary },
  cardListaNome:     { fontSize: fontSize.md, fontWeight: '600', color: DARK_TXT },
  cardListaCidade:   { fontSize: fontSize.xs, color: GRAY_TXT, marginTop: 2 },
  badgeOnlineLista:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
  pontoVerde:        { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentGreen },
  onlineTxtLista:    { fontSize: fontSize.xs, fontWeight: '600', color: colors.accentGreen },
  cardListaSeta:     { fontSize: 22, color: GRAY_TXT },

  // Card grid
  cardGrid: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: BORDER_CARD, overflow: 'hidden',
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    marginBottom: spacing.sm, position: 'relative',
  },
  cardGridCorpo: { padding: spacing.md, gap: 6 },
  chipCodigo: {
    alignSelf: 'flex-start', backgroundColor: colors.primarySoft,
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 2,
  },
  chipCodigoTxt:  { fontSize: fontSize.xs, fontWeight: '800', color: colors.primary },
  cardGridNome:   { fontSize: fontSize.sm, fontWeight: '700', color: DARK_TXT, lineHeight: 20 },
  cardGridLinha:  { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 },
  icnLocal:       { fontSize: 12, marginTop: 1 },
  icnCal:         { fontSize: 12, marginTop: 2 },
  cardGridCidade: { fontSize: fontSize.xs, color: GRAY_TXT, flex: 1 },
  syncRotulo:     { fontSize: 10, color: GRAY_TXT },
  syncValor:      { fontSize: fontSize.xs, fontWeight: '600', color: DARK_TXT },

  badgeOnlineAbs: {
    position: 'absolute', top: spacing.xs, right: spacing.xs,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.successSoft,
  },
  onlineTxtAbs: { fontSize: 11, fontWeight: '700', color: colors.success },

  botaoEntrar: {
    marginTop: 8, alignSelf: 'flex-end',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#BFDBFE',
    alignItems: 'center', justifyContent: 'center',
  },
  botaoEntrarTxt: { fontSize: 20, color: colors.primary, fontWeight: '800', marginTop: -2 },

  // Ilustracao do predio
  imgBox: {
    width: '100%', height: 100, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-end', position: 'relative',
  },
  predioLateral:   { position: 'absolute', bottom: 12, width: 28, borderRadius: 2 },
  predioPrincipal: {
    position: 'absolute', bottom: 12, width: 54, height: 70, borderRadius: 3,
    alignItems: 'center', paddingTop: 6, gap: 3,
  },
  janelaLinha: { flexDirection: 'row', gap: 4 },
  janela:      { width: 10, height: 10, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1 },
  arvTronco:   { position: 'absolute', bottom: 12, width: 4, height: 14, backgroundColor: '#92400E', borderRadius: 2 },
  arvCopa:     { position: 'absolute', bottom: 22, width: 14, height: 14, backgroundColor: colors.success, borderRadius: 7 },
  chao:        { position: 'absolute', bottom: 0, width: '100%', height: 12 },

  // Vazio
  vazio:    { alignItems: 'center', paddingVertical: spacing.xl },
  vazioTxt: { fontSize: fontSize.md, color: GRAY_TXT },

  // Rodape
  rodapeSeguranca:    { alignItems: 'center', paddingVertical: spacing.lg },
  rodapeSegurancaTxt: { fontSize: fontSize.xs, color: GRAY_TXT, fontWeight: '500' },
});
