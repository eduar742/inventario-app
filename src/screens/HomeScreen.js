// Tela inicial do app — blocos de navegacao dinamicos por papel do usuario.
// ADM ve tudo; Gestor ve inventario + dashboards + relatorio + importar;
// Operador ve apenas o bloco de inventario.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { pegarUsuario, logout } from '../services/api';

// ── Saudacao por hora ──────────────────────────────────────────────
function _saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function _dataFormatada() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Definicao dos blocos ───────────────────────────────────────────
const BLOCOS = [
  {
    id: 'inventario',
    titulo: 'Inventário',
    descricao: 'Iniciar ou continuar contagem de produtos',
    emoji: '📦',
    cor: '#1E40AF',
    corBg: '#EFF6FF',
    corBorda: '#BFDBFE',
    tela: 'Lojas',
    papeis: ['admin', 'gestor', 'operador'],
    destaque: true,
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    descricao: 'KPIs, sessões ativas e divergências',
    emoji: '📊',
    cor: '#6366F1',
    corBg: '#EEF2FF',
    corBorda: '#C7D2FE',
    tela: 'Dashboard',
    papeis: ['admin', 'gestor', 'gerente', 'auditor'],
  },
  {
    id: 'consolidado',
    titulo: 'Consolidado',
    descricao: 'Visão gerencial multi-loja por período',
    emoji: '🏢',
    cor: '#0D9488',
    corBg: '#F0FDFA',
    corBorda: '#99F6E4',
    tela: 'DashboardConsolidado',
    papeis: ['admin', 'gestor', 'gerente', 'auditor'],
  },
  {
    id: 'relatorio',
    titulo: 'Rel. Geral',
    descricao: 'Excel consolidado de todas as lojas',
    emoji: '📈',
    cor: '#16A34A',
    corBg: '#F0FDF4',
    corBorda: '#BBF7D0',
    tela: 'RelatorioConsolidado',
    papeis: ['admin', 'gestor', 'gerente', 'auditor'],
  },
  {
    id: 'importar',
    titulo: 'Importar',
    descricao: 'Carregar planilhas de estoque',
    emoji: '📥',
    cor: '#D97706',
    corBg: '#FFFBEB',
    corBorda: '#FDE68A',
    tela: 'Importacao',
    papeis: ['admin', 'gestor'],
  },
  {
    id: 'usuarios',
    titulo: 'Usuários',
    descricao: 'Cadastrar e gerenciar operadores',
    emoji: '👥',
    cor: '#7C3AED',
    corBg: '#F5F3FF',
    corBorda: '#DDD6FE',
    tela: 'Gestores',
    papeis: ['admin'],
  },
  {
    id: 'auditoria',
    titulo: 'Auditoria',
    descricao: 'Audit log e participação de operadores',
    emoji: '🔍',
    cor: '#0F766E',
    corBg: '#F0FDFA',
    corBorda: '#99F6E4',
    tela: 'Auditoria',
    papeis: ['admin'],
  },
  {
    id: 'ajuda',
    titulo: 'Ajuda',
    descricao: 'Guia de uso do sistema',
    emoji: '📖',
    cor: '#0369A1',
    corBg: '#F0F9FF',
    corBorda: '#BAE6FD',
    tela: 'Ajuda',
    papeis: ['admin', 'gestor', 'gerente', 'auditor', 'operador'],
  },
];

