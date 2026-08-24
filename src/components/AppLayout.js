// Layout principal autenticado — sidebar + header + area de conteudo.
// Sidebar recolhivel no desktop com estado persistido no AsyncStorage.
// Props:
//   navigation    — prop navigation do React Navigation
//   telaAtual     — nome da tela corrente (ex: 'Dashboard')
//   titulo        — titulo exibido no header
//   scrollavel    — true (default): ScrollView envolve children; false: children gerencia o proprio scroll
//   semPadding    — true: remove padding do conteudo (para FlatLists que ocupam 100% da largura)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

import LogoBold from './LogoBold';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { pegarUsuario, logout } from '../services/api';

// ── Constantes de layout ─────────────────────────────────────────────────────
const SIDEBAR_W           = 210;
const SIDEBAR_RECOLHIDA_W = 64;
const HEADER_H            = 56;
const MOBILE_BREAKPOINT   = 768;

// ── Caminhos SVG dos icones (Feather Icons, viewBox 24x24, stroke-based) ─────
const CAMINHOS = {
  home:       'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  inventory:  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
  dashboard:  'M18 20V10 M12 20V4 M6 20v-6',
  building:   'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  relatorio:  'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  importar:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  usuarios:   'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  auditoria:  'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  ajuda:      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
  sair:       'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  chevronEsq: 'M15 18l-6-6 6-6',
  chevronDir: 'M9 18l6-6-6-6',
};

// ── Itens de navegacao ────────────────────────────────────────────────────────
const ITENS_NAV = [
  { rotulo: 'Início',      icone: 'home',      corIcone: 'rgba(255,255,255,0.75)', tela: 'Home',                 papeis: null },
  { rotulo: 'Inventário',  icone: 'inventory', corIcone: '#F97316',               tela: 'Lojas',                papeis: null },
  { rotulo: 'Dashboard',   icone: 'dashboard', corIcone: '#3B82F6',               tela: 'Dashboard',            papeis: ['admin','gestor','gerente','auditor'] },
  { rotulo: 'Consolidado', icone: 'building',  corIcone: '#8B5CF6',               tela: 'DashboardConsolidado', papeis: ['admin','gerente','auditor'] },
  { rotulo: 'Rel. Geral',  icone: 'relatorio', corIcone: '#10B981',               tela: 'RelatorioConsolidado', papeis: ['admin','gerente','auditor'] },
  { rotulo: 'Importar',    icone: 'importar',  corIcone: '#F59E0B',               tela: 'Importacao',           papeis: ['admin'] },
  { rotulo: 'Usuários',    icone: 'usuarios',  corIcone: '#EC4899',               tela: 'Gestores',             papeis: ['admin'] },
  { rotulo: 'Auditoria',   icone: 'auditoria', corIcone: '#06B6D4',               tela: 'Auditoria',            papeis: ['admin','gerente','auditor'] },
];

