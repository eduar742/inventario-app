// Paleta de cores corporativa - tema azul
// Inspirada em sistemas profissionais (Linear, Notion, Stripe)

export const colors = {
  // Cores primárias (azul corporativo)
  primary: '#1E40AF',          // Azul principal (botões, destaques)
  primaryDark: '#1E3A8A',      // Azul escuro (estados hover/pressed)
  primaryLight: '#3B82F6',     // Azul claro (links, ícones)
  primarySoft: '#DBEAFE',      // Azul suave (backgrounds)

  // Neutros (textos e bordas)
  text: '#0F172A',             // Texto principal
  textSecondary: '#475569',    // Texto secundário
  textMuted: '#94A3B8',        // Texto desbotado
  border: '#E2E8F0',           // Bordas e separadores
  borderStrong: '#CBD5E1',     // Bordas mais visíveis

  // Backgrounds
  background: '#FFFFFF',       // Fundo principal
  backgroundSoft: '#F8FAFC',   // Fundo de cards/seções
  backgroundDark: '#0F172A',   // Fundo escuro (scanner)

  // Estados (feedback visual)
  success: '#16A34A',          // Verde - contagem OK
  successSoft: '#DCFCE7',      // Verde suave
  warning: '#EA580C',          // Laranja - recontagem
  warningSoft: '#FFEDD5',      // Laranja suave
  danger: '#DC2626',           // Vermelho - erro
  dangerSoft: '#FEE2E2',       // Vermelho suave
  info: '#0284C7',             // Azul info
  infoSoft: '#E0F2FE',         // Azul info suave

  // Branco/preto puros
  white: '#FFFFFF',
  black: '#000000',
};

// Espaçamentos padronizados (em pixels)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Tamanhos de fonte
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 32,
};

// Border radius (cantos arredondados)
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};