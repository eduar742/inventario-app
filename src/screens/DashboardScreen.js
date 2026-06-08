// Dashboard principal — redesenhado para layout sidebar + area principal.
// Charts com react-native-svg (ja instalado). Toda logica de dados preservada.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path, Circle, Line, Rect, Text as SvgText,
} from 'react-native-svg';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarDashboardGeral, buscarSkusProblematicos, pegarUsuario } from '../services/api';
import NaturezaFiltro from '../components/NaturezaFiltro';
import GrupoMaterialFiltro from '../components/GrupoMaterialFiltro';

const INTERVALO = 30000;
const P_ICO = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoeda(v) {
  if (!v && v !== 0) return '—';
  return `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDt(d) {
  if (!d) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function corAcur(v) {
  if (v >= 95) return '#16A34A';
  if (v >= 85) return '#F97316';
  return '#EF4444';
}

// ── Icones SVG Tabler ────────────────────────────────────────────────────────
function IcoLayoutDashboard({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Rect x="3" y="3" width="7" height="9" rx="1" />
      <Rect x="3" y="15" width="7" height="6" rx="1" />
      <Rect x="13" y="3" width="8" height="6" rx="1" />
      <Rect x="13" y="12" width="8" height="9" rx="1" />
    </Svg>
  );
}
function IcoPackage({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M12 3l9 4.5v9L12 21 3 16.5v-9L12 3z" />
      <Path d="M12 12L3 7.5M12 12v9M12 12l9-4.5M7.5 5.25l9 4.5" />
    </Svg>
  );
}
function IcoBuildingStore({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M3 21v-9M21 21v-9" />
      <Path d="M4 3h16l1 7H3L4 3z" />
      <Path d="M9 21v-6h6v6M3 10h18" />
      <Path d="M9 10a3 3 0 0 0 6 0" />
    </Svg>
  );
}
function IcoBox({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M12 3l9 4.5v9L12 21 3 16.5v-9L12 3z" />
      <Path d="M12 12L3 7.5M12 12l9-4.5M12 12v9" />
    </Svg>
  );
}
function IcoArrowsExchange({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </Svg>
  );
}
function IcoGitMerge({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="6" cy="6" r="2" />
      <Circle cx="18" cy="18" r="2" />
      <Circle cx="6" cy="18" r="2" />
      <Path d="M6 8v8M6 8c0 2 2 4 6 4s6 2 6 4" />
    </Svg>
  );
}
function IcoFileAnalytics({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <Path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <Path d="M9 17l2-2 2 2 2-4" />
    </Svg>
  );
}
function IcoSettings({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}
function IcoChevronRight({ size = 14, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}
function IcoChevronDown({ size = 13, cor = '#374151' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}
function IcoClock({ size = 13, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 3" />
    </Svg>
  );
}
function IcoBell({ size = 20, cor = '#374151' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M10 5a2 2 0 0 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" />
      <Path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </Svg>
  );
}
function IcoHelpCircle({ size = 20, cor = '#374151' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 17v.01M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    </Svg>
  );
}
function IcoSearch({ size = 16, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.35-4.35" />
    </Svg>
  );
}
function IcoCalendar({ size = 15, cor = '#374151' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}
function IcoAdjustments({ size = 15, cor = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  );
}
function IcoHourglass({ size = 24, cor = '#D97706' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M6.5 4h11M6.5 20h11M8 4c0 4 8 4 8 8s-8 4-8 8" />
      <Path d="M16 4c0 4-8 4-8 8s8 4 8 8" />
    </Svg>
  );
}
function IcoCircleCheck({ size = 24, cor = '#16A34A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}
function IcoTrendingDown({ size = 28, cor = '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M3 7l5 5 4-4 8 8" />
      <Path d="M21 21h-6M21 21v-6" />
    </Svg>
  );
}
function IcoDownload({ size = 18, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M12 5v14M5 15l7 7 7-7M5 20h14" />
    </Svg>
  );
}
function IcoUpload({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5 5 5M12 4v12" />
    </Svg>
  );
}
function IcoUsers({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Circle cx="9" cy="7" r="4" />
      <Path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" />
    </Svg>
  );
}
function IcoShieldCheck({ size = 20, cor = '#4B5563' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...P_ICO} stroke={cor} strokeWidth={2}>
      <Path d="M12 3a12 12 0 0 0 8.5 3 12 12 0 0 1-3.5 11.5L12 21l-5-3.5A12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

// ── Logo BOLD (marca SVG + texto RN, mesmo padrao da HomeScreen) ─────────────
function LogoBoldSidebar() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={22} height={28} viewBox="0 0 26 34">
        <Path d="M0 5 L20 0 L24 10 L4 15 Z" fill="#F5A623" />
        <Path d="M2 19 L22 14 L26 24 L6 29 Z" fill="#22C55E" />
      </Svg>
      <Text style={{ color: '#1E3A5F', fontSize: 17, fontWeight: '800', letterSpacing: 1.5, marginLeft: 8 }}>
        BOLD
      </Text>
    </View>
  );
}

// ── Gauge Semicircular — stroke-based, geometria corrigida ───────────────────
// O gauge vai de 0% (esquerda) a 100% (direita) passando pelo TOPO.
// Angulo: 0% = π rad, 100% = 0 rad. Arc counterclockwise com sweep=0.
// large-arc-flag DEVE ser 0 para qualquer zona (nenhuma zona supera 180°).
// la=1 apenas para o track completo (exatamente 180°, evita ambiguidade).
function GaugeSemiCircle({ valor = 0, tamanho = 220 }) {
  // Proporcoes calculadas para que tudo caiba dentro de tamanho px de largura
  // deixando espaco para labels (aprox 30px em cada lado alem do arco).
  const r  = Math.floor((tamanho / 2 - 36) / 1.14); // raio: garante margem para labels
  const sw = Math.round(r * 0.27);                    // espessura do arco
  const cx = tamanho / 2;
  const cy = r + sw + 8;                              // centro Y: topo visivel sem corte
  const f  = v => Number(v).toFixed(2);

  function pt(pct, raio) {
    const ang = Math.PI * (1 - pct / 100);
    return { x: cx + raio * Math.cos(ang), y: cy - raio * Math.sin(ang) };
  }

  // sweep=0 (counterclockwise no SVG = visual "pelo topo").
  // la: 1 somente quando o arco eh exatamente 180 graus (track completo).
  function arc(pct1, pct2) {
    const a = pt(pct1, r), b = pt(pct2, r);
    const spanDeg = (pct2 - pct1) / 100 * 180;
    const la = spanDeg >= 180 ? 1 : 0;
    return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 ${la} 0 ${f(b.x)} ${f(b.y)}`;
  }

  const v      = Math.min(Math.max(valor, 0), 100);
  const needle = pt(v, r * 0.78);
  const svgH   = cy + Math.round(sw / 2) + 22;
  const lblR   = r + Math.round(sw / 2) + 10;

  return (
    <Svg width={tamanho} height={svgH}>
      {/* Track cinza de fundo (la=1 pois span=180°) */}
      <Path d={arc(0, 100)} fill="none" stroke="#E5E7EB" strokeWidth={sw} strokeLinecap="butt" />
      {/* Zona vermelha 0–85% (la=0, span=153°) */}
      <Path d={arc(0, 85)}   fill="none" stroke="#EF4444" strokeWidth={sw} strokeLinecap="butt" />
      {/* Zona laranja 85–95% (la=0, span=18°) */}
      <Path d={arc(85, 95)}  fill="none" stroke="#F97316" strokeWidth={sw} strokeLinecap="butt" />
      {/* Zona verde 95–100% (la=0, span=9°) */}
      <Path d={arc(95, 100)} fill="none" stroke="#16A34A" strokeWidth={sw} strokeLinecap="butt" />
      {/* Ponteiro */}
      <Line x1={f(cx)} y1={f(cy)} x2={f(needle.x)} y2={f(needle.y)}
        stroke="#111827" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={f(cx)} cy={f(cy)} r={7} fill="#111827" />
      <Circle cx={f(cx)} cy={f(cy)} r={3} fill="#FFFFFF" />
      {/* Labels nos limiares */}
      {[
        { pct: 0,   anchor: 'end',    dy: 5  },
        { pct: 85,  anchor: 'middle', dy: -5 },
        { pct: 95,  anchor: 'middle', dy: -5 },
        { pct: 100, anchor: 'start',  dy: 5  },
      ].map(({ pct, anchor, dy }) => {
        const p = pt(pct, lblR);
        return (
          <SvgText key={pct} x={f(p.x)} y={f(p.y + dy)}
            fontSize={11} fontWeight="600" fill="#374151" textAnchor={anchor}>
            {pct === 100 ? '100%' : `${pct}%`}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Grafico de barras ─────────────────────────────────────────────────────────
function BarChartV2({ labels, data }) {
  if (!data || data.length === 0) return null;
  const altMax = 160;
  return (
    <View>
      {/* Linha de referencia 100% */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 11, color: '#9CA3AF', width: 36 }}>100%</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: altMax + 50, paddingHorizontal: 4, gap: 6 }}>
          {data.map((val, i) => {
            const h = Math.max((val / 100) * altMax, 6);
            const cor = corAcur(val);
            return (
              <View key={i} style={{ alignItems: 'center', width: 54, minWidth: 0 }}>
                <Text style={{ fontSize: 11, color: cor, fontWeight: '700', marginBottom: 5, textAlign: 'center' }}>
                  {val.toFixed(1)}%
                </Text>
                <View style={{
                  width: 38, height: h, backgroundColor: cor,
                  borderRadius: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                }} />
                <Text style={{ fontSize: 10, color: '#374151', fontWeight: '600', marginTop: 6, textAlign: 'center' }} numberOfLines={1}>
                  {labels[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { cor: '#16A34A', txt: '≥ 95% Excelente'  },
          { cor: '#F97316', txt: '85%–94% Atenção'  },
          { cor: '#EF4444', txt: '< 85% Crítico'    },
        ].map(({ cor, txt }) => (
          <View key={txt} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: cor }} />
            <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>{txt}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
// Itens espelham BLOCOS da HomeScreen: mesmas rotas, mesmos papeis, mesma ordem.
const MENU_ITENS = [
  { id: 'inventario',  label: 'Inventário',  tela: 'Lojas',               Ico: IcoPackage,         papeis: ['admin', 'gestor', 'operador'] },
  { id: 'dashboard',   label: 'Dashboard',   tela: 'Dashboard',           Ico: IcoLayoutDashboard, papeis: ['admin', 'gestor', 'gerente', 'auditor'] },
  { id: 'consolidado', label: 'Consolidado', tela: 'DashboardConsolidado',Ico: IcoBuildingStore,   papeis: ['admin', 'gestor', 'gerente', 'auditor'] },
  { id: 'relatorio',   label: 'Rel. Geral',  tela: 'RelatorioConsolidado',Ico: IcoFileAnalytics,   papeis: ['admin', 'gestor', 'gerente', 'auditor'] },
  { id: 'importar',    label: 'Importar',    tela: 'Importacao',          Ico: IcoUpload,          papeis: ['admin', 'gestor'] },
  { id: 'usuarios',    label: 'Usuários',    tela: 'Gestores',            Ico: IcoUsers,           papeis: ['admin'] },
  { id: 'auditoria',   label: 'Auditoria',   tela: 'Auditoria',          Ico: IcoShieldCheck,     papeis: ['admin'] },
  { id: 'ajuda',       label: 'Ajuda',       tela: 'Ajuda',              Ico: IcoHelpCircle,      papeis: ['admin', 'gestor', 'gerente', 'auditor', 'operador'] },
];

function Sidebar({ navigation, ultimaAtu, usuario, telaAtual = 'Dashboard' }) {
  const papel = usuario?.papel || 'operador';
  // Filtra por papel (mesmo criterio da HomeScreen) e oculta o item da tela atual
  const itensFiltrados = MENU_ITENS.filter(
    item => item.papeis.includes(papel) && item.tela !== telaAtual,
  );

  return (
    <View style={sid.wrap}>
      <View style={sid.logo}><LogoBoldSidebar /></View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={sid.menu}>
          {itensFiltrados.map(({ id, label, tela, Ico }) => (
            <TouchableOpacity
              key={id}
              style={sid.item}
              onPress={() => navigation.navigate(tela)}
              activeOpacity={0.7}
            >
              <Ico size={20} cor="#4B5563" />
              <Text style={sid.lbl}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={sid.rodape}>
        <View style={sid.rdRow}>
          <IcoClock size={13} cor="#9CA3AF" />
          <View>
            <Text style={sid.rdLabel}>Última atualização</Text>
            <Text style={sid.rdHora}>Hoje às {fmtDt(ultimaAtu)}</Text>
          </View>
        </View>
        <View style={sid.liveLine}>
          <View style={sid.liveDot} />
          <Text style={sid.liveTxt}>Ao vivo</Text>
        </View>
      </View>
    </View>
  );
}

const sid = StyleSheet.create({
  wrap:    { width: 200, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E5E7EB', flexShrink: 0 },
  logo:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  menu:    { paddingHorizontal: 12, gap: 2, paddingBottom: 16 },
  item:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  lbl:     { flex: 1, fontSize: 14, fontWeight: '500', color: '#4B5563' },
  rodape:  { padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8 },
  rdRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  rdLabel: { fontSize: 12, color: '#9CA3AF' },
  rdHora:  { fontSize: 12, color: '#6B7280' },
  liveLine:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveTxt: { fontSize: 12, color: '#22C55E' },
});

// ── Header area principal ─────────────────────────────────────────────────────
function HeaderPrincipal({ isDesktop }) {
  return (
    <View style={hp.wrap}>
      <View style={hp.esq}>
        <Text style={hp.titulo}>Dashboard de Inventário</Text>
        <Text style={hp.sub}>Visão geral da acuracidade e divergências</Text>
      </View>
      {isDesktop && (
        <TouchableOpacity style={hp.btnFil}>
          <IcoAdjustments size={15} cor="#FFFFFF" />
          <Text style={hp.btnFilTxt}>Filtros</Text>
          <IcoChevronDown size={13} cor="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const hp = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, minWidth: 0 },
  esq:       { flex: 1, minWidth: 0 },
  titulo:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  sub:       { fontSize: 14, color: '#6B7280', marginTop: 2 },
  btnFil:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4F46E5', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  btnFilTxt: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
});

// ── Cards KPI ─────────────────────────────────────────────────────────────────
const KPI_DEF = [
  { corFundo: '#EEF2FF', corIco: '#4F46E5', corNum: '#4F46E5', titulo: 'Lojas',        sub: 'Total de lojas',          Ico: IcoBuildingStore },
  { corFundo: '#FFF7ED', corIco: '#F97316', corNum: '#F97316', titulo: 'Em Andamento', sub: 'Contagens em progresso',   Ico: IcoClock         },
  { corFundo: '#FFFBEB', corIco: '#D97706', corNum: '#D97706', titulo: 'Aguardando',   sub: 'Contagens aguardando',     Ico: IcoHourglass     },
  { corFundo: '#F0FDF4', corIco: '#16A34A', corNum: '#16A34A', titulo: 'Concluídas',   sub: 'Contagens finalizadas',    Ico: IcoCircleCheck   },
];

function CardKpi({ def, valor }) {
  const { corFundo, corIco, corNum, titulo, sub, Ico } = def;
  return (
    <View style={ck.card}>
      <View style={[ck.icoBox, { backgroundColor: corFundo }]}>
        <Ico size={24} cor={corIco} />
      </View>
      <View style={ck.txts}>
        <Text style={[ck.valor, { color: corNum }]}>{valor ?? '—'}</Text>
        <Text style={ck.titulo}>{titulo}</Text>
        <Text style={ck.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const ck = StyleSheet.create({
  card:   { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  icoBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txts:   { flex: 1, minWidth: 0 },
  valor:  { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  titulo: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 2 },
  sub:    { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
});

// ── Tabela de divergencias ────────────────────────────────────────────────────
const STATUS_PILL = {
  aprovada:  { bg: '#F0FDF4', cor: '#16A34A', label: 'Aprovada'  },
  pendente:  { bg: '#FFFBEB', cor: '#D97706', label: 'Pendente'  },
  rejeitada: { bg: '#FEF2F2', cor: '#EF4444', label: 'Rejeitada' },
};

function TabelaDivergencias({ rows }) {
  const [pag, setPag] = useState(1);
  const [itensPp, setItensPp] = useState(5);

  const total = rows.length;
  const totalPags = Math.max(1, Math.ceil(total / itensPp));
  const ini = (pag - 1) * itensPp;
  const fim = Math.min(ini + itensPp, total);
  const pagAtual = rows.slice(ini, fim);

  const pagNums = [];
  if (totalPags <= 7) {
    for (let i = 1; i <= totalPags; i++) pagNums.push(i);
  } else {
    pagNums.push(1);
    if (pag > 3) pagNums.push('…');
    for (let i = Math.max(2, pag - 1); i <= Math.min(totalPags - 1, pag + 1); i++) pagNums.push(i);
    if (pag < totalPags - 2) pagNums.push('…');
    pagNums.push(totalPags);
  }

  return (
    <View style={tb.card}>
      <Text style={tb.titulo}>Top Divergências por Valor</Text>
      {/* Header */}
      <View style={tb.hRow}>
        <Text style={[tb.hCell, { width: 36 }]}>#</Text>
        <Text style={[tb.hCell, { flex: 1, minWidth: 160 }]}>Produto</Text>
        <Text style={[tb.hCell, { width: 170 }]}>SKU</Text>
        <Text style={[tb.hCell, { width: 70 }]}>Loja</Text>
        <Text style={[tb.hCell, { width: 135 }]}>Valor Divergente</Text>
        <Text style={[tb.hCell, { width: 90 }]}>Status</Text>
      </View>
      {/* Linhas */}
      {pagAtual.map((d, i) => {
        const v = d.valor_diferenca || 0;
        const corV = v < 0 ? '#EF4444' : '#16A34A';
        const stt = STATUS_PILL[d.status] || STATUS_PILL.pendente;
        return (
          <View key={i} style={[tb.linha, (ini + i) % 2 === 1 && { backgroundColor: '#F9FAFB' }]}>
            <Text style={[tb.cell, { width: 36, fontWeight: '600', textAlign: 'center' }]}>{ini + i + 1}</Text>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }]}>
              <View style={tb.imgBox} />
              <Text style={[tb.cell, { flex: 1, minWidth: 0 }]} numberOfLines={2}>{d.produto_descricao}</Text>
            </View>
            <Text style={[tb.cell, { width: 170 }]} numberOfLines={1}>{d.produto_sku}</Text>
            <Text style={[tb.cell, { width: 70 }]} numberOfLines={1}>{d.loja_codigo}</Text>
            <Text style={[tb.cell, { width: 135, color: corV, fontWeight: '600' }]}>{fmtMoeda(v)}</Text>
            <View style={{ width: 90 }}>
              <View style={[tb.pill, { backgroundColor: stt.bg }]}>
                <Text style={[tb.pillTxt, { color: stt.cor }]}>{stt.label}</Text>
              </View>
            </View>
          </View>
        );
      })}
      {/* Rodape */}
      <View style={tb.rodape}>
        <Text style={tb.rdTxt}>Mostrando {ini + 1} a {fim} de {total} itens</Text>
        <View style={tb.pagRow}>
          <TouchableOpacity style={tb.pagBtn} onPress={() => setPag(p => Math.max(1, p - 1))} disabled={pag === 1}>
            <Text style={tb.pagBtnTxt}>‹</Text>
          </TouchableOpacity>
          {pagNums.map((p, i) =>
            p === '…'
              ? <Text key={`el${i}`} style={{ fontSize: 14, color: '#6B7280', paddingHorizontal: 4 }}>…</Text>
              : (
                <TouchableOpacity key={p} style={[tb.pagBtn, pag === p && tb.pagBtnAt]} onPress={() => setPag(p)}>
                  <Text style={[tb.pagBtnTxt, pag === p && tb.pagBtnAtTxt]}>{p}</Text>
                </TouchableOpacity>
              )
          )}
          <TouchableOpacity style={tb.pagBtn} onPress={() => setPag(p => Math.min(totalPags, p + 1))} disabled={pag === totalPags}>
            <Text style={tb.pagBtnTxt}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={tb.ippRow}>
          <Text style={tb.rdTxt}>Itens por página: </Text>
          {[5, 10, 25, 50].map(n => (
            <TouchableOpacity key={n} style={[tb.ippBtn, itensPp === n && tb.ippBtnAt]}
              onPress={() => { setItensPp(n); setPag(1); }}>
              <Text style={[tb.ippTxt, itensPp === n && tb.ippTxtAt]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  card:      { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 24, overflow: 'hidden' },
  titulo:    { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  hRow:      { flexDirection: 'row', backgroundColor: '#1E3A5F', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, marginBottom: 2, gap: 8 },
  hCell:     { fontSize: 13, fontWeight: '600', color: '#FFFFFF', minWidth: 0 },
  linha:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, minHeight: 48 },
  cell:      { fontSize: 13, color: '#374151', minWidth: 0 },
  imgBox:    { width: 32, height: 32, borderRadius: 4, backgroundColor: '#E5E7EB', flexShrink: 0 },
  pill:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillTxt:   { fontSize: 12, fontWeight: '500' },
  rodape:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 },
  rdTxt:     { fontSize: 13, color: '#6B7280' },
  pagRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pagBtn:    { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  pagBtnAt:  { backgroundColor: '#4F46E5' },
  pagBtnTxt: { fontSize: 14, color: '#374151', fontWeight: '500' },
  pagBtnAtTxt:{ color: '#FFFFFF' },
  ippRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ippBtn:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  ippBtnAt:  { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  ippTxt:    { fontSize: 12, color: '#374151' },
  ippTxtAt:  { color: '#FFFFFF' },
});

// ── Tela principal ────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAtu, setUltimaAtu] = useState(null);
  const [naturezaId, setNaturezaId] = useState(null);
  const [grupoMaterial, setGrupoMaterial] = useState(null);
  const [skusProblematicos, setSkusProblematicos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const timerRef = useRef(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const [d, skus] = await Promise.all([
        buscarDashboardGeral(naturezaId, grupoMaterial),
        buscarSkusProblematicos(6, 10).catch(() => ({ skus: [] })),
      ]);
      setDados(d);
      setSkusProblematicos(skus.skus || []);
      setUltimaAtu(new Date());
    } catch (_) {}
    finally { setCarregando(false); setRefreshing(false); }
  }, [naturezaId, grupoMaterial]);

  useEffect(() => {
    carregar();
    pegarUsuario().then(u => setUsuario(u)).catch(() => {});
    timerRef.current = setInterval(() => carregar(true), INTERVALO);
    return () => clearInterval(timerRef.current);
  }, [carregar]);

  if (carregando && !dados) {
    return (
      <SafeAreaView style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F8F9FA' }}>
        {isDesktop && <Sidebar navigation={navigation} ultimaAtu={null} usuario={usuario} telaAtual="Dashboard" />}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#6B7280' }}>Carregando dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const kpis   = dados?.kpis    || {};
  const sess   = dados?.sessoes || {};
  const top    = dados?.top_divergencias || [];
  const ativas = dados?.sessoes_ativas   || [];
  const acLoja = dados?.acuracidade_por_loja || [];
  const acMedia = parseFloat(kpis.acuracidade_media ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, flexDirection: 'row', backgroundColor: '#F8F9FA' }}>
      {isDesktop && (
        <Sidebar
          navigation={navigation}
          ultimaAtu={ultimaAtu}
          usuario={usuario}
          telaAtual="Dashboard"
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: isDesktop ? 32 : 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); carregar(); }}
            colors={['#4F46E5']} tintColor="#4F46E5"
          />
        }
      >
        {/* Filtros natureza + grupo */}
        <NaturezaFiltro
          value={naturezaId}
          onChange={id => { setNaturezaId(id); setGrupoMaterial(null); setCarregando(true); }}
        />
        <GrupoMaterialFiltro
          grupos={dados?.grupos_material || []}
          value={grupoMaterial}
          onChange={g => { setGrupoMaterial(g); setCarregando(true); }}
        />

        {/* Header */}
        <HeaderPrincipal isDesktop={isDesktop} />

        {/* KPIs */}
        <View style={[{ flexDirection: 'row', gap: 16, marginBottom: 24 }, !isDesktop && { flexWrap: 'wrap' }]}>
          <CardKpi def={KPI_DEF[0]} valor={kpis.total_lojas ?? '—'} />
          <CardKpi def={KPI_DEF[1]} valor={sess.ativas ?? 0} />
          <CardKpi def={KPI_DEF[2]} valor={sess.aguardando_aprovacao ?? 0} />
          <CardKpi def={KPI_DEF[3]} valor={sess.concluidas_total ?? 0} />
        </View>

        {/* Metricas: acuracidade + valor divergente */}
        <View style={[{ gap: 16, marginBottom: 24 }, isDesktop ? { flexDirection: 'row' } : { flexDirection: 'column' }]}>
          {/* Acuracidade Media */}
          <View style={[mt.card, { flex: 1, minWidth: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={mt.titulo}>Acuracidade Média</Text>
                <Text style={[mt.valorGde, { color: corAcur(acMedia) }]}>
                  {acMedia.toFixed(1)}%
                </Text>
                <Text style={mt.sub}>Índice de acuracidade geral</Text>
              </View>
              <GaugeSemiCircle valor={acMedia} tamanho={isDesktop ? 210 : 170} />
            </View>
          </View>

          {/* Valor Divergente */}
          <View style={[mt.card, { flex: 1, minWidth: 0, justifyContent: 'center' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={mt.titulo}>Valor Divergente Total</Text>
                <Text style={[mt.valorGde, { color: '#EF4444', fontSize: 30, lineHeight: 38 }]}>
                  {fmtMoeda(kpis.valor_total_divergente)}
                </Text>
                <Text style={mt.sub}>Impacto financeiro total das divergências</Text>
              </View>
              <View style={mt.icoCircle}>
                <IcoTrendingDown size={28} cor="#EF4444" />
              </View>
            </View>
          </View>
        </View>

        {/* Grafico por loja */}
        {acLoja.length > 0 && (
          <View style={gr.card}>
            <View style={gr.hRow}>
              <Text style={gr.titulo}>Acuracidade por Loja</Text>
              <TouchableOpacity><IcoDownload size={18} cor="#9CA3AF" /></TouchableOpacity>
            </View>
            <BarChartV2
              labels={acLoja.map(l => l.loja_codigo)}
              data={acLoja.map(l => parseFloat(l.acuracidade || 0))}
            />
          </View>
        )}

        {/* Tabela divergencias */}
        {top.length > 0 && (
          isDesktop
            ? <TabelaDivergencias rows={top} />
            : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: 620 }}>
                  <TabelaDivergencias rows={top} />
                </View>
              </ScrollView>
            )
        )}

        {/* Sessoes ativas */}
        {ativas.length > 0 && (
          <View style={es.card}>
            <Text style={es.titulo}>Sessões Ativas ({ativas.length})</Text>
            {ativas.map(s => (
              <View key={s.sessao_id} style={es.sessao}>
                <View style={es.sTop}>
                  <View style={[es.badge, { backgroundColor: s.status === 'aguardando_aprovacao' ? '#FFFBEB' : '#EFF6FF' }]}>
                    <Text style={[es.badgeTxt, { color: s.status === 'aguardando_aprovacao' ? '#D97706' : '#3B82F6' }]}>{s.loja_codigo}</Text>
                  </View>
                  <Text style={es.nome} numberOfLines={1}>{s.nome}</Text>
                  <Text style={es.pct}>{s.percentual_progresso}%</Text>
                </View>
                <View style={es.progFundo}>
                  <View style={[es.progFill, { width: `${Math.max(s.percentual_progresso, 1)}%` }]} />
                </View>
                <Text style={es.sSub}>
                  {s.contados}/{s.total_produtos} produtos
                  {s.status === 'aguardando_aprovacao' ? ' · Aguardando aprovação' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Atencao Recorrente */}
        {skusProblematicos.length > 0 && (
          <View style={sk.card}>
            <Text style={sk.titulo}>⚠️ Atenção Recorrente</Text>
            <Text style={sk.sub}>SKUs com divergência em múltiplas sessões (últimas 6 por loja)</Text>
            {skusProblematicos.map((sku, i) => (
              <View key={sku.sku} style={[sk.linha, i % 2 === 0 && { backgroundColor: '#F8FAFC' }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={sk.cod}>{sku.sku}</Text>
                  <Text style={sk.desc} numberOfLines={1}>{sku.descricao}</Text>
                  {sku.lojas_afetadas?.length > 0 && (
                    <Text style={sk.lojas}>{sku.lojas_afetadas.join(' · ')}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[sk.badge, { backgroundColor: sku.direcao_predominante === 'sobra' ? '#FEF3C7' : '#FEE2E2' }]}>
                    <Text style={[sk.badgeTxt, { color: sku.direcao_predominante === 'sobra' ? '#92400E' : '#DC2626' }]}>
                      {sku.direcao_predominante === 'sobra' ? '↑ Sobra' : '↓ Falta'}
                    </Text>
                  </View>
                  <Text style={sk.sess}>{sku.num_sessoes_com_divergencia}x</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Link detalhe por loja */}
        <TouchableOpacity
          style={{ backgroundColor: '#EEF2FF', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 32 }}
          onPress={() => navigation.navigate('DashboardLojas')}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#4F46E5' }}>
            Ver histórico de todas as lojas →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Estilos das secoes ────────────────────────────────────────────────────────
const mt = StyleSheet.create({
  card:     { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 24 },
  titulo:   { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  valorGde: { fontSize: 36, fontWeight: '700', lineHeight: 44, marginBottom: 4 },
  sub:      { fontSize: 12, color: '#9CA3AF' },
  icoCircle:{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 16 },
});

const gr = StyleSheet.create({
  card:  { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 24 },
  hRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo:{ fontSize: 16, fontWeight: '700', color: '#111827' },
});

const es = StyleSheet.create({
  card:     { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 24 },
  titulo:   { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sessao:   { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  sTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  badge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  nome:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827', minWidth: 0 },
  pct:      { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  progFundo:{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 999, overflow: 'hidden', marginBottom: 6 },
  progFill: { height: '100%', backgroundColor: '#4F46E5', borderRadius: 999 },
  sSub:     { fontSize: 12, color: '#6B7280' },
});

const sk = StyleSheet.create({
  card:    { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 24 },
  titulo:  { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sub:     { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },
  linha:   { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 6, marginBottom: 2, gap: 12 },
  cod:     { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  desc:    { fontSize: 12, color: '#111827', marginTop: 1 },
  lojas:   { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  badge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeTxt:{ fontSize: 10, fontWeight: '700' },
  sess:    { fontSize: 14, fontWeight: '800', color: '#DC2626' },
});
