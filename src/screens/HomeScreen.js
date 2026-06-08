// Tela inicial do app — blocos de navegacao dinamicos por papel do usuario.
// ADM ve tudo; Gestor ve inventario + dashboards + relatorio + importar;
// Operador ve apenas o bloco de inventario.
// Visual redesenhado: header navy + grid 4 colunas (desktop) / lista (mobile).

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';

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
    descricao: 'Iniciar ou continuar contagem de produtos.',
    emoji: '📦',
    cor: '#2563EB',
    corBg: '#EFF6FF',
    corBorda: '#BFDBFE',
    tela: 'Lojas',
    papeis: ['admin', 'gestor', 'operador'],
    destaque: true,
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    descricao: 'KPIs, sessões ativas e divergências.',
    emoji: '📊',
    cor: '#2563EB',
    corBg: '#EEF2FF',
    corBorda: '#C7D2FE',
    tela: 'Dashboard',
    papeis: ['admin', 'gestor', 'gerente', 'auditor'],
  },
  {
    id: 'consolidado',
    titulo: 'Consolidado',
    descricao: 'Visão gerencial multi-loja por período.',
    emoji: '🏢',
    cor: '#16A34A',
    corBg: '#F0FDFA',
    corBorda: '#99F6E4',
    tela: 'DashboardConsolidado',
    papeis: ['admin', 'gestor', 'gerente', 'auditor'],
  },
  {
    id: 'relatorio',
    titulo: 'Rel. Geral',
    descricao: 'Excel consolidado de todas as lojas.',
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
    descricao: 'Carregar planilhas de estoque.',
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
    descricao: 'Cadastrar e gerenciar operadores.',
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
    descricao: 'Audit log e participação de operadores.',
    emoji: '🔍',
    cor: '#0891B2',
    corBg: '#F0FDFA',
    corBorda: '#99F6E4',
    tela: 'Auditoria',
    papeis: ['admin'],
  },
  {
    id: 'ajuda',
    titulo: 'Ajuda',
    descricao: 'Guia de uso do sistema.',
    emoji: '📖',
    cor: '#0891B2',
    corBg: '#F0F9FF',
    corBorda: '#BAE6FD',
    tela: 'Ajuda',
    papeis: ['admin', 'gestor', 'gerente', 'auditor', 'operador'],
  },
];

// ── Icones SVG ─────────────────────────────────────────────────────

function IcoAvatar({ size = 20, cor = '#FFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke={cor} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="12" cy="7" r="4" stroke={cor} strokeWidth="1.8" />
    </Svg>
  );
}

