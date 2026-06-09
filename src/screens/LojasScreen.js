// Tela de selecao de loja — layout com sidebar + cards detalhados.
// Sidebar colapsa em mobile; expande automaticamente na web.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Platform,
  TextInput, Dimensions,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarLojas, pegarUsuario, logout } from '../services/api';

const SIDEBAR_W = 220;
const SIDEBAR_MINI = 56;

// ── Navegacao na sidebar ──────────────────────────────────────────────────────
const ITENS_NAV = [
  { rotulo: 'Inventario',  icone: '🏪', tela: null,                 papeis: null },
  { rotulo: 'Dashboard',   icone: '📊', tela: 'Dashboard',          papeis: ['admin','gestor','gerente','auditor'] },
  { rotulo: 'Consolidado', icone: '📈', tela: 'DashboardConsolidado',papeis: ['admin','gestor','gerente','auditor'] },
  { rotulo: 'Rel. Geral',  icone: '📋', tela: 'RelatorioConsolidado',papeis: ['admin','gestor','gerente','auditor'] },
  { rotulo: 'Importar',    icone: '☁',  tela: 'HistoricoImportacoes',papeis: ['admin'] },
  { rotulo: 'Usuarios',    icone: '👤', tela: 'Gestores',            papeis: ['admin'] },
  { rotulo: 'Auditoria',   icone: '🔒', tela: 'Auditoria',           papeis: ['admin','gerente','auditor'] },
];

