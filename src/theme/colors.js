// Design tokens centralizados — identidade visual BOLD.
// Fonte unica de verdade para cores, espacamentos, tipografia e raios.
// Todos os arquivos do projeto devem importar daqui.

// ── Cores ─────────────────────────────────────────────────────────────────────
export const colors = {

  // ── Marca BOLD ────────────────────────────────────────────────────
  primary:        '#1E3A5F',   // Azul-marinho principal BOLD
  primaryDark:    '#162D4A',   // Hover / pressed
  primaryLight:   '#3B82F6',   // Links e icones
  primarySoft:    '#DBEAFE',   // Backgrounds suaves

  accent:         '#F5A623',   // Amarelo-dourado BOLD
  accentGreen:    '#22C55E',   // Verde BOLD

  // ── Navegacao ─────────────────────────────────────────────────────
  activeNav:      '#4F46E5',   // Item ativo na sidebar
  activeBg:       '#EEF2FF',   // Fundo do item ativo

  // ── Textos ────────────────────────────────────────────────────────
  text:           '#111827',   // Texto principal
  textPrimary:    '#111827',
  textSecondary:  '#374151',   // Texto secundario
  textMuted:      '#6B7280',   // Texto desbotado / labels
  textHint:       '#9CA3AF',   // Placeholder / dicas
  onDark:         '#FFFFFF',   // Texto sobre fundo escuro
  onDarkMuted:    'rgba(255,255,255,0.65)',

  // ── Fundos ────────────────────────────────────────────────────────
  background:     '#FFFFFF',   // Surface / cards
  backgroundSoft: '#F5F5F5',   // Fundo geral de tela
  backgroundDark: '#0F172A',   // Fundo escuro (scanner)

  // Aliases semanticos
  pageBg:         '#F5F5F5',
  surface:        '#FFFFFF',
  sidebarBg:      '#1E3A5F',
  headerBg:       '#1E3A5F',
  inputBg:        '#FFFFFF',

  // ── Estados ───────────────────────────────────────────────────────
  success:        '#16A34A',
  successSoft:    '#DCFCE7',
  warning:        '#D97706',
  warningSoft:    '#FEF3C7',
  danger:         '#EF4444',
  dangerSoft:     '#FEE2E2',
  info:           '#0284C7',
  infoSoft:       '#E0F2FE',

  // ── Bordas ────────────────────────────────────────────────────────
  border:         '#E5E7EB',
  borderStrong:   '#CBD5E1',
  borderSubtle:   'rgba(0,0,0,0.06)',

  // ── Puros ─────────────────────────────────────────────────────────
  white:          '#FFFFFF',
  black:          '#000000',
};

// ── Espacamentos (px) ─────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ── Tipografia ────────────────────────────────────────────────────────────────
export const fontSize = {
  xs:      12,
  sm2:     13,   // labels secundarios
  sm:      14,
  md2:     15,   // corpo aumentado
  md:      16,
  lg:      18,
  xl:      22,
  title:   26,   // titulos de pagina
  xxl:     28,   // titulos grandes (compat)
  display: 32,
};

// ── Raios de borda ────────────────────────────────────────────────────────────
export const radius = {
  sm:   6,
  md:   8,    // inputs, chips
  md2:  10,   // cards (compat)
  lg:   12,   // cards padrao
  xl:   16,   // cards / modais
  full: 9999,
};
