// Tela inicial — blocos de navegacao filtrados por papel.
// Usa AppLayout (sidebar + header centralizado).

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import AppLayout from '../components/AppLayout';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { pegarUsuario, buscarPerfilAtual, salvarUsuario } from '../services/api';

// ── Blocos de navegacao por papel ─────────────────────────────────────────────
const BLOCOS = [
  {
    id: 'inventario',
    titulo: 'Inventário',
    descricao: 'Iniciar ou continuar contagem de produtos.',
    emoji: '📦',
    cor: '#2563EB',
    tela: 'Lojas',
    papeis: ['admin', 'gestor', 'operador', 'lider'],
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    descricao: 'KPIs, sessões ativas e divergências.',
    emoji: '📊',
    cor: '#2563EB',
    tela: 'Dashboard',
    papeis: ['admin', 'gestor', 'gerente', 'auditor'],
  },
  {
    id: 'consolidado',
    titulo: 'Consolidado',
    descricao: 'Visão gerencial multi-loja por período.',
    emoji: '🏢',
    cor: '#16A34A',
    tela: 'DashboardConsolidado',
    papeis: ['admin', 'gerente', 'auditor'],
  },
  {
    id: 'relatorio',
    titulo: 'Rel. Geral',
    descricao: 'Excel consolidado de todas as lojas.',
    emoji: '📈',
    cor: '#16A34A',
    tela: 'RelatorioConsolidado',
    papeis: ['admin', 'gerente', 'auditor'],
  },
  {
    id: 'importar',
    titulo: 'Importar',
    descricao: 'Carregar planilhas de estoque.',
    emoji: '📥',
    cor: '#D97706',
    tela: 'Importacao',
    papeis: ['admin'],
  },
  {
    id: 'usuarios',
    titulo: 'Usuários',
    descricao: 'Cadastrar e gerenciar operadores.',
    emoji: '👥',
    cor: '#7C3AED',
    tela: 'Gestores',
    papeis: ['admin'],
  },
  {
    id: 'auditoria',
    titulo: 'Auditoria',
    descricao: 'Audit log e participação de operadores.',
    emoji: '🔍',
    cor: '#0891B2',
    tela: 'Auditoria',
    papeis: ['admin'],
  },
  {
    id: 'ajuda',
    titulo: 'Ajuda',
    descricao: 'Guia de uso do sistema.',
    emoji: '📖',
    cor: '#0891B2',
    tela: 'Ajuda',
    papeis: ['admin', 'gestor', 'gerente', 'auditor', 'operador', 'lider'],
  },
];