// ── Ilustracao do predio (puro Views, sem SVG) ────────────────────────────────
function IlustracaoPredi({ codigo }) {
  const num = parseInt(codigo?.replace(/\D/g, '') || '1', 10);
  const BKGS = ['#BFDBFE', '#C7D2FE', '#BBF7D0', '#FDE68A', '#DDD6FE', '#FBCFE8'];
  const bg = BKGS[(num - 1) % BKGS.length];
  const PRDS = ['#1E40AF', '#3730A3', '#065F46', '#92400E', '#5B21B6', '#9D174D'];
  const pr = PRDS[(num - 1) % PRDS.length];

  return (
    <View style={[est.imgBox, { backgroundColor: bg }]}>
      {/* Predio lateral esquerdo */}
      <View style={[est.predioLateral, { left: '8%', height: 48, backgroundColor: pr, opacity: 0.45 }]} />
      {/* Predio principal */}
      <View style={[est.predioPrincipal, { backgroundColor: pr }]}>
        <View style={est.janelaLinha}>
          {[0,1,2].map(i => <View key={i} style={est.janela} />)}
        </View>
        <View style={est.janelaLinha}>
          {[0,1,2].map(i => <View key={i} style={est.janela} />)}
        </View>
        <View style={est.janelaLinha}>
          {[0,1,2].map(i => <View key={i} style={est.janela} />)}
        </View>
      </View>
      {/* Predio lateral direito */}
      <View style={[est.predioLateral, { right: '8%', height: 56, backgroundColor: pr, opacity: 0.35 }]} />
      {/* Arvore esquerda */}
      <View style={[est.arvTronco, { left: '20%' }]} />
      <View style={[est.arvCopa, { left: '17%' }]} />
      {/* Arvore direita */}
      <View style={[est.arvTronco, { right: '22%' }]} />
      <View style={[est.arvCopa, { right: '19%' }]} />
      {/* Chao */}
      <View style={[est.chao, { backgroundColor: pr, opacity: 0.15 }]} />
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function LojasScreen({ navigation }) {
  const largura = Dimensions.get('window').width;
  const telaLarga = largura > 768;

  const [lojas,       setLojas]       = useState([]);
  const [carregando,  setCarregando]  = useState(true);
  const [usuario,     setUsuario]     = useState(null);
  const [busca,       setBusca]       = useState('');
  const [vizGrid,     setVizGrid]     = useState(true);
  // Sidebar expandida por padrao na web/tablet, colapsada no mobile
  const [expanded,    setExpanded]    = useState(telaLarga);

  useEffect(() => { carregarDados(); }, []);

  async function carregarDados() {
    try {
      const u = await pegarUsuario();
      setUsuario(u);
      const dados = await listarLojas();
      const ativas = dados.filter(l => l.ativa);

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
      setLojas(ativas);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar as lojas');
    } finally {
      setCarregando(false);
    }
  }

  async function fazerLogout() {
    const ok = Platform.OS === 'web'
      ? window.confirm('Deseja realmente sair do app?')
      : await new Promise(r =>
          Alert.alert('Sair', 'Deseja realmente sair do app?', [
            { text: 'Cancelar', style: 'cancel',      onPress: () => r(false) },
            { text: 'Sair',     style: 'destructive', onPress: () => r(true)  },
          ])
        );
    if (ok) { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }
  }

  function _fmtSync(iso) {
    if (!iso) return 'Sem dados';
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) {
      return 'Hoje, ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
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

  const papel = usuario?.papel || 'operador';
  const itensFiltrados = ITENS_NAV.filter(
    i => !i.papeis || i.papeis.includes(papel)
  );

  // Numero de colunas do grid
  const sidebarVisivel = expanded;
  const sidebarWidth   = expanded ? SIDEBAR_W : SIDEBAR_MINI;
  const mainWidth      = largura - (sidebarVisivel ? sidebarWidth : SIDEBAR_MINI);
  const numCols        = mainWidth > 600 ? 4 : mainWidth > 380 ? 2 : 1;

  if (carregando) {
    return (
      <SafeAreaView style={est.centroLoading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={est.textoLoading}>Carregando lojas...</Text>
      </SafeAreaView>
    );
  }

  // ── Card no modo lista ──────────────────────────────────────────────────────
  function CardLista({ item }) {
    const cidade = item.cidade ? `${item.cidade}${item.estado ? ', ' + item.estado : ''}` : '';
    return (
      <TouchableOpacity style={est.cardLista} onPress={() => navigation.navigate('Sessoes', { loja: item })} activeOpacity={0.75}>
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

  // ── Card no modo grid ───────────────────────────────────────────────────────
  function CardGrid({ item }) {
    const cidade = item.cidade ? `${item.cidade}${item.estado ? ', ' + item.estado : ''}` : '';
    const cardW  = (mainWidth - spacing.md * 3) / numCols - spacing.xs;

    return (
      <TouchableOpacity
        style={[est.cardGrid, { width: cardW }]}
        onPress={() => navigation.navigate('Sessoes', { loja: item })}
        activeOpacity={0.8}
      >
        {/* Ilustracao com badge Online */}
        <IlustracaoPredi codigo={item.codigo} />
        <View style={est.badgeOnlineAbs}>
          <View style={est.pontoVerde} />
          <Text style={est.onlineTxtAbs}>Online</Text>
        </View>

        {/* Corpo do card */}
        <View style={est.cardGridCorpo}>
          {/* Chip de codigo */}
          <View style={est.chipCodigo}>
            <Text style={est.chipCodigoTxt}>{item.codigo}</Text>
          </View>

          {/* Nome da loja */}
          <Text style={est.cardGridNome} numberOfLines={2}>{item.nome}</Text>

          {/* Cidade */}
          {cidade ? (
            <View style={est.cardGridLinha}>
              <Text style={est.icnLocal}>📍</Text>
              <Text style={est.cardGridCidade} numberOfLines={1}>{cidade}</Text>
            </View>
          ) : null}

          {/* Ultima sincronizacao */}
          <View style={est.cardGridLinha}>
            <Text style={est.icnCal}>📅</Text>
            <View>
              <Text style={est.syncRotulo}>Ultima sincronizacao</Text>
              <Text style={est.syncValor}>{_fmtSync(item.atualizado_em)}</Text>
            </View>
          </View>

          {/* Botao de entrar */}
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={est.container}>
      <View style={est.layout}>

        {/* ══ Sidebar ════════════════════════════════════════════════════════ */}
        <View style={[est.sidebar, { width: expanded ? SIDEBAR_W : SIDEBAR_MINI }]}>
          {/* Topo da sidebar */}
          <View style={est.sidebarTopo}>
            {expanded && (
              <View style={{ flex: 1 }}>
                <Text style={est.sidebarAppTitulo} numberOfLines={1}>Inventario</Text>
                <Text style={est.sidebarAppSub} numberOfLines={1}>Multi-Loja</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={est.btnHamburger}>
              <Text style={est.hamburgerIcn}>{expanded ? '✕' : '☰'}</Text>
            </TouchableOpacity>
          </View>

          {/* Itens de navegacao */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {itensFiltrados.map((item, idx) => {
              const ativo = item.tela === null; // "Inventario" e a tela atual
              return (
                <TouchableOpacity
                  key={idx}
                  style={[est.sidebarItem, ativo && est.sidebarItemAtivo]}
                  onPress={() => item.tela ? navigation.navigate(item.tela) : null}
                  activeOpacity={item.tela ? 0.7 : 1}
                >
                  <Text style={[est.sidebarIcn, ativo && est.sidebarIcnAtivo]}>{item.icone}</Text>
                  {expanded && (
                    <Text style={[est.sidebarRotulo, ativo && est.sidebarRotuloAtivo]} numberOfLines={1}>
                      {item.rotulo}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Rodape da sidebar */}
          <View style={est.sidebarRodape}>
            <View style={est.sidebarDivisor} />
            <TouchableOpacity
              style={est.sidebarItem}
              onPress={() => navigation.navigate('Ajuda')}
              activeOpacity={0.7}
            >
              <Text style={est.sidebarIcn}>❓</Text>
              {expanded && <Text style={est.sidebarRotulo}>Ajuda</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={est.sidebarItem}
              onPress={fazerLogout}
              activeOpacity={0.7}
            >
              <Text style={est.sidebarIcn}>↩</Text>
              {expanded && <Text style={[est.sidebarRotulo, { color: '#F87171' }]}>Sair</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ Conteudo principal ═════════════════════════════════════════════ */}
        <View style={est.main}>
          <ScrollView contentContainerStyle={est.mainScroll} showsVerticalScrollIndicator={false}>

            {/* Cabecalho */}
            <View style={est.mainHeader}>
              <View style={{ flex: 1 }}>
                <Text style={est.mainTitulo}>Lojas Disponiveis</Text>
                <Text style={est.mainSub}>Selecione a loja onde voce deseja trabalhar</Text>
              </View>
              {usuario && (
                <View style={est.perfilBox}>
                  <View style={est.avatarCircle}>
                    <Text style={est.avatarLetra}>{(usuario.nome || 'U')[0].toUpperCase()}</Text>
                  </View>
                  {telaLarga && (
                    <View style={{ marginLeft: spacing.sm }}>
                      <Text style={est.perfilNome} numberOfLines={1}>{usuario.nome}</Text>
                      <Text style={est.perfilPapel} numberOfLines={1}>{usuario.email}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Barra de busca + controles */}
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
              {/* Toggle grid/lista */}
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

            {/* Rodape de seguranca */}
            <View style={est.rodapeSeguranca}>
              <Text style={est.rodapeSegurancaTxt}>🔒 Todos os dados estao seguros e sincronizados</Text>
            </View>

          </ScrollView>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const NAVY = '#0F172A';
const NAVY2 = '#1E293B';
const BORDER_CARD = '#E2E8F0';
const DARK_TXT = '#0F172A';
const GRAY_TXT = '#64748B';
const SOFT_BG = '#F8FAFC';

const est = StyleSheet.create({
  container: { flex: 1, backgroundColor: SOFT_BG },
  centroLoading: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  textoLoading: { marginTop: spacing.md, fontSize: fontSize.md, color: GRAY_TXT },

  // Layout raiz: sidebar + main lado a lado
  layout: { flex: 1, flexDirection: 'row' },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar: {
    backgroundColor: NAVY,
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTopo: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    minHeight: 64,
  },
  sidebarAppTitulo: { fontSize: fontSize.md, fontWeight: '800', color: '#FFFFFF' },
  sidebarAppSub: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  btnHamburger: { padding: spacing.xs },
  hamburgerIcn: { fontSize: 18, color: 'rgba(255,255,255,0.75)' },

  sidebarItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 12,
    marginHorizontal: spacing.xs, borderRadius: radius.md,
    gap: 10,
  },
  sidebarItemAtivo: { backgroundColor: colors.primary },
  sidebarIcn: { fontSize: 18, width: 24, textAlign: 'center' },
  sidebarIcnAtivo: {},
  sidebarRotulo: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.65)', fontWeight: '500', flex: 1 },
  sidebarRotuloAtivo: { color: '#FFFFFF', fontWeight: '700' },

  sidebarRodape: { paddingBottom: spacing.sm },
  sidebarDivisor: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: spacing.sm, marginBottom: spacing.xs },

  // ── Conteudo principal ────────────────────────────────────────────────────
  main: { flex: 1, backgroundColor: '#F1F5F9' },
  mainScroll: { padding: spacing.md, paddingBottom: 32 },

  mainHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  mainTitulo: { fontSize: fontSize.xl, fontWeight: '800', color: DARK_TXT },
  mainSub: { fontSize: fontSize.sm, color: GRAY_TXT, marginTop: 2 },

  perfilBox: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.md },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetra: { fontSize: fontSize.lg, fontWeight: '800', color: '#FFFFFF' },
  perfilNome: { fontSize: fontSize.sm, fontWeight: '700', color: DARK_TXT, maxWidth: 160 },
  perfilPapel: { fontSize: fontSize.xs, color: GRAY_TXT, maxWidth: 160 },

  // Controles de busca + toggle
  controles: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  buscaBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: radius.full,
    borderWidth: 1, borderColor: BORDER_CARD,
    paddingHorizontal: spacing.md, height: 44,
  },
  buscaIcone: { fontSize: 16, marginRight: spacing.xs },
  buscaInput: { flex: 1, fontSize: fontSize.sm, color: DARK_TXT, padding: 0 },
  toggleViz: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: radius.md, borderWidth: 1, borderColor: BORDER_CARD, overflow: 'hidden',
  },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  toggleBtnAtivo: { backgroundColor: colors.primary },
  toggleBtnTxt: { fontSize: 18, color: GRAY_TXT },
  toggleBtnTxtAtivo: { color: '#FFFFFF' },

  // Grid de cards
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // Lista
  listaBox: { gap: spacing.xs },
  cardLista: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: BORDER_CARD,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  cardListaBadge: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardListaBadgeTxt: { fontSize: fontSize.xs, fontWeight: '800', color: colors.primary },
  cardListaNome: { fontSize: fontSize.md, fontWeight: '600', color: DARK_TXT },
  cardListaCidade: { fontSize: fontSize.xs, color: GRAY_TXT, marginTop: 2 },
  badgeOnlineLista: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
  pontoVerde: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  onlineTxtLista: { fontSize: fontSize.xs, fontWeight: '600', color: '#22C55E' },
  cardListaSeta: { fontSize: 22, color: GRAY_TXT },

  // Card do grid
  cardGrid: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: BORDER_CARD, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    marginBottom: spacing.sm, position: 'relative',
  },
  cardGridCorpo: { padding: spacing.md, gap: 6 },
  chipCodigo: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: '#BFDBFE',
    marginBottom: 2,
  },
  chipCodigoTxt: { fontSize: fontSize.xs, fontWeight: '800', color: colors.primary },
  cardGridNome: { fontSize: fontSize.sm, fontWeight: '700', color: DARK_TXT, lineHeight: 20 },
  cardGridLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 },
  icnLocal: { fontSize: 12, marginTop: 1 },
  icnCal: { fontSize: 12, marginTop: 2 },
  cardGridCidade: { fontSize: fontSize.xs, color: GRAY_TXT, flex: 1 },
  syncRotulo: { fontSize: 10, color: GRAY_TXT },
  syncValor: { fontSize: fontSize.xs, fontWeight: '600', color: DARK_TXT },

  badgeOnlineAbs: {
    position: 'absolute', top: spacing.xs, right: spacing.xs,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#DCFCE7',
  },
  onlineTxtAbs: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  botaoEntrar: {
    marginTop: 8, alignSelf: 'flex-end',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    alignItems: 'center', justifyContent: 'center',
  },
  botaoEntrarTxt: { fontSize: 20, color: colors.primary, fontWeight: '800', marginTop: -2 },

  // Ilustracao do predio
  imgBox: {
    width: '100%', height: 100, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-end',
    position: 'relative',
  },
  predioLateral: { position: 'absolute', bottom: 12, width: 28, borderRadius: 2 },
  predioPrincipal: {
    position: 'absolute', bottom: 12, width: 54, height: 70, borderRadius: 3,
    alignItems: 'center', paddingTop: 6, gap: 3,
  },
  janelaLinha: { flexDirection: 'row', gap: 4 },
  janela: { width: 10, height: 10, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1 },
  arvTronco: { position: 'absolute', bottom: 12, width: 4, height: 14, backgroundColor: '#92400E', borderRadius: 2 },
  arvCopa: { position: 'absolute', bottom: 22, width: 14, height: 14, backgroundColor: '#16A34A', borderRadius: 7 },
  chao: { position: 'absolute', bottom: 0, width: '100%', height: 12, borderRadius: 0 },

  // Vazio
  vazio: { alignItems: 'center', paddingVertical: spacing.xl },
  vazioTxt: { fontSize: fontSize.md, color: GRAY_TXT },

  // Rodape
  rodapeSeguranca: { alignItems: 'center', paddingVertical: spacing.lg },
  rodapeSegurancaTxt: { fontSize: fontSize.xs, color: GRAY_TXT, fontWeight: '500' },
});