function IcoSair({ size = 17, cor = '#FFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke={cor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17l5-5-5-5"
        stroke={cor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="12" x2="9" y2="12"
        stroke={cor} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function IcoChevronDir({ size = 18, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6"
        stroke={cor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Logo BOLD (SVG inline) ─────────────────────────────────────────
function LogoBold({ height = 36, corTexto = '#1E3A5F' }) {
  const mW  = Math.round(height * 0.80);
  const tSz = Math.round(height * 0.72);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={mW} height={height} viewBox="0 0 26 34">
        <Path d="M0 5 L20 0 L24 10 L4 15 Z" fill="#F5A623" />
        <Path d="M2 19 L22 14 L26 24 L6 29 Z" fill="#22C55E" />
      </Svg>
      <Text style={{ color: corTexto, fontSize: tSz, fontWeight: '800', letterSpacing: 1.5, marginLeft: 8 }}>
        BOLD
      </Text>
    </View>
  );
}

// ── Card desktop (grid 4 colunas) ──────────────────────────────────
function CardDesktop({ bloco, onPress }) {
  return (
    <TouchableOpacity
      style={[est.card, { borderTopColor: bloco.cor }]}
      onPress={onPress}
      activeOpacity={0.80}
    >
      <View style={est.cardIconeBox}>
        <Text style={est.cardEmoji}>{bloco.emoji}</Text>
      </View>
      <Text style={[est.cardTitulo, { color: bloco.cor }]}>{bloco.titulo}</Text>
      <Text style={est.cardDescricao}>{bloco.descricao}</Text>
    </TouchableOpacity>
  );
}

// ── Item de lista mobile ───────────────────────────────────────────
function ItemMobile({ bloco, onPress }) {
  return (
    <TouchableOpacity
      style={[est.itemMobile, { borderLeftColor: bloco.cor }]}
      onPress={onPress}
      activeOpacity={0.80}
    >
      <View style={est.itemIconeBox}>
        <Text style={est.itemEmoji}>{bloco.emoji}</Text>
      </View>
      <View style={est.itemTextos}>
        <Text style={[est.itemTitulo, { color: bloco.cor }]}>{bloco.titulo}</Text>
        <Text style={est.itemDescricao}>{bloco.descricao}</Text>
      </View>
      <IcoChevronDir size={18} cor="#9CA3AF" />
    </TouchableOpacity>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [usuario, setUsuario] = useState(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    pegarUsuario().then(setUsuario).catch(() => {});
  }, []);

  const papel = usuario?.papel || 'operador';
  const blocosFiltrados = BLOCOS.filter(b => b.papeis.includes(papel));

  // Grid 4 colunas: divide em linhas de 4
  const linhasDesktop = [];
  for (let i = 0; i < blocosFiltrados.length; i += 4) {
    linhasDesktop.push(blocosFiltrados.slice(i, i + 4));
  }

  // Mantido para compatibilidade (grid 2 colunas legacy)
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
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      {/* ── Header ───────────────────────────────────────── */}
      <View style={est.header}>

        {/* Esquerda: logo */}
        <LogoBold height={36} corTexto="#FFFFFF" />

        {/* Direita: saudacao + avatar + sair */}
        <View style={est.headerDir}>

          {/* Saudacao com nome — somente desktop */}
          {isDesktop && (
            <Text style={est.saudacaoHeader} numberOfLines={1}>
              {_saudacao()},{' '}
              <Text style={est.nomeHeader}>{primeiroNome}</Text>
            </Text>
          )}

          {/* Avatar */}
          <View style={est.avatarCircle}>
            <IcoAvatar size={20} cor="#FFFFFF" />
          </View>

          {/* Botao sair */}
          {isDesktop ? (
            <TouchableOpacity style={est.botaoSair} onPress={handleLogout} activeOpacity={0.8}>
              <Text style={est.botaoSairTxt}>Sair</Text>
              <IcoSair size={16} cor="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={est.botaoSairMobile} onPress={handleLogout} activeOpacity={0.8}>
              <IcoSair size={20} cor="#FFFFFF" />
            </TouchableOpacity>
          )}

        </View>
      </View>

      {/* ── Conteudo ─────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[est.scroll, isDesktop && est.scrollDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Titulo + linha decorativa dourada */}
        <Text style={est.titulo}>O que deseja fazer?</Text>
        <View style={est.linhaDeco} />

        {/* Desktop: grid 4 colunas */}
        {isDesktop ? (
          <View style={est.gridContainer}>
            {linhasDesktop.map((linha, li) => (
              <View key={li} style={est.gridLinha}>
                {linha.map(bloco => (
                  <View key={bloco.id} style={est.gridCelula}>
                    <CardDesktop
                      bloco={bloco}
                      onPress={() => navigation.navigate(bloco.tela)}
                    />
                  </View>
                ))}
                {/* Celulas vazias para completar a linha de 4 */}
                {Array(4 - linha.length).fill(null).map((_, i) => (
                  <View key={`vazio-${i}`} style={est.gridCelula} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          /* Mobile: lista vertical */
          <View style={est.lista}>
            {blocosFiltrados.map(bloco => (
              <ItemMobile
                key={bloco.id}
                bloco={bloco}
                onPress={() => navigation.navigate(bloco.tela)}
              />
            ))}
          </View>
        )}

        {/* Versao */}
        <Text style={est.versao}>Sistema de Inventário — v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// Estilos
// =============================================================================
const est = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // ── Header ──
  header: {
    backgroundColor: '#1E3A5F',
    height: 64,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerDir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saudacaoHeader: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 15,
  },
  nomeHeader: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  avatarCircle: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
    alignItems: 'center', justifyContent: 'center',
  },
  botaoSair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  botaoSairTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  botaoSairMobile: {
    width: 36, height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Scroll ──
  scroll: {
    padding: 20,
    paddingTop: 24,
  },
  scrollDesktop: {
    paddingHorizontal: 40,
    paddingVertical: 32,
  },

  // Titulo + decoracao
  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  linhaDeco: {
    width: 48,
    height: 4,
    backgroundColor: '#F5A623',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 28,
  },

  // ── Desktop: grid ──
  gridContainer: {
    gap: 20,
  },
  gridLinha: {
    flexDirection: 'row',
    gap: 20,
  },
  gridCelula: {
    flex: 1,
    minWidth: 0,
  },

  // Card desktop
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderTopWidth: 3,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIconeBox: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardEmoji: {
    fontSize: 52,
    textAlign: 'center',
  },
  cardTitulo: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescricao: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },

  // ── Mobile: lista ──
  lista: {
    gap: 10,
  },
  itemMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemIconeBox: {
    width: 44, height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 30,
    textAlign: 'center',
  },
  itemTextos: {
    flex: 1,
    minWidth: 0,
  },
  itemTitulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDescricao: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },

  // Versao
  versao: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
});