// ── Icone de seta ─────────────────────────────────────────────────────────────
function IcoChevronDir({ size = 18, cor = colors.textHint }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={cor} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Card unificado (desktop 4 col + mobile 2 col) ─────────────────────────────
function CardBloco({ bloco, indice, onPress, compacto = false }) {
  // Derivados de cor — sem novas variaveis no tema
  const bgTint   = bloco.cor + '12'; // ~7 % opacity — tint sutil simula gradiente
  const iconeBg  = bloco.cor + '20'; // ~12 % opacity — fundo do circulo de icone
  const bordaCor = bloco.cor + '35'; // ~21 % opacity — borda discreta

  return (
    <TouchableOpacity
      style={[
        est.card,
        { backgroundColor: bgTint, borderColor: bordaCor },
        compacto && est.cardCompacto,
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Cabecalho: numero de ordem — canto superior esquerdo */}
      <View style={est.cardCabecalho}>
        <Text style={[est.cardNumero, { color: bloco.cor }]}>
          {String(indice + 1).padStart(2, '0')}
        </Text>
      </View>

      {/* Icone 3D em circulo colorido */}
      <View style={[
        est.cardIconeCirculo,
        { backgroundColor: iconeBg },
        compacto && est.cardIconeCirculoCompacto,
      ]}>
        <Text style={[est.cardEmoji, compacto && est.cardEmojiCompacto]}>
          {bloco.emoji}
        </Text>
      </View>

      {/* Titulo */}
      <Text
        style={[est.cardTitulo, { color: bloco.cor }, compacto && est.cardTituloCompacto]}
        numberOfLines={1}
      >
        {bloco.titulo}
      </Text>

      {/* Descricao */}
      <Text
        style={[est.cardDescricao, compacto && est.cardDescricaoCompacto]}
        numberOfLines={2}
      >
        {bloco.descricao}
      </Text>

      {/* Rodape: botao circular com seta — canto inferior direito */}
      <View style={est.cardRodape}>
        <View style={[est.cardBotaoSeta, { backgroundColor: bloco.cor }]}>
          <IcoChevronDir size={compacto ? 13 : 15} cor="#FFFFFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const [usuario, setUsuario] = useState(null);
  const { width }  = useWindowDimensions();
  const isDesktop  = width >= 768;
  const numColunas = isDesktop ? 4 : 2;
  const gapGrade   = isDesktop ? 20 : 12;

  useEffect(() => {
    // Busca papel do servidor (fonte autoritativa); usa cache local como fallback offline
    buscarPerfilAtual()
      .then(perfil => {
        setUsuario(perfil);
        salvarUsuario(perfil);
      })
      .catch(() => pegarUsuario().then(setUsuario).catch(() => {}));
  }, []);

  // Sem papel definido: mostra lista vazia ate o perfil carregar (evita fallback para 'operador')
  const papel           = usuario?.papel ?? null;
  const blocosFiltrados = papel ? BLOCOS.filter(b => b.papeis.includes(papel)) : [];

  // Montar linhas de numColunas para o grid
  const linhas = [];
  for (let i = 0; i < blocosFiltrados.length; i += numColunas) {
    linhas.push(blocosFiltrados.slice(i, i + numColunas));
  }

  return (
    <AppLayout navigation={navigation} telaAtual="Home" titulo="Início">

      {/* Cabecalho de secao */}
      <Text style={est.titulo}>O que deseja fazer?</Text>
      <View style={est.linhaDeco} />

      {/* Grade responsiva: 4 colunas desktop, 2 colunas mobile */}
      <View style={[est.grade, { gap: gapGrade }]}>
        {linhas.map((linha, li) => (
          <View key={li} style={[est.gradeLinha, { gap: gapGrade }]}>
            {linha.map((bloco, bi) => (
              <View key={bloco.id} style={est.gradeCelula}>
                <CardBloco
                  bloco={bloco}
                  indice={li * numColunas + bi}
                  compacto={!isDesktop}
                  onPress={() => navigation.navigate(bloco.tela)}
                />
              </View>
            ))}
            {/* Celulas fantasma para completar a ultima linha */}
            {Array(numColunas - linha.length).fill(null).map((_, i) => (
              <View key={`ph-${i}`} style={est.gradeCelula} />
            ))}
          </View>
        ))}
      </View>

      <Text style={est.versao}>Sistema de Inventário — v1.0.0</Text>
    </AppLayout>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const est = StyleSheet.create({

  // Cabecalho de secao
  titulo: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.primary,
  },
  linhaDeco: {
    width: 52,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 32,
  },

  // ── Grade ─────────────────────────────────────────────────────────────────
  grade: {
    // gap vem inline (isDesktop ? 20 : 12)
  },
  gradeLinha: {
    flexDirection: 'row',
    // gap vem inline
  },
  gradeCelula: {
    flex: 1,
    minWidth: 0,
  },

  // ── Card base ─────────────────────────────────────────────────────────────
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
    // Sombra pronunciada para dar profundidade
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  cardCompacto: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },

  // Cabecalho interno — numero de ordem a esquerda
  cardCabecalho: {
    alignSelf: 'stretch',
    paddingTop: 14,
    marginBottom: 12,
  },
  cardNumero: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    opacity: 0.65,
  },

  // Circulo do icone
  cardIconeCirculo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIconeCirculoCompacto: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginBottom: 10,
  },
  cardEmoji: {
    fontSize: 36,
    textAlign: 'center',
  },
  cardEmojiCompacto: {
    fontSize: 26,
  },

  // Titulo
  cardTitulo: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  cardTituloCompacto: {
    fontSize: 14,
    marginBottom: 4,
  },

  // Descricao
  cardDescricao: {
    fontSize: fontSize.sm2,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    minHeight: 38, // reserva espaco para 2 linhas — alinha rodapes dos cards
  },
  cardDescricaoCompacto: {
    fontSize: fontSize.xs,
    lineHeight: 16,
    minHeight: 32,
  },

  // Rodape do card — botao seta a direita
  cardRodape: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginTop: 14,
  },
  cardBotaoSeta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Rodape da tela
  versao: {
    fontSize: fontSize.sm2,
    color: colors.textHint,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
});