// ── Icone SVG inline ──────────────────────────────────────────────────────────
function IconeNav({ nome, cor, tamanho = 18 }) {
  const d = CAMINHOS[nome];
  if (!d) return null;
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Saudacao por periodo do dia ──────────────────────────────────────────────
function _saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function AppLayout({
  children,
  navigation,
  telaAtual,
  titulo,
  scrollavel = true,
  semPadding = false,
}) {
  const { width } = useWindowDimensions();
  const isMobile  = width < MOBILE_BREAKPOINT;

  const [sidebarAberta,    setSidebarAberta]    = useState(!isMobile);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
  const [usuario,          setUsuario]          = useState(null);
  const [itemHover,        setItemHover]        = useState(null);

  const animSidebar = useRef(new Animated.Value(SIDEBAR_W)).current;

  useEffect(() => {
    pegarUsuario().then(setUsuario).catch(() => {});
  }, []);

  // Restaura preferencia de sidebar ao montar (apenas desktop)
  useEffect(() => {
    AsyncStorage.getItem('sidebar_collapsed').then(val => {
      if (val === '1') {
        setSidebarRecolhida(true);
        animSidebar.setValue(SIDEBAR_RECOLHIDA_W);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setSidebarAberta(!isMobile);
  }, [isMobile]);

  const papel        = usuario?.papel || 'operador';
  const primeiroNome = usuario?.nome?.split(' ')[0] || 'Usuario';
  const letraAvatar  = (primeiroNome || 'U')[0].toUpperCase();

  const itensFiltrados = ITENS_NAV.filter(item => {
    if (item.tela === telaAtual) return false;
    if (!item.papeis) return true;
    return item.papeis.includes(papel);
  });

  async function handleLogout() {
    try { await logout(); } catch (_) {}
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  function irPara(tela) {
    if (isMobile) setSidebarAberta(false);
    navigation.navigate(tela);
  }

  // Colapsa: esconde labels imediatamente, depois anima largura
  // Expande: anima largura, depois mostra labels (evita layout crampado)
  function toggleSidebar() {
    const recolher = !sidebarRecolhida;
    setItemHover(null);
    AsyncStorage.setItem('sidebar_collapsed', recolher ? '1' : '0').catch(() => {});

    if (recolher) {
      setSidebarRecolhida(true);
      Animated.timing(animSidebar, {
        toValue: SIDEBAR_RECOLHIDA_W,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animSidebar, {
        toValue: SIDEBAR_W,
        duration: 250,
        useNativeDriver: false,
      }).start(() => setSidebarRecolhida(false));
    }
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  function Sidebar() {
    return (
      <View style={est.sidebar}>

        {/* Area do logo */}
        <View style={[est.sidebarLogoArea, sidebarRecolhida && est.sidebarLogoAreaRecolhida]}>
          <LogoBold
            variant="white"
            height={sidebarRecolhida ? 28 : 32}
            somenteSimbolo={sidebarRecolhida}
          />

          {!sidebarRecolhida && (
            <Text style={est.sidebarSubtitulo}>Multi-Loja</Text>
          )}

          {/* Botao toggle — somente desktop */}
          {!isMobile && (
            <TouchableOpacity
              style={[est.btnToggle, sidebarRecolhida && est.btnToggleRecolhido]}
              onPress={toggleSidebar}
              activeOpacity={0.8}
            >
              <IconeNav
                nome={sidebarRecolhida ? 'chevronDir' : 'chevronEsq'}
                cor="#FFFFFF"
                tamanho={16}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Itens de navegacao */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={est.sidebarNav}
          contentContainerStyle={est.sidebarNavContent}
        >
          {itensFiltrados.map((item, idx) => {
            const ativo = item.tela === telaAtual;
            return (
              <View key={idx} style={{ position: 'relative' }}>
                <Pressable
                  style={({ pressed, hovered }) => [
                    est.navItem,
                    sidebarRecolhida && est.navItemRecolhido,
                    ativo && est.navItemAtivo,
                    !ativo && hovered && est.navItemHover,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => irPara(item.tela)}
                  onHoverIn={() => sidebarRecolhida && setItemHover(idx)}
                  onHoverOut={() => setItemHover(null)}
                >
                  <IconeNav
                    nome={item.icone}
                    cor={ativo ? '#FFFFFF' : item.corIcone}
                    tamanho={18}
                  />
                  {!sidebarRecolhida && (
                    <Text
                      style={[est.navLabel, ativo && est.navLabelAtivo]}
                      numberOfLines={1}
                    >
                      {item.rotulo}
                    </Text>
                  )}
                </Pressable>

                {/* Tooltip ao recolher — visivel via hover no desktop/web */}
                {sidebarRecolhida && itemHover === idx && (
                  <View style={est.tooltip} pointerEvents="none">
                    <Text style={est.tooltipTxt}>{item.rotulo}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Rodape: Ajuda + Sair */}
        <View style={est.sidebarRodape}>
          <View style={est.sidebarRodapeDivisor} />

          <View style={{ position: 'relative' }}>
            <Pressable
              style={({ pressed, hovered }) => [
                est.navItem,
                sidebarRecolhida && est.navItemRecolhido,
                hovered && est.navItemHover,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => irPara('Ajuda')}
              onHoverIn={() => sidebarRecolhida && setItemHover('ajuda')}
              onHoverOut={() => setItemHover(null)}
            >
              <IconeNav nome="ajuda" cor="#6366F1" tamanho={18} />
              {!sidebarRecolhida && (
                <Text style={[est.navLabel, { color: colors.onDarkMuted }]}>Ajuda</Text>
              )}
            </Pressable>
            {sidebarRecolhida && itemHover === 'ajuda' && (
              <View style={est.tooltip} pointerEvents="none">
                <Text style={est.tooltipTxt}>Ajuda</Text>
              </View>
            )}
          </View>

          <View style={{ position: 'relative' }}>
            <Pressable
              style={({ pressed, hovered }) => [
                est.navItem,
                sidebarRecolhida && est.navItemRecolhido,
                hovered && est.navItemHover,
                pressed && { opacity: 0.75 },
              ]}
              onPress={handleLogout}
              onHoverIn={() => sidebarRecolhida && setItemHover('sair')}
              onHoverOut={() => setItemHover(null)}
            >
              <IconeNav nome="sair" cor="#F87171" tamanho={18} />
              {!sidebarRecolhida && (
                <Text style={[est.navLabel, { color: '#F87171', fontWeight: '600' }]}>Sair</Text>
              )}
            </Pressable>
            {sidebarRecolhida && itemHover === 'sair' && (
              <View style={est.tooltip} pointerEvents="none">
                <Text style={est.tooltipTxt}>Sair</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── Conteudo principal ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={est.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.sidebarBg} />

      <View style={est.layout}>

        {/* Desktop: sidebar fixa com animacao de largura */}
        {!isMobile && (
          <Animated.View style={{ width: animSidebar, overflow: 'hidden' }}>
            <Sidebar />
          </Animated.View>
        )}

        {/* Area principal */}
        <View style={est.main}>

          {/* Header */}
          <View style={est.header}>
            {isMobile && (
              <TouchableOpacity
                style={est.hamburger}
                onPress={() => setSidebarAberta(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={est.hamburgerIco}>☰</Text>
              </TouchableOpacity>
            )}

            <Text style={est.headerTitulo} numberOfLines={1}>{titulo || ''}</Text>
            <View style={{ flex: 1 }} />

            {!isMobile && (
              <Text style={est.headerSaudacao} numberOfLines={1}>
                {_saudacao()}, {primeiroNome}
              </Text>
            )}

            <View style={est.avatar}>
              <Text style={est.avatarLetra}>{letraAvatar}</Text>
            </View>

            {!isMobile && (
              <TouchableOpacity style={est.btnSair} onPress={handleLogout} activeOpacity={0.8}>
                <Text style={est.btnSairLabel}>Sair</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Conteudo */}
          {scrollavel ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[est.conteudo, semPadding && est.semPadding]}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[est.conteudoFixo, semPadding && est.semPadding]}>
              {children}
            </View>
          )}
        </View>
      </View>

      {/* Overlay mobile: backdrop + drawer */}
      {isMobile && sidebarAberta && (
        <>
          <TouchableOpacity
            style={est.backdrop}
            onPress={() => setSidebarAberta(false)}
            activeOpacity={1}
          />
          <View style={est.sidebarDrawer}>
            <Sidebar />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const est = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: colors.sidebarBg,
  },

  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar: {
    flex: 1,
    backgroundColor: colors.sidebarBg,
    flexDirection: 'column',
  },

  sidebarDrawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_W,
    zIndex: 200,
    elevation: 20,
  },

  sidebarLogoArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },

  sidebarLogoAreaRecolhida: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },

  sidebarSubtitulo: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.5,
  },

  btnToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },

  btnToggleRecolhido: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },

  sidebarNav: {
    flex: 1,
  },

  sidebarNavContent: {
    paddingVertical: spacing.xs,
  },

  sidebarRodape: {
    paddingBottom: spacing.md,
  },

  sidebarRodapeDivisor: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  // ── Itens de nav ──────────────────────────────────────────────────────────
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginHorizontal: spacing.sm,
    marginVertical: 1,
  },

  navItemRecolhido: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginHorizontal: 0,
    borderRadius: 0,
    paddingVertical: 12,
  },

  navItemAtivo: {
    backgroundColor: '#4F46E5',
  },

  navItemHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  navLabel: {
    color: colors.onDark,
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },

  navLabelAtivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── Tooltip (sidebar recolhida, hover no desktop/web) ─────────────────────
  tooltip: {
    position: 'absolute',
    left: SIDEBAR_RECOLHIDA_W + 8,
    top: 6,
    backgroundColor: '#1E3A5F',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 9999,
    elevation: 20,
  },

  tooltipTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Backdrop mobile ──────────────────────────────────────────────────────
  backdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.50)',
    zIndex: 100,
    elevation: 10,
  },

  // ── Area principal ────────────────────────────────────────────────────────
  main: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    height: HEADER_H,
    backgroundColor: colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },

  hamburger: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  hamburgerIco: {
    color: colors.onDark,
    fontSize: 18,
  },

  headerTitulo: {
    color: colors.onDark,
    fontSize: fontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  headerSaudacao: {
    color: colors.onDarkMuted,
    fontSize: fontSize.sm,
    marginRight: spacing.md,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  avatarLetra: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },

  btnSair: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },

  btnSairLabel: {
    color: colors.onDark,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },

  // ── Conteudo ─────────────────────────────────────────────────────────────
  conteudo: {
    padding: spacing.md,
    flexGrow: 1,
  },

  conteudoFixo: {
    flex: 1,
    padding: spacing.md,
  },

  semPadding: {
    padding: 0,
  },
});