// ── Componente de bloco ────────────────────────────────────────────
function Bloco({ bloco, onPress }) {
  return (
    <TouchableOpacity
      style={[
        est.bloco,
        { backgroundColor: bloco.corBg, borderColor: bloco.corBorda },
        bloco.destaque && est.blocoDestaque,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Barra colorida lateral */}
      <View style={[est.blocoBarra, { backgroundColor: bloco.cor }]} />

      <View style={est.blocoConteudo}>
        <Text style={est.blocoEmoji}>{bloco.emoji}</Text>
        <View style={est.blocoTextos}>
          <Text style={[est.blocoTitulo, { color: bloco.cor }]}>{bloco.titulo}</Text>
          <Text style={est.blocoDescricao} numberOfLines={2}>{bloco.descricao}</Text>
        </View>
        {/* Seta */}
        <Text style={[est.blocoSeta, { color: bloco.cor }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    pegarUsuario().then(setUsuario).catch(() => {});
  }, []);

  const papel = usuario?.papel || 'operador';
  const blocosFiltrados = BLOCOS.filter(b => b.papeis.includes(papel));

  // Divide em pares para grid 2 colunas
  const linhas = [];
  for (let i = 0; i < blocosFiltrados.length; i += 2) {
    linhas.push(blocosFiltrados.slice(i, i + 2));
  }

  async function handleLogout() {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  const primeiroNome = usuario?.nome?.split(' ')[0] || 'Usuário';
  const badgePapel = {
    admin: 'ADM', gestor: 'Gestor', gerente: 'Gerente',
    auditor: 'Auditor', operador: 'Operador',
  }[papel] || papel;
  const corBadge = {
    admin: '#1E40AF', gestor: '#059669', gerente: '#0891B2',
    auditor: '#7C3AED', operador: '#D97706',
  }[papel] || '#475569';

  return (
    <SafeAreaView style={est.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Cabeçalho ───────────────────────────────────── */}
      <View style={est.header}>
        <View style={est.headerEsq}>
          {/* Avatar com iniciais */}
          <View style={[est.avatar, { backgroundColor: corBadge }]}>
            <Text style={est.avatarTxt}>
              {primeiroNome.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={est.headerTextos}>
            <Text style={est.saudacao}>{_saudacao()}, {primeiroNome}</Text>
            <View style={est.badgeRow}>
              <View style={[est.badge, { backgroundColor: corBadge + '30', borderColor: corBadge + '60' }]}>
                <Text style={[est.badgeTxt, { color: corBadge === '#1E40AF' ? '#93C5FD' : corBadge === '#059669' ? '#6EE7B7' : '#FDE68A' }]}>
                  {badgePapel}
                </Text>
              </View>
              <Text style={est.dataHoje}>{_dataFormatada()}</Text>
            </View>
          </View>
        </View>

        {/* Botao sair */}
        <TouchableOpacity style={est.botaoSair} onPress={handleLogout}>
          <Text style={est.botaoSairTxt}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* ── Conteudo ─────────────────────────────────────── */}
      <ScrollView contentContainerStyle={est.scroll}>
        {/* Sub-titulo */}
        <Text style={est.subTitulo}>O que deseja fazer?</Text>

        {/* Blocos em grid 2 colunas */}
        {linhas.map((linha, li) => (
          <View key={li} style={est.linhaBlocos}>
            {linha.map(bloco => (
              <View key={bloco.id} style={est.blocoWrapper}>
                <Bloco
                  bloco={bloco}
                  onPress={() => navigation.navigate(bloco.tela)}
                />
              </View>
            ))}
            {/* Preenche coluna vazia se linha impar */}
            {linha.length === 1 && <View style={est.blocoWrapper} />}
          </View>
        ))}

        {/* Versao */}
        <Text style={est.versao}>Sistema de Inventário — v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const est = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  // ── Header ──
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      android: { paddingTop: spacing.md + 4 },
    }),
  },
  headerEsq: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarTxt:    { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  headerTextos: { flex: 1 },
  saudacao:     { color: '#FFFFFF', fontSize: fontSize.md, fontWeight: '700', marginBottom: 2 },
  badgeRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeTxt:     { fontSize: 10, fontWeight: '700' },
  dataHoje:     { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  botaoSair: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  botaoSairTxt: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '600' },

  // ── Scroll ──
  scroll: { padding: spacing.lg, paddingTop: spacing.md },
  subTitulo: {
    fontSize: fontSize.lg, fontWeight: '700', color: '#0F172A',
    marginBottom: spacing.md,
  },

  // ── Grid de blocos ──
  linhaBlocos: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  // minWidth: 0 impede que itens flex estourem a coluna (comportamento padrão auto)
  blocoWrapper: { flex: 1, minWidth: 0 },

  bloco: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  blocoDestaque: {
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  blocoBarra: { height: 4, width: '100%' },
  blocoConteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,   // padding menor para dar espaço ao texto no mobile
    gap: 6,
  },
  // flexShrink: 0 impede o emoji de ser comprimido
  blocoEmoji: { fontSize: 24, flexShrink: 0 },
  // minWidth: 0 + flexShrink: 1 permite que o texto encolha e quebre linha corretamente
  blocoTextos: { flex: 1, minWidth: 0, flexShrink: 1 },
  blocoTitulo: {
    fontSize: fontSize.sm,   // menor para caber no mobile sem quebrar no meio
    fontWeight: '800',
    marginBottom: 2,
    flexWrap: 'wrap',        // garante quebra de linha natural entre palavras
  },
  blocoDescricao: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
    flexWrap: 'wrap',        // garante quebra de linha natural
  },
  // flexShrink: 0 impede a seta de sumir; display none em cards pequenos seria ideal
  blocoSeta: { fontSize: 18, fontWeight: '300', opacity: 0.7, flexShrink: 0 },

  versao: {
    fontSize: fontSize.xs, color: '#94A3B8',
    textAlign: 'center', marginTop: spacing.xl,
  },
});
