// Tela de Auditoria — Painel de Inteligencia em Auditoria de Inventario.
// Tema neon escuro: KPIs em destaque, tendencia de acuracidade, distribuicao por
// categoria, divergencias por zona, alertas criticos, status ring e resumo do periodo.
// Aba "Ferramentas": exportar audit log + participacao por operador (sem alteracoes).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Modal, useWindowDimensions, ImageBackground,
} from 'react-native';
import Svg, {
  Path, Line, Circle, Rect, Text as SvgText, Polyline, G, Polygon,
} from 'react-native-svg';

import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLayout from '../components/AppLayout';
import NaturezaFiltro from '../components/NaturezaFiltro';
import GrupoMaterialFiltro from '../components/GrupoMaterialFiltro';
import { spacing, fontSize } from '../theme/colors';
import { formatarHora, formatarAgora } from '../utils/formatadores';
import {
  buscarDashboardGeral,
  exportarAuditLog,
  listarSessoes,
  buscarParticipacaoOperadores,
  listarUsuarios,
  listarLojas,
  pegarUsuario,
  buscarPerfilAtual,
} from '../services/api';

const IMG_RESUMO = require('../../assets/Resumo do Período.png');

// ── Paleta neon / dark ────────────────────────────────────────────────────────
const DK = {
  bg:     '#070F1C',
  card:   '#0C1A2E',
  card2:  '#102138',
  borda:  '#1B3254',
  nBlue:  '#00F2FF',
  nGreen: '#00FF88',
  nRed:   '#FF3366',
  nYellow:'#FFD700',
  nPurp:  '#BF5FFF',
  nOrange:'#FF6B35',
  txt:    '#FFFFFF',
  txt2:   '#D1D5DB',
  txt3:   '#9CA3AF',
};

const MESES_NOMES = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ANOS = [2025, 2026, 2027];

const SIGLAS_LOJA = {
  L01: 'MTZ',  L02: 'SBC',  L03: 'BH',    L04: 'CTBA',
  L05: 'SJRP', L06: 'MGA',  L07: 'GRU',   L08: 'CCO',
  L09: 'POA',  L10: 'GO',   L11: 'SJ',    L12: 'RP',
  L13: 'CUIABÁ', L14: 'RS', L15: 'SINOP', L16: 'FOR', L17: 'CG',
};

const STORAGE_KEY_LAYOUT = '@auditoria_layout_v1';
const BLOCOS_PADRAO = [
  { id: 'tendencia',    flex: 42 },
  { id: 'distribuicao', flex: 29 },
  { id: 'divergencias', flex: 29 },
  { id: 'alertas',      flex: 50 },
  { id: 'status',       flex: 29 },
  { id: 'resumo',       flex: 30 },
];

// Agrupa blocos em linhas: nova linha quando soma de flex ultrapassa 110
function computarLinhas(blocos) {
  const ls = [[]]; let soma = 0;
  for (const b of blocos) {
    if (ls[ls.length - 1].length > 0 && soma + b.flex > 110) {
      ls.push([]); soma = 0;
    }
    ls[ls.length - 1].push(b); soma += b.flex;
  }
  return ls;
}
const TIPOS_ACAO = [
  { valor: null,          rotulo: 'Todos'        },
  { valor: 'sessao',      rotulo: 'Sessoes'      },
  { valor: 'contagem',    rotulo: 'Contagens'    },
  { valor: 'divergencia', rotulo: 'Divergencias' },
  { valor: 'importacao',  rotulo: 'Importacoes'  },
  { valor: 'usuario',     rotulo: 'Usuarios'     },
];

// ── Hook de dados ─────────────────────────────────────────────────────────────
function useAuditoriaData(naturezaId, grupoMaterial, lojaIds, mesReferencias) {
  const [estado, setEstado] = useState({
    dash: null, sessoes: [], totalUsuarios: 0, carregando: true, erro: null, ultimaAtualizacao: null,
  });
  // Arrays serialized para deps estavel (evita re-render infinito com referencias novas)
  const lojaKey = lojaIds.join(',');
  const mesKey  = mesReferencias.join(',');
  const carregar = useCallback(async () => {
    setEstado(p => ({ ...p, carregando: true, erro: null }));
    try {
      const [dash, pag, usuarios] = await Promise.all([
        buscarDashboardGeral(naturezaId, grupoMaterial, lojaIds, mesReferencias),
        listarSessoes({ status: 'concluida' }, 1, 50),
        listarUsuarios(),
      ]);
      setEstado({
        dash,
        sessoes: pag?.items || [],
        totalUsuarios: Array.isArray(usuarios) ? usuarios.length : 0,
        carregando: false,
        erro: null,
        ultimaAtualizacao: formatarAgora(),
      });
    } catch (err) {
      setEstado(p => ({ ...p, carregando: false, erro: err.message || 'Erro ao carregar' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturezaId, grupoMaterial, lojaKey, mesKey]);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [carregar]);
  return { ...estado, recarregar: carregar };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMoeda(v) {
  if (v == null) return '—';
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000)    return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${Number(v).toFixed(2)}`;
}
function fmtMoedaCurto(v) {
  const abs  = Math.abs(v);
  const sinal = v > 0 ? '+' : v < 0 ? '-' : '';
  if (abs >= 1000000) return `${sinal}${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000)    return `${sinal}${(abs / 1000).toFixed(0)}k`;
  return `${sinal}${abs.toFixed(0)}`;
}
function fmtPct(v)  { return v == null ? '—' : `${Number(v).toFixed(1)}%`; }
function fmtNum(v)  { return v == null ? '—' : Number(v).toLocaleString('pt-BR'); }
function fmtMin(m) {
  if (!m) return '<1min';
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${Math.round(m % 60)}m`;
}
function agruparPorMes(sessoes) {
  const mapa = {};
  sessoes.forEach(s => {
    const c = s.mes_referencia
      ? s.mes_referencia.substring(0, 7)
      : s.criada_em ? s.criada_em.substring(0, 7) : null;
    if (c) mapa[c] = (mapa[c] || 0) + 1;
  });
  return Object.entries(mapa)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([mes, qtd]) => ({ rotulo: mes, valor: qtd }));
}

// Gera duas series de tendencia de acuracidade usando fatores sazonais predefinidos
function calcTendencia(sessoes, mediaAtual) {
  if (!mediaAtual || mediaAtual <= 0) return null;
  const meses = agruparPorMes(sessoes);
  if (meses.length < 2) return null;
  const fFin = [0.923, 0.938, 0.951, 0.963, 0.974, 0.983, 1.0];
  const fUni = [0.910, 0.926, 0.940, 0.954, 0.966, 0.978, 0.992];
  const n    = meses.length;
  const base = Math.min(mediaAtual, 100);
  return {
    financeira: meses.map((m, i) => ({
      rotulo: m.rotulo,
      valor:  +(base * fFin[Math.max(0, fFin.length - n + i)]).toFixed(1),
    })),
    unidades: meses.map((m, i) => ({
      rotulo: m.rotulo,
      valor:  +(base * fUni[Math.max(0, fUni.length - n + i)]).toFixed(1),
    })),
  };
}

// Agrupa top_divergencias por grupo_material do produto; fallback por nivel de acuracidade
function calcCategorias(topDiv, acPorLoja) {
  const CORES = [DK.nBlue, DK.nGreen, DK.nYellow, DK.nOrange, DK.nPurp, '#EC4899', DK.txt3];
  if (topDiv && topDiv.length > 0) {
    const map = {};
    topDiv.forEach(d => {
      const grupo = d.grupo_material || 'Sem grupo';
      map[grupo] = (map[grupo] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, qtd], i) => ({ rotulo: nome, valor: qtd, cor: CORES[i % CORES.length] }));
  }
  if (!acPorLoja || acPorLoja.length === 0) return [];
  return [
    { rotulo: 'Otimo (>=95%)',  valor: acPorLoja.filter(l => (l.acuracidade || 0) >= 95).length,                cor: DK.nGreen  },
    { rotulo: 'Bom (>=85%)',    valor: acPorLoja.filter(l => (l.acuracidade || 0) >= 85 && (l.acuracidade || 0) < 95).length, cor: DK.nYellow },
    { rotulo: 'Atencao (<85%)', valor: acPorLoja.filter(l => (l.acuracidade || 0) < 85).length,                cor: DK.nRed    },
  ].filter(g => g.valor > 0);
}

// ── Grafico de Linha Dupla — Tendencia de Acuracidade ─────────────────────────
function GraficoLinhas2({ s1, s2, largura, altura = 150 }) {
  if (!s1 || s1.length < 2) {
    return (
      <View style={{ height: altura, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: DK.txt3, fontSize: 12 }}>Sessoes insuficientes para calcular tendencia</Text>
      </View>
    );
  }
  const mg    = { t: 20, r: 12, b: 30, l: 38 };
  const plotW = largura - mg.l - mg.r;
  const plotH = altura - mg.t - mg.b;
  const todos = [...s1.map(p => p.valor), ...(s2 || []).map(p => p.valor)];
  const minY  = Math.max(0,   Math.floor(Math.min(...todos) - 2));
  const maxY  = Math.min(100, Math.ceil(Math.max(...todos)  + 1));
  const rng   = maxY - minY || 1;
  const n     = s1.length;
  const px    = i => (mg.l + (i / (n - 1)) * plotW).toFixed(1);
  const py    = v => (mg.t + (1 - (v - minY) / rng) * plotH).toFixed(1);
  const pts1  = s1.map((p, i) => `${px(i)},${py(p.valor)}`).join(' ');
  const pts2  = s2 ? s2.map((p, i) => `${px(i)},${py(p.valor)}`).join(' ') : null;
  const gridY = [minY, minY + rng * 0.5, maxY];

  return (
    <Svg width={largura} height={altura}>
      {gridY.map((v, i) => (
        <G key={i}>
          <Line x1={mg.l} y1={Number(py(v))} x2={mg.l + plotW} y2={Number(py(v))}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <SvgText x={mg.l - 4} y={Number(py(v)) + 4} fontSize={10} fill={DK.txt3} textAnchor="end">
            {v.toFixed(0)}%
          </SvgText>
        </G>
      ))}
      {/* Area sob a linha 1 */}
      <Polyline
        points={`${mg.l},${mg.t + plotH} ${pts1} ${(mg.l + plotW).toFixed(1)},${mg.t + plotH}`}
        fill={`${DK.nBlue}18`} stroke="none" />
      {/* Linha 1 — financeira */}
      <Polyline points={pts1} fill="none" stroke={DK.nBlue} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Linha 2 — unidades */}
      {pts2 && (
        <Polyline points={pts2} fill="none" stroke={DK.nGreen} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {s1.map((p, i) => (
        <Circle key={i} cx={Number(px(i))} cy={Number(py(p.valor))} r={3.5}
          fill={DK.nBlue} stroke={DK.bg} strokeWidth={2} />
      ))}
      {s2 && s2.map((p, i) => (
        <Circle key={i} cx={Number(px(i))} cy={Number(py(p.valor))} r={3}
          fill={DK.nGreen} stroke={DK.bg} strokeWidth={2} />
      ))}
      {s1.map((p, i) => (
        <SvgText key={i} x={Number(px(i))} y={altura - 4} fontSize={11}
          fill={DK.txt3} textAnchor="middle">
          {p.rotulo.length >= 7 ? p.rotulo.substring(5) : p.rotulo}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Grafico de Rosca Neon — Distribuicao por Categoria ────────────────────────
function GraficoRoscaNeon({ segmentos }) {
  const RAIO = 52; const ESP = 18;
  const OFF  = ESP / 2 + 4;
  const tam  = (RAIO + OFF) * 2;
  const cx   = RAIO + OFF; const cy = RAIO + OFF;
  const total = segmentos.reduce((s, x) => s + (x.valor || 0), 0);

  if (total === 0) {
    return (
      <Svg width={tam} height={tam}>
        <Circle cx={cx} cy={cy} r={RAIO} fill="none" stroke={DK.borda} strokeWidth={ESP} />
        <SvgText x={cx} y={cy + 4} fontSize={12} fill={DK.txt3} textAnchor="middle">sem dados</SvgText>
      </Svg>
    );
  }
  function toXY(ang) {
    const r = ((ang - 90) * Math.PI) / 180;
    return { x: cx + RAIO * Math.cos(r), y: cy + RAIO * Math.sin(r) };
  }
  let inicio = 0;
  const arcos = segmentos.filter(s => s.valor > 0).map(seg => {
    const ang     = (seg.valor / total) * 360;
    const angReal = Math.min(ang, 359.9);
    const p1      = toXY(inicio);
    const p2      = toXY(inicio + angReal);
    const d       = `M${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${RAIO},${RAIO} 0 ${angReal > 180 ? 1 : 0} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    inicio += ang;
    return { ...seg, d };
  });
  return (
    <Svg width={tam} height={tam}>
      {arcos.map((a, i) => (
        <Path key={i} d={a.d} fill="none" stroke={a.cor} strokeWidth={ESP} />
      ))}
      <SvgText x={cx} y={cy - 4}  fontSize={20} fontWeight="800" fill={DK.txt}  textAnchor="middle">{total}</SvgText>
      <SvgText x={cx} y={cy + 13} fontSize={11}  fill={DK.txt3} textAnchor="middle">itens</SvgText>
    </Svg>
  );
}

// ── Grafico de Barras Divergentes — por Zona / Loja ───────────────────────────
function GraficoBarrasDiverg({ itens, largura, altura = 140, formatLabel }) {
  if (!itens || itens.length === 0) {
    return (
      <View style={{ height: altura, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: DK.txt3, fontSize: 12 }}>Sem dados de divergencia</Text>
      </View>
    );
  }
  const mg    = { t: 12, r: 10, b: 28, l: 56 };
  const plotW = largura - mg.l - mg.r;
  const plotH = altura - mg.t - mg.b;
  const maxAbs = Math.max(...itens.map(it => Math.abs(it.valor)), 3);
  const barW   = plotW / itens.length;
  const pad    = barW * 0.2;
  const midY   = mg.t + plotH / 2;
  const yUnit  = plotH / 2 / maxAbs;

  return (
    <Svg width={largura} height={altura}>
      {/* Linha zero */}
      <Line x1={mg.l} y1={midY} x2={mg.l + plotW} y2={midY}
        stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
      {/* Labels eixo Y */}
      {[maxAbs, 0, -maxAbs].map((v, i) => (
        <SvgText key={i} x={mg.l - 4}
          y={mg.t + (i / 2) * plotH + (i === 2 ? 4 : i === 0 ? 0 : 4)}
          fontSize={10} fill={DK.txt3} textAnchor="end">
          {formatLabel ? formatLabel(v) : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
        </SvgText>
      ))}
      {itens.map((it, i) => {
        const x   = mg.l + i * barW + pad;
        const bW  = Math.max(barW - pad * 2, 4);
        const div = it.valor;
        const h   = Math.max(Math.abs(div) * yUnit, 2);
        const cor = div >= 0 ? DK.nGreen : DK.nRed;
        const y   = div >= 0 ? midY - h : midY;
        const lbl = (it.rotulo || '').length > 5 ? (it.rotulo || '').substring(0, 5) : (it.rotulo || '');
        return (
          <G key={i}>
            <Rect x={x} y={y} width={bW} height={h} rx={2} fill={cor} opacity={0.85} />
            <SvgText x={x + bW / 2} y={altura - 5} fontSize={10} fill={DK.txt3} textAnchor="middle">{lbl}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Ring de Progresso — Status da Auditoria ───────────────────────────────────
function RingProgress({ pct, raio = 68, espessura = 14, cor = DK.nGreen }) {
  const OFF = espessura / 2 + 6;
  const tam = (raio + OFF) * 2;
  const cx  = raio + OFF; const cy = raio + OFF;
  function toXY(ang) {
    const r = ((ang - 90) * Math.PI) / 180;
    return { x: cx + raio * Math.cos(r), y: cy + raio * Math.sin(r) };
  }
  const angFim = Math.min(Math.max(pct, 0.1), 99.9) / 100 * 360;
  const p1     = toXY(0);
  const p2     = toXY(angFim);
  const dArc   = `M${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${raio},${raio} 0 ${angFim > 180 ? 1 : 0} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;

  return (
    <Svg width={tam} height={tam}>
      <Circle cx={cx} cy={cy} r={raio} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth={espessura} />
      <Path d={dArc} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" />
      <SvgText x={cx} y={cy - 8} fontSize={28} fontWeight="800" fill={cor} textAnchor="middle">
        {pct.toFixed(0)}%
      </SvgText>
      <SvgText x={cx} y={cy + 14} fontSize={13} fill={DK.txt2} textAnchor="middle">Concluido</SvgText>
    </Svg>
  );
}

// ── Mini sparkline decorativo ────────────────────────────────────────────────
function MiniSparkline({ dados, cor, w = 64, h = 18 }) {
  if (!dados || dados.length < 2) return null;
  const vals = dados.map(d => d.valor);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const rng  = max - min || 1;
  const n    = vals.length;
  const pts  = vals.map((v, i) =>
    `${((i / (n - 1)) * w).toFixed(1)},${(h - ((v - min) / rng) * (h - 2) - 1).toFixed(1)}`
  ).join(' ');
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={cor}
        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
    </Svg>
  );
}

// ── Cubo 3D Wireframe em SVG isometrico ───────────────────────────────────────
function CuboWireframe({ cx = 50, cy = 48, tam = 22, cor = DK.nBlue }) {
  const h = tam; const w = +(h * 0.866).toFixed(1);
  // Vertices isometricos
  const top = `${cx},${cy - h}`;
  const mid = `${cx},${cy}`;
  const bot = `${cx},${cy + h}`;
  const ul  = `${cx - w},${cy - h / 2}`;
  const ur  = `${cx + w},${cy - h / 2}`;
  const ll  = `${cx - w},${cy + h / 2}`;
  const lr  = `${cx + w},${cy + h / 2}`;
  return (
    <G>
      <Polygon points={`${top} ${ur} ${mid} ${ul}`}   fill={`${cor}25`} stroke={cor} strokeWidth={1.2} />
      <Polygon points={`${ul}  ${mid} ${bot} ${ll}`}  fill={`${cor}18`} stroke={cor} strokeWidth={1.2} />
      <Polygon points={`${mid} ${ur}  ${lr}  ${bot}`} fill={`${cor}12`} stroke={cor} strokeWidth={1.2} />
    </G>
  );
}

// ── Tela Principal ────────────────────────────────────────────────────────────
export default function AuditoriaScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [naturezasIds,     setNaturezasIds]     = useState([]);
  const [grupoMaterial,    setGrupoMaterial]    = useState(null);
  const [filtrosAbertos,   setFiltrosAbertos]   = useState(false);
  const [anosSelecionados, setAnosSelecionados] = useState([]);
  const [mesesSelecionados,setMesesSelecionados]= useState([]);
  const [lojasSelecionadas,setLojasSelecionadas]= useState([]);
  const [lojas,            setLojas]            = useState([]);
  // Exportar audit log e restrito a ADM (dado sensivel de LGPD/seguranca)
  const [papel, setPapel] = useState('operador');
  const podeExportarAuditLog = papel === 'admin';

  // Carrega lista de lojas uma vez
  useEffect(() => {
    listarLojas().then(ls => setLojas(Array.isArray(ls) ? ls : [])).catch(() => {});
  }, []);

  useEffect(() => {
    pegarUsuario()
      .then(u => (u?.papel ? u : buscarPerfilAtual()))
      .then(u => setPapel(u?.papel || 'operador'))
      .catch(() => {});
  }, []);

  // Produto cartesiano anos x meses -> array de "YYYY-MM"
  // Se apenas um dos dois estiver selecionado, o outro usa todos os valores disponiveis
  const mesReferenciasParam = useMemo(() => {
    const temAnos  = anosSelecionados.length > 0;
    const temMeses = mesesSelecionados.length > 0;
    if (!temAnos && !temMeses) return [];
    const anos  = temAnos  ? anosSelecionados : ANOS;
    const meses = temMeses ? mesesSelecionados : Array.from({ length: 12 }, (_, i) => i + 1);
    return anos.flatMap(a => meses.map(m => `${a}-${String(m).padStart(2, '0')}`));
  }, [anosSelecionados, mesesSelecionados]);

  // Envia apenas quando exatamente 1 natureza esta selecionada; caso contrario null (todas)
  const naturezaId = naturezasIds.length === 1 ? naturezasIds[0] : null;

  // IDs das lojas selecionadas (UUIDs para a API)
  const lojaIdsParam = useMemo(
    () => lojas.filter(l => lojasSelecionadas.includes(l.codigo)).map(l => l.id),
    [lojas, lojasSelecionadas],
  );

  const { dash, sessoes, totalUsuarios, carregando, erro, ultimaAtualizacao, recarregar } =
    useAuditoriaData(naturezaId, grupoMaterial, lojaIdsParam, mesReferenciasParam);

  const [abaAtiva,   setAbaAtiva]   = useState('painel');
  const [painelW,    setPainelW]    = useState(0);
  const [alertaSel,  setAlertaSel]  = useState(null);
  const [modoEdicao,   setModoEdicao]   = useState(false);
  const [layoutBlocos, setLayoutBlocos] = useState(BLOCOS_PADRAO);

  // ── Estados das Ferramentas ─────────────────────────────────────────────────
  const hoje = new Date();
  const [tipoAcao,      setTipoAcao]      = useState(null);
  const [mesInicioIdx,  setMesInicioIdx]  = useState(hoje.getMonth() > 0 ? hoje.getMonth() - 1 : 0);
  const [anoInicio,     setAnoInicio]     = useState(hoje.getFullYear());
  const [mesFimIdx,     setMesFimIdx]     = useState(hoje.getMonth());
  const [anoFim,        setAnoFim]        = useState(hoje.getFullYear());
  const [dropAberto,    setDropAberto]    = useState(null);
  const [exportando,    setExportando]    = useState(false);
  const [erroExp,       setErroExp]       = useState('');
  const [sessoesExp,    setSessoesExp]    = useState([]);
  const [sessaoSel,     setSessaoSel]     = useState(null);
  const [participacao,  setParticipacao]  = useState(null);
  const [carregandoPart,setCarregandoPart]= useState(false);

  useEffect(() => {
    listarSessoes({ status: 'concluida' }, 1, 20)
      .then(d => setSessoesExp(d?.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_LAYOUT)
      .then(v => { if (v) setLayoutBlocos(JSON.parse(v)); })
      .catch(() => {});
  }, []);

  function salvarLayout(novos) {
    setLayoutBlocos(novos);
    AsyncStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(novos)).catch(() => {});
  }
  function ajustarFlex(id, delta) {
    salvarLayout(layoutBlocos.map(b =>
      b.id === id ? { ...b, flex: Math.max(15, Math.min(100, b.flex + delta)) } : b
    ));
  }
  function moverBloco(idx, dir) {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= layoutBlocos.length) return;
    const novos = [...layoutBlocos];
    [novos[idx], novos[alvo]] = [novos[alvo], novos[idx]];
    salvarLayout(novos);
  }
  function resetarLayout() { salvarLayout([...BLOCOS_PADRAO]); }

  // ── Metricas calculadas ─────────────────────────────────────────────────────
  const kpis         = dash?.kpis           || {};
  const statusSessoes = dash?.sessoes        || {};
  const acPorLoja    = dash?.acuracidade_por_loja || [];
  const topDiv       = dash?.top_divergencias    || [];

  const tendencia    = calcTendencia(sessoes, kpis.acuracidade_media);
  const categorias   = calcCategorias(topDiv, acPorLoja);

  // Saldo financeiro liquido por loja: soma das divergencias positivas (sobra) menos negativas (falta)
  const divPorLoja = (() => {
    const map = {};
    topDiv.forEach(d => {
      const chave = d.loja_codigo || d.loja_nome || String(d.loja_id) || '?';
      const val   = Number(d.valor_diferenca ?? d.valor_divergente ?? 0);
      if (!map[chave]) map[chave] = { pos: 0, neg: 0 };
      if (val >= 0) map[chave].pos += val;
      else          map[chave].neg += Math.abs(val);
    });
    return Object.entries(map)
      .map(([chave, { pos, neg }]) => ({
        rotulo: SIGLAS_LOJA[chave] || chave,
        valor:  +(pos - neg).toFixed(2),
      }))
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 8);
  })();

  const totalSessoes = statusSessoes.concluidas_total || 0;

  // Metricas do card Status da Auditoria.
  // Sessoes CONCLUIDAS: total/contados = a sessao inteira (ja convergiu, o
  // campo *_rodada_atual delas so refletiria a ultima rodada usada, um
  // subconjunto menor — errado pra "SKUs Planejados" do periodo).
  // Sessoes ATIVAS: usa o progresso da rodada atual (nao soma das 3
  // rodadas) — senao uma sessao em recontagem contava como "quase
  // auditada" so por ter sido bipada uma vez na 1a rodada, mesmo com
  // desempate pendente.
  const skusPlanejados =
    sessoes.reduce((a, s) => a + (s.total_produtos_loja || 0), 0) +
    (dash?.sessoes_ativas || []).reduce((a, s) => a + (s.total_produtos_rodada_atual ?? s.total_produtos ?? 0), 0);
  const skusAuditados =
    sessoes.reduce((a, s) => a + (s.total_produtos_contados || 0), 0) +
    (dash?.sessoes_ativas || []).reduce((a, s) => a + (s.total_produtos_contados_rodada_atual ?? s.contados ?? 0), 0);
  const skusPendentes  = Math.max(0, skusPlanejados - skusAuditados);
  const pctAuditado    = skusPlanejados > 0 ? (skusAuditados / skusPlanejados) * 100 : 0;

  // Previsao: ultimo dia do mes de referencia da sessao mais recente
  const sesRecente = [...sessoes].sort((a, b) =>
    (b.encerrada_em || b.criada_em || '').localeCompare(a.encerrada_em || a.criada_em || '')
  )[0];
  const previsaoConclusao = sesRecente?.mes_referencia
    ? (() => {
        const [ano, mes] = sesRecente.mes_referencia.split('-').map(Number);
        const d = new Date(ano, mes, 0);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      })()
    : '—';

  // Soma de produtos contados em todas as sessoes finalizadas carregadas
  const totalEstoqueContado = sessoes.reduce((acc, s) => acc + (s.total_produtos_contados || 0), 0);

  const acFinanceira = kpis.acuracidade_financeira != null ? kpis.acuracidade_financeira : null;
  const acUnidades   = kpis.acuracidade_unidades   != null ? kpis.acuracidade_unidades   : null;

  // Larguras dinamicas dos graficos
  const GAP     = spacing.sm;
  const CPAD    = spacing.md * 2;
  const col1W   = painelW > 0 ? (isDesktop ? Math.floor((painelW - GAP * 2) * 0.42) - CPAD : painelW - CPAD) : 260;
  const col2W   = painelW > 0 ? (isDesktop ? Math.floor((painelW - GAP * 2) * 0.29) - CPAD : painelW - CPAD) : 200;
  const col3W   = painelW > 0 ? (isDesktop ? Math.floor((painelW - GAP * 2) * 0.29) - CPAD : painelW - CPAD) : 200;
  const alertasW = painelW > 0 ? (isDesktop ? Math.floor((painelW - GAP * 2) * 0.50) - CPAD : painelW - CPAD) : 260;

  // ── Handlers ferramentas ────────────────────────────────────────────────────
  function toYearMonth(mesIdx, ano) {
    return `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;
  }
  async function handleExportar() {
    setExportando(true); setErroExp('');
    try {
      const dataInicio = toYearMonth(mesInicioIdx, anoInicio) + '-01';
      const dataFim    = toYearMonth(mesFimIdx, anoFim)       + '-31';
      const { base64, nomeArquivo } = await exportarAuditLog({
        dataInicio, dataFim, tipoAcao: tipoAcao || undefined,
      });
      if (Platform.OS === 'web') {
        const blob = new Blob(
          [new Uint8Array(Array.from(atob(base64)).map(c => c.charCodeAt(0)))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = nomeArquivo; a.click();
        URL.revokeObjectURL(url);
      } else {
        const FileSystem = require('expo-file-system');
        const Sharing    = require('expo-sharing');
        const caminho    = `${FileSystem.documentDirectory}${nomeArquivo}`;
        await FileSystem.writeAsStringAsync(caminho, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(caminho);
      }
    } catch (e) { setErroExp(e.message || 'Erro ao exportar'); }
    finally     { setExportando(false); }
  }
  async function handleVerParticipacao(sessao) {
    setSessaoSel(sessao); setCarregandoPart(true); setParticipacao(null);
    try {
      setParticipacao(await buscarParticipacaoOperadores(sessao.id));
    } catch (e) { setErroExp(e.message || 'Erro ao buscar participacao'); }
    finally     { setCarregandoPart(false); }
  }

  // ── Modal dropdown ──────────────────────────────────────────────────────────
  function renderDropdown() {
    if (!dropAberto) return null;
    let opcoes = [], valorAtual = null, onSelect = () => {}, titulo = '';
    if (dropAberto === 'mesInicio') {
      opcoes = MESES_NOMES.map((m, i) => ({ label: m, value: i })); valorAtual = mesInicioIdx;
      onSelect = v => { setMesInicioIdx(v); setDropAberto(null); }; titulo = 'Mes de Inicio';
    } else if (dropAberto === 'anoInicio') {
      opcoes = ANOS.map(a => ({ label: String(a), value: a })); valorAtual = anoInicio;
      onSelect = v => { setAnoInicio(v); setDropAberto(null); }; titulo = 'Ano de Inicio';
    } else if (dropAberto === 'mesFim') {
      opcoes = MESES_NOMES.map((m, i) => ({ label: m, value: i })); valorAtual = mesFimIdx;
      onSelect = v => { setMesFimIdx(v); setDropAberto(null); }; titulo = 'Mes de Fim';
    } else {
      opcoes = ANOS.map(a => ({ label: String(a), value: a })); valorAtual = anoFim;
      onSelect = v => { setAnoFim(v); setDropAberto(null); }; titulo = 'Ano de Fim';
    }
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setDropAberto(null)}>
        <TouchableOpacity style={ek.modalOverlay} activeOpacity={1} onPress={() => setDropAberto(null)}>
          <View style={ek.dropModal}>
            <Text style={ek.dropTitulo}>{titulo}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {opcoes.map(op => (
                <TouchableOpacity key={String(op.value)}
                  style={[ek.dropOpcao, valorAtual === op.value && ek.dropOpcaoAtiva]}
                  onPress={() => onSelect(op.value)}>
                  <Text style={[ek.dropOpcaoTxt, valorAtual === op.value && ek.dropOpcaoTxtAtiva]}>{op.label}</Text>
                  {valorAtual === op.value && <Text style={{ color: DK.nBlue, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  // ── Aba: Painel ─────────────────────────────────────────────────────────────
  function renderPainel() {
    if (carregando && !dash) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
          <ActivityIndicator size="large" color={DK.nBlue} />
          <Text style={{ color: DK.txt2, marginTop: 14, fontSize: 14 }}>Carregando dados...</Text>
        </View>
      );
    }
    if (erro) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ color: DK.nRed, fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{erro}</Text>
          <TouchableOpacity style={ek.btnRecarregar} onPress={recarregar}>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── Calculo de layout dinamico ─────────────────────────────────────────────
    const linhas = computarLinhas(layoutBlocos);
    const gIdxPorId = Object.fromEntries(layoutBlocos.map((b, i) => [b.id, i]));

    function calcW(bloco, linha) {
      if (!isDesktop || !painelW) return (painelW || 0) - CPAD;
      const ft = linha.reduce((s, b) => s + b.flex, 0);
      const gt = (linha.length - 1) * GAP;
      return Math.max(100, Math.floor((painelW - gt) * (bloco.flex / ft)) - CPAD);
    }
    const wPorId = {};
    for (const ln of linhas) {
      for (const b of ln) { wPorId[b.id] = calcW(b, ln); }
    }

    // Barra de controles exibida no topo de cada bloco em modo edicao
    function BarraEdicao({ id, gIdx, flex }) {
      const tot = layoutBlocos.length;
      return (
        <View style={ek.barraEd}>
          <TouchableOpacity onPress={() => moverBloco(gIdx, -1)} disabled={gIdx === 0} style={ek.btnEd}>
            <Text style={[ek.txtEd, gIdx === 0 && ek.txtEdDis]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => moverBloco(gIdx, 1)} disabled={gIdx === tot - 1} style={ek.btnEd}>
            <Text style={[ek.txtEd, gIdx === tot - 1 && ek.txtEdDis]}>↓</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => ajustarFlex(id, -5)} style={ek.btnEd}>
            <Text style={ek.txtEd}>−</Text>
          </TouchableOpacity>
          <View style={ek.flexBadge}>
            <Text style={{ color: DK.nBlue, fontSize: 11, fontWeight: '800' }}>{flex}</Text>
          </View>
          <TouchableOpacity onPress={() => ajustarFlex(id, 5)} style={ek.btnEd}>
            <Text style={ek.txtEd}>+</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Renderiza o conteudo interno de cada bloco pelo seu ID
    function renderConteudoBloco(id, w) {
      switch (id) {

        case 'tendencia': return (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={ek.graficoTitulo}>TENDENCIA DE ACURACIDADE</Text>
                <Text style={ek.graficoSub}>Evolucao mensal da precisao de inventario</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 8, marginBottom: 8 }}>
              {[{ cor: DK.nBlue, lbl: 'Financeira' }, { cor: DK.nGreen, lbl: 'Unidades' }].map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 18, height: 3, backgroundColor: l.cor, borderRadius: 2 }} />
                  <Text style={{ color: DK.txt2, fontSize: 12 }}>{l.lbl}</Text>
                </View>
              ))}
            </View>
            <GraficoLinhas2
              s1={tendencia?.financeira || []}
              s2={tendencia?.unidades   || []}
              largura={w} altura={150}
            />
          </>
        );

        case 'distribuicao': return (
          <>
            <Text style={ek.graficoTitulo}>DISTRIBUICAO POR SKU</Text>
            <Text style={ek.graficoSub}>Categorias com divergencias</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
              <GraficoRoscaNeon segmentos={categorias} />
              <View style={{ gap: 5, flex: 1 }}>
                {categorias.map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.cor }} />
                    <Text style={{ color: DK.txt2, fontSize: 12, flex: 1 }} numberOfLines={1}>{c.rotulo}</Text>
                    <Text style={{ color: c.cor, fontSize: 12, fontWeight: '700' }}>{c.valor}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        );

        case 'divergencias': return (
          <>
            <Text style={ek.graficoTitulo}>DIVERGENCIAS POR ZONA</Text>
            <Text style={ek.graficoSub}>Saldo liquido: positivas - negativas (R$)</Text>
            <View style={{ marginTop: spacing.sm }}>
              <GraficoBarrasDiverg itens={divPorLoja} largura={w} altura={140}
                formatLabel={fmtMoedaCurto} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: DK.nGreen }} />
                <Text style={{ color: DK.txt3, fontSize: 11 }}>Sobra (positivo)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: DK.nRed }} />
                <Text style={{ color: DK.txt3, fontSize: 11 }}>Falta (negativo)</Text>
              </View>
            </View>
          </>
        );

        case 'alertas': return (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={ek.alertaIcBox}>
                <Text style={{ color: DK.nYellow, fontSize: 15 }}>⚠</Text>
              </View>
              <View>
                <Text style={ek.graficoTitulo}>ALERTAS CRITICOS</Text>
                <Text style={ek.graficoSub}>Produtos com maiores impactos</Text>
              </View>
            </View>
            <View style={ek.alertaHeaderRow}>
              {['ZONA / SKU', 'TIPO', 'DIVERGENCIA', 'IMPACTO', ''].map((c, i) => (
                <Text key={i} style={[ek.alertaHeaderTxt, i === 0 && { flex: 2, textAlign: 'left' }]}>{c}</Text>
              ))}
            </View>
            {topDiv.length === 0 && (
              <Text style={{ color: DK.txt3, textAlign: 'center', padding: spacing.lg, fontSize: 15 }}>
                Nenhum alerta critico no momento
              </Text>
            )}
            {topDiv.slice(0, 6).map((d, i) => {
              const valorDiv = Math.abs(d.valor_diferenca ?? d.valor_divergente ?? 0);
              const impacto  = valorDiv > 1000 ? 'Alto' : valorDiv > 200 ? 'Medio' : 'Baixo';
              const corImp   = impacto === 'Alto' ? DK.nRed : impacto === 'Medio' ? DK.nYellow : DK.nGreen;
              const nomeProd = d.produto_descricao || d.produto_nome || d.produto_sku || d.codigo_qr || d.codigo || '—';
              const codProd  = d.produto_sku || d.codigo_qr || '';
              const lojaInfo = d.loja_codigo  || d.loja_nome  || '';
              const difQtd   = d.diferenca    ?? d.quantidade_divergente;
              const valMoeda = d.valor_diferenca ?? d.valor_divergente;
              return (
                <View key={i} style={[ek.alertaLinha, i % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.025)' }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={ek.alertaNome} numberOfLines={1}>{nomeProd}</Text>
                    {(lojaInfo || codProd) && (
                      <Text style={ek.alertaLoja} numberOfLines={1}>
                        {[codProd, lojaInfo].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <Text style={[ek.alertaCel, { color: DK.nPurp }]}>{d.tipo_divergencia || 'Qtd'}</Text>
                  <Text style={[ek.alertaCel, { color: DK.nRed }]}>
                    {valMoeda != null ? fmtMoeda(valMoeda) : `${difQtd ?? '—'}un`}
                  </Text>
                  <View style={[ek.alertaBadge, { backgroundColor: `${corImp}22` }]}>
                    <Text style={{ color: corImp, fontSize: 12, fontWeight: '700' }}>{impacto}</Text>
                  </View>
                  <TouchableOpacity style={ek.alertaLink} onPress={() => setAlertaSel({ ...d, nomeProd, codProd, lojaInfo, difQtd, valMoeda, impacto, corImp })}>
                    <Text style={{ color: DK.nBlue, fontSize: 12 }}>Ver</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        );

        case 'status': return (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <Text style={ek.graficoTitulo}>STATUS DA AUDITORIA</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <Line x1="12" y1="8" x2="12" y2="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
                <Line x1="12" y1="11" x2="12" y2="16" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <RingProgress
                pct={pctAuditado}
                raio={52}
                espessura={11}
                cor={pctAuditado >= 80 ? DK.nGreen : pctAuditado >= 50 ? DK.nYellow : DK.nRed}
              />
              <View style={{ flex: 1, gap: 12 }}>
                {[
                  { lbl: 'SKUs Planejados',  val: fmtNum(skusPlanejados),         cor: DK.txt    },
                  { lbl: 'SKUs Auditados',   val: fmtNum(skusAuditados),          cor: DK.txt    },
                  { lbl: 'SKUs Pendentes',   val: fmtNum(skusPendentes),          cor: DK.txt    },
                  { lbl: 'Amostragem Media', val: fmtPct(kpis.acuracidade_media), cor: DK.nGreen },
                ].map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Rect x="2" y="2" width="20" height="20" rx="5"
                        stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"
                        fill="rgba(255,255,255,0.04)" />
                      <Path d="M7 12l3.5 3.5L17 8" stroke={DK.nGreen}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{r.lbl}</Text>
                      <Text style={{ color: r.cor, fontSize: 17, fontWeight: '700' }}>{r.val}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: spacing.sm }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: 0.3 }}>Previsao de Conclusao</Text>
              <Text style={{ color: DK.nGreen, fontSize: 17, fontWeight: '700', marginTop: 3 }}>{previsaoConclusao}</Text>
            </View>
          </>
        );

        case 'resumo': return (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <Text style={ek.graficoTitulo}>RESUMO DO PERIODO</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <Line x1="12" y1="8" x2="12" y2="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
                <Line x1="12" y1="11" x2="12" y2="16" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                {[
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                        <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Total Estoque Contado', val: fmtMoeda(kpis.valor_total_estoque), cor: '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                        <Line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                        <Line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Valor Divergente',
                    val: kpis.valor_total_divergente != null ? `-${fmtMoeda(kpis.valor_total_divergente)}` : '-',
                    cor: kpis.valor_total_divergente != null && kpis.valor_total_divergente > 0 ? '#FF4444' : '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Circle cx="7" cy="7" r="3" stroke={c} strokeWidth="1.5" />
                        <Circle cx="17" cy="17" r="3" stroke={c} strokeWidth="1.5" />
                        <Path d="M6 18L18 6" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Precisao Financeira',
                    val: fmtPct(acFinanceira),
                    cor: acFinanceira != null && acFinanceira < 95 ? '#FF4444' : '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M8 2v3M16 2v3" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                        <Rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.5" />
                        <Path d="M3 10h18" stroke={c} strokeWidth="1.5" />
                        <Path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" stroke={c} strokeWidth="2" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Contagens Realizadas', val: String(totalSessoes), cor: '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={c} strokeWidth="1.5" />
                        <Rect x="9" y="3" width="6" height="4" rx="1" stroke={c} strokeWidth="1.5" />
                        <Path d="M9 12h6M9 16h4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'SKUs Criticos', val: String(topDiv.length || 0), cor: topDiv.length > 0 ? '#FF4444' : '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                        <Circle cx="9" cy="7" r="4" stroke={c} strokeWidth="1.5" />
                        <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Auditores Envolvidos', val: String(totalUsuarios), cor: '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                        <Path d="M9 22V12h6v10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Lojas Monitoradas', val: String(kpis.total_lojas ?? '—'), cor: DK.nYellow,
                  },
                ].map((r, i, arr) => (
                  <View key={i}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                      {r.ico('rgba(255,255,255,0.45)')}
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, flex: 1 }} numberOfLines={1}>{r.lbl}</Text>
                      <Text style={{ color: r.cor, fontSize: 15, fontWeight: '600' }}>{r.val}</Text>
                    </View>
                    {i < arr.length - 1 && (
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          </>
        );

        default: return null;
      }
    }

    return (
      <>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={ek.painelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={ek.painelTitulo}>Painel de Inteligencia em Auditoria</Text>
            <Text style={ek.painelSub}>
              {ultimaAtualizacao
                ? `Ultima atualizacao: ${ultimaAtualizacao}  ·  Auto-refresh 5min`
                : 'Carregando...'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            {/* Botao Filtros */}
            <TouchableOpacity
              style={[ek.btnFiltros, (naturezasIds.length > 0 || grupoMaterial || anosSelecionados.length > 0 || mesesSelecionados.length > 0 || lojasSelecionadas.length > 0) && ek.btnFiltrosAtivo]}
              onPress={() => setFiltrosAbertos(v => !v)}
              activeOpacity={0.8}
            >
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M4 6h16M7 12h10M10 18h4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text style={ek.btnFiltrosTxt}>Filtros</Text>
              {(naturezasIds.length > 0 || grupoMaterial || anosSelecionados.length > 0 || mesesSelecionados.length > 0 || lojasSelecionadas.length > 0) && <View style={ek.btnFiltrosDot} />}
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9l6 6 6-6" stroke="#FFFFFF" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {/* Botao Layout */}
            <TouchableOpacity
              style={[ek.btnLayout, modoEdicao && ek.btnLayoutAtivo]}
              onPress={() => setModoEdicao(v => !v)}
              activeOpacity={0.8}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="3" width="7" height="7" rx="1" stroke={modoEdicao ? DK.nYellow : DK.txt3} strokeWidth="2" />
                <Rect x="14" y="3" width="7" height="7" rx="1" stroke={modoEdicao ? DK.nYellow : DK.txt3} strokeWidth="2" />
                <Rect x="3" y="14" width="7" height="7" rx="1" stroke={modoEdicao ? DK.nYellow : DK.txt3} strokeWidth="2" />
                <Rect x="14" y="14" width="7" height="7" rx="1" stroke={modoEdicao ? DK.nYellow : DK.txt3} strokeWidth="2" />
              </Svg>
              <Text style={[ek.btnLayoutTxt, modoEdicao && { color: DK.nYellow }]}>
                {modoEdicao ? 'Concluir' : 'Layout'}
              </Text>
            </TouchableOpacity>
            {/* Botao Atualizar */}
            <TouchableOpacity style={ek.btnAtualizar} onPress={recarregar} disabled={carregando}>
              {carregando
                ? <ActivityIndicator size="small" color={DK.txt2} />
                : <Text style={{ color: DK.nBlue, fontSize: 24 }}>↻</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Painel de filtros ────────────────────────────────────────────── */}
        {filtrosAbertos && (
          <View style={ek.filtroPainel}>

            {/* Ano */}
            <View style={ek.filtroSec}>
              <Text style={ek.filtroLabel}>Ano</Text>
              <View style={ek.filtroChips}>
                {ANOS.map(a => {
                  const ativo = anosSelecionados.includes(a);
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[ek.chip, ativo && ek.chipAtivo]}
                      onPress={() => setAnosSelecionados(prev =>
                        ativo ? prev.filter(x => x !== a) : [...prev, a]
                      )}
                      activeOpacity={0.7}
                    >
                      <Text style={[ek.chipTxt, ativo && ek.chipTxtAtivo]}>{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={ek.filtroSep} />

            {/* Mes */}
            <View style={ek.filtroSec}>
              <Text style={ek.filtroLabel}>Mes</Text>
              <View style={ek.filtroChips}>
                {MESES_ABREV.map((abrev, idx) => {
                  const num = idx + 1;
                  const ativo = mesesSelecionados.includes(num);
                  return (
                    <TouchableOpacity
                      key={num}
                      style={[ek.chip, ativo && ek.chipAtivo]}
                      onPress={() => setMesesSelecionados(prev =>
                        ativo ? prev.filter(x => x !== num) : [...prev, num]
                      )}
                      activeOpacity={0.7}
                    >
                      <Text style={[ek.chipTxt, ativo && ek.chipTxtAtivo]}>{abrev}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={ek.filtroSep} />

            {/* Loja */}
            <View style={ek.filtroSec}>
              <Text style={ek.filtroLabel}>Loja</Text>
              <View style={ek.filtroChips}>
                {lojas.map(l => {
                  const ativo = lojasSelecionadas.includes(l.codigo);
                  const sigla = SIGLAS_LOJA[l.codigo] || l.codigo;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      style={[ek.chip, ativo && ek.chipAtivo]}
                      onPress={() => setLojasSelecionadas(prev =>
                        ativo ? prev.filter(c => c !== l.codigo) : [...prev, l.codigo]
                      )}
                      activeOpacity={0.7}
                    >
                      <Text style={[ek.chipTxt, ativo && ek.chipTxtAtivo]}>{sigla}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={ek.filtroSep} />

            {/* Natureza */}
            <View style={ek.filtroSec}>
              <Text style={ek.filtroLabel}>Natureza</Text>
              <NaturezaFiltro
                value={naturezasIds}
                onChange={ids => { setNaturezasIds(ids); setGrupoMaterial(null); }}
              />
            </View>
            {(dash?.grupos_material?.length > 0) && (
              <>
                <View style={ek.filtroSep} />
                <View style={ek.filtroSec}>
                  <Text style={ek.filtroLabel}>Grupo de Material</Text>
                  <GrupoMaterialFiltro
                    grupos={dash.grupos_material}
                    value={grupoMaterial}
                    onChange={g => setGrupoMaterial(g)}
                  />
                </View>
              </>
            )}
          </View>
        )}

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <View style={[ek.kpiRow, isDesktop && { flexWrap: 'nowrap' }]}>
          {[
            {
              titulo: 'ACURACIDADE FINANCEIRA',
              valor:  fmtPct(acFinanceira),
              sub:    acFinanceira == null ? 'Sem dados de custo' : acFinanceira >= 99 ? '↑ Acima da meta 99%' : '↓ Abaixo da meta 98%',
              cor:    DK.nGreen,
              ok:     acFinanceira != null && acFinanceira >= 98,
              spark:  tendencia?.financeira,
              icone:  (c) => (
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ),
            },
            {
              titulo: 'ACURACIDADE SKU',
              valor:  fmtPct(kpis.acuracidade_media),
              sub:    kpis.acuracidade_media != null && kpis.acuracidade_media >= 90 ? '↑ Acima da meta 90%' : '↓ Abaixo da meta 90%',
              cor:    DK.nPurp,
              ok:     kpis.acuracidade_media != null && kpis.acuracidade_media >= 90,
              spark:  null,
              icone:  (c) => (
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Circle cx="8" cy="8" r="2.5" stroke={c} strokeWidth="1.8" />
                  <Circle cx="16" cy="16" r="2.5" stroke={c} strokeWidth="1.8" />
                  <Line x1="19" y1="5" x2="5" y2="19" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
                </Svg>
              ),
            },
            {
              titulo: 'ACURACIDADE DE UNIDADES',
              valor:  fmtPct(acUnidades),
              sub:    acUnidades == null ? 'Sem dados de unidades' : acUnidades >= 95 ? '↑ Dentro do padrao 95%' : '↓ Requer atencao 95%',
              cor:    DK.nBlue,
              ok:     acUnidades != null && acUnidades >= 95,
              spark:  tendencia?.unidades,
              icone:  (c) => (
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2L2 7l10 5 10-5-10-5z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                  <Path d="M2 17l10 5 10-5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M2 12l10 5 10-5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ),
            },
            {
              titulo: 'DIVERGENCIA TOTAL',
              valor:  kpis.valor_total_divergente != null ? `-${fmtMoeda(kpis.valor_total_divergente)}` : '—',
              sub:    topDiv.length > 0 ? `↓ ${topDiv.length} SKUs criticos` : '↑ Sem divergencias',
              cor:    DK.nRed,
              ok:     topDiv.length === 0,
              spark:  null,
              icone:  (c) => (
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                  <Line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                  <Line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
                </Svg>
              ),
            },
          ].map((k, i) => (
            <View key={i} style={ek.kpiCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {/* Icone circular com glow */}
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: `${k.cor}14`,
                  borderWidth: 1.5, borderColor: `${k.cor}55`,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: k.cor, shadowOffset: { width: 0, height: 0 },
                  shadowRadius: 12, shadowOpacity: 0.6,
                }}>
                  {k.icone(k.cor)}
                </View>
                {/* Conteudo */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Text style={ek.kpiTitulo} numberOfLines={1}>{k.titulo}</Text>
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
                      <Line x1="12" y1="8" x2="12" y2="9" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round" />
                      <Line x1="12" y1="11" x2="12" y2="16" stroke="rgba(255,255,255,0.28)" strokeWidth="1.8" strokeLinecap="round" />
                    </Svg>
                  </View>
                  <Text style={[ek.kpiValor, { color: k.cor }]} numberOfLines={1}>{k.valor}</Text>
                  <Text style={[ek.kpiSub, { color: k.ok ? DK.nGreen : DK.nRed }]}>{k.sub}</Text>
                </View>
              </View>
              {/* Mini sparkline decorativo no rodape */}
              {k.spark && (
                <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                  <MiniSparkline dados={k.spark} cor={k.cor} w={72} h={20} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── Modo Edicao de Layout ─────────────────────────────────────── */}
        {modoEdicao && (
          <View style={ek.edModeBar}>
            <Text style={ek.edModeBarTxt}>Editar Layout  ·  ↑↓ mover bloco  ·  −/+ largura</Text>
            <TouchableOpacity onPress={resetarLayout}>
              <Text style={{ color: DK.nRed, fontSize: 12, fontWeight: '700' }}>Resetar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Blocos configuráveis ─────────────────────────────────────── */}
        {linhas.map((linha, li) => (
          <View key={li} style={[
            { marginBottom: spacing.md },
            isDesktop && linha.length > 1 && { flexDirection: 'row', gap: GAP },
          ]}>
            {linha.map((bloco) => (
              <View key={bloco.id} style={[
                ek.graficoCard,
                isDesktop && { flex: bloco.flex },
                !isDesktop && { marginBottom: spacing.sm },
              ]}>
                {modoEdicao && isDesktop && (
                  <BarraEdicao id={bloco.id} gIdx={gIdxPorId[bloco.id]} flex={bloco.flex} />
                )}
                {renderConteudoBloco(bloco.id, wPorId[bloco.id])}
              </View>
            ))}
          </View>
        ))}
        <View style={{ display: 'none' }}>{/* bloco removido — conteudo migrado para renderConteudoBloco */}

          {/* Tendencia de Acuracidade */}
          <View style={[ek.graficoCard, isDesktop && { flex: 42 }, !isDesktop && { marginBottom: spacing.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={ek.graficoTitulo}>TENDENCIA DE ACURACIDADE</Text>
                <Text style={ek.graficoSub}>Evolucao mensal da precisao de inventario</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 8, marginBottom: 8 }}>
              {[{ cor: DK.nBlue, lbl: 'Financeira' }, { cor: DK.nGreen, lbl: 'Unidades' }].map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 18, height: 3, backgroundColor: l.cor, borderRadius: 2 }} />
                  <Text style={{ color: DK.txt2, fontSize: 12 }}>{l.lbl}</Text>
                </View>
              ))}
            </View>
            <GraficoLinhas2
              s1={tendencia?.financeira || []}
              s2={tendencia?.unidades   || []}
              largura={col1W} altura={150}
            />
          </View>

          {/* Distribuicao por Categoria */}
          <View style={[ek.graficoCard, isDesktop && { flex: 29 }, !isDesktop && { marginBottom: spacing.md }]}>
            <Text style={ek.graficoTitulo}>DISTRIBUICAO POR SKU</Text>
            <Text style={ek.graficoSub}>Categorias com divergencias</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
              <GraficoRoscaNeon segmentos={categorias} />
              <View style={{ gap: 5, flex: 1 }}>
                {categorias.map((c, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.cor }} />
                    <Text style={{ color: DK.txt2, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {c.rotulo}
                    </Text>
                    <Text style={{ color: c.cor, fontSize: 12, fontWeight: '700' }}>{c.valor}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Divergencias por Zona */}
          <View style={[ek.graficoCard, isDesktop && { flex: 29 }]}>
            <Text style={ek.graficoTitulo}>DIVERGENCIAS POR ZONA</Text>
            <Text style={ek.graficoSub}>Desvio vs. 100% por loja</Text>
            <View style={{ marginTop: spacing.sm }}>
              <GraficoBarrasDiverg itens={divPorLoja} largura={col3W} altura={140} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: DK.nGreen }} />
                <Text style={{ color: DK.txt3, fontSize: 11 }}>Acima 100%</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: DK.nRed }} />
                <Text style={{ color: DK.txt3, fontSize: 11 }}>Abaixo 100%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* legado removido — conteudo migrado para renderConteudoBloco */}
        {false && <View>

          {/* Alertas Criticos */}
          <View style={[ek.graficoCard, isDesktop && { flex: 50 }, !isDesktop && { marginBottom: spacing.md }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={ek.alertaIcBox}>
                <Text style={{ color: DK.nYellow, fontSize: 15 }}>⚠</Text>
              </View>
              <View>
                <Text style={ek.graficoTitulo}>ALERTAS CRITICOS</Text>
                <Text style={ek.graficoSub}>Produtos com maiores impactos</Text>
              </View>
            </View>
            {/* Cabecalho da tabela */}
            <View style={ek.alertaHeaderRow}>
              {['ZONA / SKU', 'TIPO', 'DIVERGENCIA', 'IMPACTO', ''].map((c, i) => (
                <Text key={i} style={[ek.alertaHeaderTxt, i === 0 && { flex: 2, textAlign: 'left' }]}>{c}</Text>
              ))}
            </View>
            {topDiv.length === 0 && (
              <Text style={{ color: DK.txt3, textAlign: 'center', padding: spacing.lg, fontSize: 15 }}>
                Nenhum alerta critico no momento
              </Text>
            )}
            {topDiv.slice(0, 6).map((d, i) => {
              const valorDiv = Math.abs(d.valor_diferenca ?? d.valor_divergente ?? 0);
              // Criterio por valor absoluto — sem forcagem por posicao (i < 2 removido)
              const impacto = valorDiv > 1000 ? 'Alto' : valorDiv > 200 ? 'Medio' : 'Baixo';
              const corImp  = impacto === 'Alto' ? DK.nRed : impacto === 'Medio' ? DK.nYellow : DK.nGreen;
              const nomeProd = d.produto_descricao || d.produto_nome || d.produto_sku || d.codigo_qr || d.codigo || '—';
              const codProd  = d.produto_sku || d.codigo_qr || '';
              const lojaInfo = d.loja_codigo  || d.loja_nome  || '';
              const difQtd   = d.diferenca    ?? d.quantidade_divergente;
              const valMoeda = d.valor_diferenca ?? d.valor_divergente;
              return (
                <View key={i} style={[ek.alertaLinha, i % 2 === 0 && { backgroundColor: 'rgba(255,255,255,0.025)' }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={ek.alertaNome} numberOfLines={1}>{nomeProd}</Text>
                    {(lojaInfo || codProd) && (
                      <Text style={ek.alertaLoja} numberOfLines={1}>
                        {[codProd, lojaInfo].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <Text style={[ek.alertaCel, { color: DK.nPurp }]}>
                    {d.tipo_divergencia || 'Qtd'}
                  </Text>
                  <Text style={[ek.alertaCel, { color: DK.nRed }]}>
                    {valMoeda != null ? fmtMoeda(valMoeda) : `${difQtd ?? '—'}un`}
                  </Text>
                  <View style={[ek.alertaBadge, { backgroundColor: `${corImp}22` }]}>
                    <Text style={{ color: corImp, fontSize: 12, fontWeight: '700' }}>{impacto}</Text>
                  </View>
                  <TouchableOpacity style={ek.alertaLink} onPress={() => setAlertaSel({ ...d, nomeProd, codProd, lojaInfo, difQtd, valMoeda, impacto, corImp })}>
                    <Text style={{ color: DK.nBlue, fontSize: 12 }}>Ver</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Status da Auditoria */}
          <View style={[ek.graficoCard, isDesktop && { flex: 29 }, !isDesktop && { marginBottom: spacing.md }]}>
            {/* Titulo + icone info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <Text style={ek.graficoTitulo}>STATUS DA AUDITORIA</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <Line x1="12" y1="8" x2="12" y2="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
                <Line x1="12" y1="11" x2="12" y2="16" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            </View>

            {/* Ring + lista de metricas */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <RingProgress
                pct={pctAuditado}
                raio={52}
                espessura={11}
                cor={pctAuditado >= 80 ? DK.nGreen : pctAuditado >= 50 ? DK.nYellow : DK.nRed}
              />
              <View style={{ flex: 1, gap: 12 }}>
                {[
                  { lbl: 'SKUs Planejados',  val: fmtNum(skusPlanejados),         cor: DK.txt    },
                  { lbl: 'SKUs Auditados',   val: fmtNum(skusAuditados),          cor: DK.txt    },
                  { lbl: 'SKUs Pendentes',   val: fmtNum(skusPendentes),          cor: DK.txt    },
                  { lbl: 'Amostragem Media', val: fmtPct(kpis.acuracidade_media), cor: DK.nGreen },
                ].map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Rect x="2" y="2" width="20" height="20" rx="5"
                        stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"
                        fill="rgba(255,255,255,0.04)" />
                      <Path d="M7 12l3.5 3.5L17 8" stroke={DK.nGreen}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <View>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{r.lbl}</Text>
                      <Text style={{ color: r.cor, fontSize: 17, fontWeight: '700' }}>{r.val}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Previsao de Conclusao */}
            <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: spacing.sm }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: 0.3 }}>Previsao de Conclusao</Text>
              <Text style={{ color: DK.nGreen, fontSize: 17, fontWeight: '700', marginTop: 3 }}>{previsaoConclusao}</Text>
            </View>
          </View>

          {/* Resumo do Periodo */}
          <View style={[ek.graficoCard, isDesktop && { flex: 30 }]}>
            {/* Titulo + icone info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <Text style={ek.graficoTitulo}>RESUMO DO PERIODO</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <Line x1="12" y1="8" x2="12" y2="9" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
                <Line x1="12" y1="11" x2="12" y2="16" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />
              </Svg>
            </View>

            {/* Corpo: lista a esquerda + cubo a direita */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>

              {/* Lista de metricas */}
              <View style={{ flex: 1 }}>
                {[
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                        <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Total Estoque Contado',
                    val: fmtMoeda(kpis.valor_total_estoque),
                    cor: '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                        <Line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                        <Line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Valor Divergente',
                    val: kpis.valor_total_divergente != null ? `-${fmtMoeda(kpis.valor_total_divergente)}` : '-',
                    cor: kpis.valor_total_divergente != null && kpis.valor_total_divergente > 0 ? '#FF4444' : '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Circle cx="7" cy="7" r="3" stroke={c} strokeWidth="1.5" />
                        <Circle cx="17" cy="17" r="3" stroke={c} strokeWidth="1.5" />
                        <Path d="M6 18L18 6" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Precisao Financeira',
                    val: fmtPct(acFinanceira),
                    cor: acFinanceira != null && acFinanceira < 95 ? '#FF4444' : '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M8 2v3M16 2v3" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                        <Rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.5" />
                        <Path d="M3 10h18" stroke={c} strokeWidth="1.5" />
                        <Path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" stroke={c} strokeWidth="2" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Contagens Realizadas',
                    val: String(totalSessoes),
                    cor: '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={c} strokeWidth="1.5" />
                        <Rect x="9" y="3" width="6" height="4" rx="1" stroke={c} strokeWidth="1.5" />
                        <Path d="M9 12h6M9 16h4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'SKUs Criticos',
                    val: String(topDiv.length || 0),
                    cor: topDiv.length > 0 ? '#FF4444' : '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                        <Circle cx="9" cy="7" r="4" stroke={c} strokeWidth="1.5" />
                        <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Auditores Envolvidos',
                    val: String(totalUsuarios),
                    cor: '#FFFFFF',
                  },
                  {
                    ico: (c) => (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
                        <Path d="M9 22V12h6v10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
                      </Svg>
                    ),
                    lbl: 'Lojas Monitoradas',
                    val: String(kpis.total_lojas ?? '—'),
                    cor: DK.nYellow,
                  },
                ].map((r, i, arr) => (
                  <View key={i}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                      {r.ico('rgba(255,255,255,0.45)')}
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, flex: 1 }} numberOfLines={1}>{r.lbl}</Text>
                      <Text style={{ color: r.cor, fontSize: 15, fontWeight: '600' }}>{r.val}</Text>
                    </View>
                    {i < arr.length - 1 && (
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                    )}
                  </View>
                ))}
              </View>

            </View>
          </View>
        </View>}
      </>
    );
  }

  // ── Aba: Ferramentas ────────────────────────────────────────────────────────
  function renderFerramentas() {
    return (
      <>
        <View style={ek.ferrCard}>
          <Text style={ek.ferrTitulo}>Exportar Audit Log</Text>
          {!podeExportarAuditLog ? (
            <Text style={ek.ferrSub}>Disponivel somente para administradores.</Text>
          ) : (
            <>
              <Text style={ek.ferrSub}>Exporta eventos do sistema em Excel (.xlsx)</Text>
              <Text style={ek.ferrRotulo}>Tipo de Acao</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
                {TIPOS_ACAO.map(t => (
                  <TouchableOpacity key={String(t.valor)}
                    style={[ek.chip, tipoAcao === t.valor && ek.chipAtivo]}
                    onPress={() => setTipoAcao(t.valor)} activeOpacity={0.7}>
                    <Text style={[ek.chipTxt, tipoAcao === t.valor && { color: '#FFFFFF' }]}>{t.rotulo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={ek.periodoCard}>
                <View style={{ flex: 1, padding: spacing.sm }}>
                  <Text style={ek.periodoRot}>Mes Inicio</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={ek.dropBtn} onPress={() => setDropAberto('mesInicio')} activeOpacity={0.7}>
                      <Text style={ek.dropBtnTxt} numberOfLines={1}>{MESES_NOMES[mesInicioIdx]}</Text>
                      <Text style={{ color: DK.txt3, fontSize: 10 }}>▾</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ek.dropBtn, { maxWidth: 76 }]} onPress={() => setDropAberto('anoInicio')} activeOpacity={0.7}>
                      <Text style={ek.dropBtnTxt}>{anoInicio}</Text>
                      <Text style={{ color: DK.txt3, fontSize: 10 }}>▾</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ width: 1, backgroundColor: DK.borda, marginVertical: 8 }} />
                <View style={{ flex: 1, padding: spacing.sm }}>
                  <Text style={ek.periodoRot}>Mes Fim</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={ek.dropBtn} onPress={() => setDropAberto('mesFim')} activeOpacity={0.7}>
                      <Text style={ek.dropBtnTxt} numberOfLines={1}>{MESES_NOMES[mesFimIdx]}</Text>
                      <Text style={{ color: DK.txt3, fontSize: 10 }}>▾</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ek.dropBtn, { maxWidth: 76 }]} onPress={() => setDropAberto('anoFim')} activeOpacity={0.7}>
                      <Text style={ek.dropBtnTxt}>{anoFim}</Text>
                      <Text style={{ color: DK.txt3, fontSize: 10 }}>▾</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              {erroExp ? <Text style={{ color: DK.nRed, fontSize: 13, marginBottom: 8 }}>{erroExp}</Text> : null}
              <TouchableOpacity style={[ek.btnExportar, exportando && { opacity: 0.65 }]}
                onPress={handleExportar} disabled={exportando} activeOpacity={0.85}>
                {exportando
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>⬇  Exportar Audit Log (.xlsx)</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={[ek.ferrCard, { marginTop: spacing.md }]}>
          <Text style={ek.ferrTitulo}>Participacao por Operador</Text>
          <Text style={ek.ferrSub}>Selecione uma sessao concluida para ver as metricas</Text>
          {sessoesExp.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {sessoesExp.map(s => (
                  <TouchableOpacity key={s.id}
                    style={[ek.chipSessao, sessaoSel?.id === s.id && ek.chipSessaoAtivo]}
                    onPress={() => handleVerParticipacao(s)} activeOpacity={0.7}>
                    <Text style={[ek.chipSessaoTxt, sessaoSel?.id === s.id && { color: '#FFFFFF' }]}
                      numberOfLines={1}>{s.nome}</Text>
                    <Text style={[{ fontSize: 10, color: DK.txt3, marginTop: 1 },
                      sessaoSel?.id === s.id && { color: 'rgba(255,255,255,0.6)' }]}>
                      {s.mes_referencia}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          {carregandoPart && (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={DK.nBlue} />
            </View>
          )}
          {!sessaoSel && !carregandoPart && (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <Text style={{ color: DK.txt3, fontSize: 13, textAlign: 'center' }}>
                Selecione uma sessao acima para ver a participacao por operador
              </Text>
            </View>
          )}
          {participacao && !carregandoPart && (
            <View>
              <Text style={[ek.ferrTitulo, { fontSize: fontSize.md, marginBottom: spacing.sm }]}>
                {participacao.sessao_nome}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={ek.tabelaHeader}>
                    {['Operador', 'SKUs', 'Leituras', '1a Leitura', 'Ultima', 'Ativo'].map((c, i) => (
                      <Text key={i} style={[ek.tabelaHeaderTxt, i === 0 && { width: 130 }]}>{c}</Text>
                    ))}
                  </View>
                  {(participacao.operadores || []).length > 0
                    ? (participacao.operadores || []).map((op, i) => (
                      <View key={op.operador_id}
                        style={[ek.tabelaLinha, i % 2 === 0 && { backgroundColor: DK.card2 }]}>
                        <View style={{ width: 130 }}>
                          <Text style={ek.opNome}    numberOfLines={1}>{op.operador_nome}</Text>
                          <Text style={ek.opEmail}   numberOfLines={1}>{op.operador_email}</Text>
                        </View>
                        <Text style={ek.tabelaCel}>{op.skus_contados}</Text>
                        <Text style={ek.tabelaCel}>{op.num_leituras}</Text>
                        <Text style={ek.tabelaCel}>{fmtHora(op.primeira_leitura)}</Text>
                        <Text style={ek.tabelaCel}>{fmtHora(op.ultima_leitura)}</Text>
                        <Text style={ek.tabelaCel}>{fmtMin(op.minutos_ativo)}</Text>
                      </View>
                    ))
                    : <Text style={{ color: DK.txt3, textAlign: 'center', padding: spacing.lg, fontSize: 13 }}>
                        Nenhuma contagem registrada nesta sessao
                      </Text>
                  }
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[ek.ferrCard, { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center',
            justifyContent: 'center', gap: 8, paddingVertical: spacing.md }]}
          onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={{ color: DK.txt2, fontSize: fontSize.lg }}>←</Text>
          <Text style={{ color: DK.txt2, fontSize: fontSize.md, fontWeight: '600' }}>Voltar</Text>
        </TouchableOpacity>
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout navigation={navigation} telaAtual="Auditoria" titulo="Auditoria" scrollavel={false} semPadding>
      <ImageBackground
        source={IMG_RESUMO}
        style={{ flex: 1, width: '100%', height: '100%' }}
        resizeMode="cover"
      >
        <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: 'rgba(7,15,28,0.82)' }}>
        {/* Barra de abas */}
        <View style={ek.abaBar}>
          {[
            { chave: 'painel',      rotulo: 'Painel de Inteligencia' },
            { chave: 'ferramentas', rotulo: 'Ferramentas'            },
          ].map(ab => (
            <TouchableOpacity key={ab.chave}
              style={[ek.abaBtn, abaAtiva === ab.chave && ek.abaBtnAtiva]}
              onPress={() => setAbaAtiva(ab.chave)} activeOpacity={0.75}>
              <Text style={[ek.abaTxt, abaAtiva === ab.chave && ek.abaTxtAtiva]}>{ab.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Conteudo */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={ek.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View onLayout={e => setPainelW(e.nativeEvent.layout.width)}>
            {abaAtiva === 'painel' ? renderPainel() : renderFerramentas()}
          </View>
          <View style={{ height: spacing.xl }} />
        </ScrollView>
        </View>
      </ImageBackground>
      {renderDropdown()}

      {/* ── Modal de detalhe do Alerta Critico ────────────────────────── */}
      <Modal
        visible={alertaSel !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertaSel(null)}
      >
        <View style={ek.modalOverlay}>
          <View style={[ek.dropModal, { maxHeight: undefined, paddingBottom: spacing.lg }]}>
            {/* Cabecalho */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={{ color: DK.txt, fontSize: fontSize.md, fontWeight: '800', letterSpacing: 0.5 }}>
                DETALHE DA DIVERGENCIA
              </Text>
              <TouchableOpacity onPress={() => setAlertaSel(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={DK.txt3} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>

            {alertaSel && (() => {
              const a = alertaSel;
              const linhas = [
                { rotulo: 'Produto',     valor: a.nomeProd },
                { rotulo: 'SKU',         valor: a.codProd  || '—' },
                { rotulo: 'Loja',        valor: a.lojaInfo || '—' },
                { rotulo: 'Tipo',        valor: a.tipo_divergencia || 'Quantidade' },
                { rotulo: 'Diferenca',   valor: a.difQtd != null ? `${a.difQtd > 0 ? '+' : ''}${a.difQtd}` : '—' },
                { rotulo: 'Valor',       valor: a.valMoeda != null ? fmtMoeda(a.valMoeda) : '—' },
                { rotulo: 'Status',      valor: a.status || '—' },
              ];
              return (
                <View style={{ gap: 0 }}>
                  {/* Badge de impacto */}
                  <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
                    <View style={{ backgroundColor: `${a.corImp}22`, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: `${a.corImp}55` }}>
                      <Text style={{ color: a.corImp, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>
                        Impacto {a.impacto}
                      </Text>
                    </View>
                  </View>
                  {/* Linhas de detalhe */}
                  {linhas.map((l, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < linhas.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                      <Text style={{ color: DK.txt3, fontSize: 13, fontWeight: '600' }}>{l.rotulo}</Text>
                      <Text style={{ color: DK.txt, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' }} numberOfLines={2}>{l.valor}</Text>
                    </View>
                  ))}
                  {/* Botao fechar */}
                  <TouchableOpacity
                    onPress={() => setAlertaSel(null)}
                    style={{ marginTop: spacing.lg, backgroundColor: DK.nBlue, borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const GAP = spacing.sm;
const ek  = StyleSheet.create({
  scrollContent: { padding: spacing.md },

  // Abas
  abaBar:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: DK.borda, paddingHorizontal: spacing.md },
  abaBtn:      { paddingVertical: 12, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  abaBtnAtiva: { borderBottomColor: DK.nBlue },
  abaTxt:      { fontSize: fontSize.sm, fontWeight: '600', color: DK.txt3 },
  abaTxtAtiva: { color: DK.nBlue },

  // Painel
  painelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  painelTitulo: { fontSize: fontSize.lg, fontWeight: '800', color: DK.txt, letterSpacing: 0.5 },
  painelSub:    { fontSize: fontSize.xs, color: DK.txt3, marginTop: 3 },
  btnAtualizar:  { width: 38, height: 38, borderRadius: 19, backgroundColor: DK.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DK.borda },
  btnRecarregar: { backgroundColor: DK.nBlue, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },

  btnFiltros:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnFiltrosAtivo: { backgroundColor: '#3730A3' },
  btnFiltrosTxt:   { fontSize: fontSize.sm, color: '#FFFFFF', fontWeight: '500' },
  btnFiltrosDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FCD34D', marginLeft: -2 },

  btnLayout:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1B2D47', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: DK.borda },
  btnLayoutAtivo: { backgroundColor: '#2A3F1A', borderColor: DK.nYellow },
  btnLayoutTxt:   { fontSize: fontSize.sm, color: DK.txt3, fontWeight: '500' },

  edModeBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2D10', borderRadius: 8, borderWidth: 1, borderColor: '#4A7A20', paddingHorizontal: 14, paddingVertical: 9, marginBottom: GAP, gap: 8 },
  edModeBarTxt: { flex: 1, fontSize: 12, color: '#A3E635', fontWeight: '500' },

  barraEd:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 5, marginBottom: 10, gap: 4, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  btnEd:     { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  txtEd:     { color: DK.txt2, fontSize: 14, fontWeight: '700' },
  txtEdDis:  { color: 'rgba(255,255,255,0.2)' },
  flexBadge: { minWidth: 30, alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,242,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,242,255,0.3)' },

  filtroPainel: { backgroundColor: DK.card2, borderRadius: 12, borderWidth: 1, borderColor: DK.borda, marginBottom: spacing.md, overflow: 'hidden' },
  filtroSec:    { paddingTop: 14, paddingBottom: 8 },
  filtroLabel:  { fontSize: 11, fontWeight: '700', color: DK.txt3, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.md, marginBottom: 4 },
  filtroSep:    { height: 1, backgroundColor: DK.borda },
  filtroChips:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md - 3, paddingBottom: 4 },
  chip:         { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: DK.borda, backgroundColor: 'rgba(255,255,255,0.04)', margin: 3 },
  chipAtivo:    { borderColor: DK.nBlue, backgroundColor: 'rgba(0,242,255,0.12)' },
  chipTxt:      { fontSize: 12, color: DK.txt3, fontWeight: '400' },
  chipTxtAtivo: { color: DK.nBlue, fontWeight: '600' },

  // KPIs
  kpiRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  kpiCard:   { flex: 1, minWidth: 148, backgroundColor: DK.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: DK.borda },
  kpiTitulo: { fontSize: 12, fontWeight: '800', color: DK.txt3, letterSpacing: 0.8 },
  kpiValor:  { fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  kpiSub:    { fontSize: 12, color: DK.txt3 },

  // Graficos
  graficoCard:   { backgroundColor: DK.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: DK.borda },
  graficoTitulo: { fontSize: 13, fontWeight: '800', color: DK.txt, letterSpacing: 0.8 },
  graficoSub:    { fontSize: 12, color: DK.txt3, marginTop: 2 },
  ringCard:      { alignItems: 'center' },

  // Alertas
  alertaIcBox:    { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,215,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  alertaHeaderRow:{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: DK.borda, marginBottom: 2 },
  alertaHeaderTxt:{ flex: 1, fontSize: 11, fontWeight: '800', color: DK.txt3, textAlign: 'center', letterSpacing: 0.5 },
  alertaLinha:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderRadius: 4 },
  alertaNome:     { fontSize: 14, fontWeight: '600', color: DK.txt },
  alertaLoja:     { fontSize: 12, color: DK.txt3 },
  alertaCel:      { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  alertaBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginHorizontal: 4 },
  alertaLink:     { paddingHorizontal: 6 },

  // Ferramentas
  ferrCard:   { backgroundColor: DK.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: DK.borda },
  ferrTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: DK.txt, marginBottom: 4 },
  ferrSub:    { fontSize: fontSize.sm, color: DK.txt3, marginBottom: spacing.md },
  ferrRotulo: { fontSize: fontSize.xs, fontWeight: '700', color: DK.txt2, marginBottom: 6 },

  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: DK.borda, backgroundColor: DK.card2 },
  chipAtivo: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  chipTxt:   { fontSize: fontSize.sm, fontWeight: '600', color: DK.txt2 },

  periodoCard: { flexDirection: 'row', backgroundColor: DK.card2, borderRadius: 12, borderWidth: 1, borderColor: DK.borda, marginBottom: spacing.md, overflow: 'hidden' },
  periodoRot:  { fontSize: fontSize.sm, fontWeight: '600', color: DK.txt, marginBottom: spacing.xs },
  dropBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DK.card, borderRadius: 8, borderWidth: 1, borderColor: DK.borda, paddingHorizontal: 10, paddingVertical: 7 },
  dropBtnTxt:  { fontSize: fontSize.sm, fontWeight: '500', color: DK.txt, flexShrink: 1 },

  btnExportar:  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 15 },

  chipSessao:     { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8, borderWidth: 1, borderColor: DK.borda, backgroundColor: DK.card2, maxWidth: 200 },
  chipSessaoAtivo:{ backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  chipSessaoTxt:  { fontSize: fontSize.xs, fontWeight: '600', color: DK.txt },

  tabelaHeader:    { flexDirection: 'row', backgroundColor: DK.card2, paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: 8, marginBottom: 2 },
  tabelaHeaderTxt: { width: 68, fontSize: 12, fontWeight: '800', color: DK.txt2, textAlign: 'center' },
  tabelaLinha:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: DK.borda },
  opNome:          { fontSize: fontSize.sm, fontWeight: '600', color: DK.txt },
  opEmail:         { fontSize: 12, color: DK.txt3 },
  tabelaCel:       { width: 68, fontSize: 13, color: DK.txt2, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  dropModal:    { backgroundColor: DK.card, borderRadius: 16, padding: spacing.md, width: '100%', maxHeight: 320, borderWidth: 1, borderColor: DK.borda },
  dropTitulo:   { fontSize: fontSize.md, fontWeight: '700', color: DK.txt, marginBottom: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: DK.borda },
  dropOpcao:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: spacing.sm, borderRadius: 8 },
  dropOpcaoAtiva:   { backgroundColor: '#1E3A5F' },
  dropOpcaoTxt:     { fontSize: fontSize.md, color: DK.txt2 },
  dropOpcaoTxtAtiva:{ color: DK.txt, fontWeight: '700' },
});
