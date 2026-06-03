// Tela de Treinamento / Ajuda do sistema.
// Secoes expansiveis (accordion) com busca no topo.
// Acessivel pelo menu principal (HomeScreen).

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';

// ── Conteudo das secoes ─────────────────────────────────────────────
const SECOES = [
  {
    id: 'usuarios',
    emoji: '👥',
    titulo: 'Cadastro de Usuários',
    cor: '#7C3AED',
    corBg: '#F5F3FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Apenas o perfil ADM pode criar e gerenciar usuários. Acesse pelo menu principal → bloco "Usuários".',
      },
      {
        tipo: 'passos',
        titulo: 'Como criar um novo usuário:',
        itens: [
          'Toque em "+ Novo usuário" no topo da lista.',
          'Preencha o Nome completo do usuário.',
          'Informe o E-mail (será o login de acesso).',
          'Defina uma Senha forte (mínimo 10 caracteres, letras maiúsculas, minúsculas, números e caracteres especiais).',
          'Selecione o Papel (perfil de acesso): Gestor, Gerente, Auditor ou Operador.',
          'Vincule as Lojas: toque no seletor de lojas para escolher uma ou mais unidades.',
          'Toque em "Salvar".',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como editar ou inativar:',
        itens: [
          'Na lista de usuários, toque no card do usuário desejado.',
          'Altere os campos necessários (nome, papel, lojas).',
          'Para redefinir a senha, preencha o campo "Redefinir senha".',
          'Para inativar: desmarque a opção "Usuário ativo" e salve.',
          'Usuários inativos não conseguem fazer login.',
        ],
      },
    ],
  },
  {
    id: 'permissoes',
    emoji: '🔐',
    titulo: 'Grupos e Permissões',
    cor: '#DC2626',
    corBg: '#FEF2F2',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O sistema possui 5 perfis de acesso. Cada perfil tem permissões diferentes para garantir segurança e rastreabilidade.',
      },
      {
        tipo: 'tabela',
        colunas: ['Ação', 'ADM', 'Gestor', 'Gerente', 'Auditor', 'Operador'],
        linhas: [
          ['Realizar inventário (scanner)', '✓', '✓', '✗', '✗', '✓'],
          ['Criar/encerrar sessões', '✓', '✓', '✗', '✗', '✗'],
          ['Aprovar divergências', '✓', '✓', '✗', '✗', '✗'],
          ['Ver dashboards', '✓', '✓', '✓', '✓', '✗'],
          ['Exportar relatórios', '✓', '✓', '✓', '✓', '✗'],
          ['Importar planilhas', '✓', '✓', '✗', '✗', '✗'],
          ['Gerenciar usuários', '✓', '✗', '✗', '✗', '✗'],
          ['Excluir sessões concluídas', '✓', '✗', '✗', '✗', '✗'],
        ],
      },
      {
        tipo: 'texto',
        texto: '⚠️ Operadores veem apenas as lojas vinculadas ao seu perfil. Gerente e Auditor têm acesso somente leitura.',
      },
    ],
  },
  {
    id: 'sessao',
    emoji: '📋',
    titulo: 'Como Criar uma Sessão de Inventário',
    cor: '#1E40AF',
    corBg: '#EFF6FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Uma sessão organiza o inventário de uma loja em um período específico. É necessário ter o estoque importado antes de criar a sessão.',
      },
      {
        tipo: 'passos',
        titulo: 'Passo a passo:',
        itens: [
          'Acesse o menu principal → "Inventário" → selecione a loja.',
          'Toque em "+ Nova sessão" no cabeçalho.',
          'Selecione a Loja e o Mês de referência (os meses disponíveis aparecem automaticamente).',
          'Defina o Nome da sessão (gerado automaticamente se deixar em branco).',
          'Escolha o Tipo: Geral, Parcial, Cíclico ou Recontagem.',
          'Selecione a Natureza: Venda, Quarentena ou Todas.',
          'Marque "Iniciar imediatamente" para liberar aos operadores.',
          'Toque em "Criar sessão".',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Encerrar ou pausar:',
        itens: [
          'Na lista de sessões, localize a sessão "Em andamento".',
          'Toque em "Encerrar sessão" (apenas ADM/Gestor).',
          'O sistema gera automaticamente as divergências.',
          'A sessão passa para "Aguardando aprovação".',
          'Para cancelar uma sessão, toque em "Cancelar sessão" (irreversível).',
        ],
      },
    ],
  },
  {
    id: 'contagem',
    emoji: '📦',
    titulo: 'Como Realizar a Contagem',
    cor: '#059669',
    corBg: '#F0FDF4',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O inventário é CEGO: o operador não vê o saldo do sistema antes de contar. Isso garante contagens imparciais.',
      },
      {
        tipo: 'passos',
        titulo: 'Como o operador realiza a contagem:',
        itens: [
          'Faça login → toque em "Inventário" → sistema direciona automaticamente para sua loja.',
          'Selecione a sessão "Em andamento".',
          'Toque na sessão para acessar o Scanner.',
          'Aponte a câmera para o QR Code do produto.',
          'Na tela de contagem, digite a quantidade física encontrada.',
          'Toque em "Adicionar ao inventário".',
          'Repita para todos os produtos.',
          'Ao finalizar, toque em "Encerrar contagem".',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Lógica das 3 contagens:',
        itens: [
          '1ª contagem: se diverge do sistema → solicita 2ª contagem.',
          '2ª contagem: se igual à 1ª → diferença confirmada.',
          '2ª contagem: se diferente da 1ª → solicita 3ª (desempate).',
          '3ª contagem: valor final registrado como diferença.',
        ],
      },
    ],
  },
  {
    id: 'importacao',
    emoji: '📥',
    titulo: 'Importar Planilhas',
    cor: '#D97706',
    corBg: '#FFFBEB',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'A importação carrega o saldo de estoque do ERP para o sistema, criando a base para o inventário.',
      },
      {
        tipo: 'passos',
        titulo: 'Formato aceito — colunas obrigatórias:',
        itens: [
          'Natureza — ex: "Natureza Venda" ou "Natureza Quarentena"',
          'Codigo — código único do produto (SKU)',
          'Descricao — nome do produto',
          'UnidadeMedida — ex: UN, CX, KG',
          'SaldoEstoque — quantidade em estoque (número ≥ 0)',
          'CustoUnitario — valor unitário (opcional)',
          'GrupoMaterial — grupo do produto (opcional, ex: ACM)',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como importar:',
        itens: [
          'Acesse o menu → "Importar" → aba "Estoque".',
          'Selecione a Loja e o Mês de referência.',
          'Escolha o Modo: Completo (zera ausentes) ou Parcial (só atualiza).',
          'Toque em "Selecionar planilha" e escolha o arquivo .xlsx ou .csv.',
          'Toque em "Importar estoque".',
          'Verifique o resultado: linhas importadas com sucesso e erros, se houver.',
        ],
      },
      {
        tipo: 'texto',
        texto: '📋 Para importar inventários históricos (realizados antes do app), use a aba "Inventário Histórico" e adicione as colunas SaldoSistema e QuantidadeContada.',
      },
    ],
  },
  {
    id: 'relatorios',
    emoji: '📈',
    titulo: 'Exportar Relatórios',
    cor: '#16A34A',
    corBg: '#F0FDF4',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O sistema gera relatórios em Excel (xlsx), PDF e CSV com todas as contagens, divergências e análises financeiras.',
      },
      {
        tipo: 'passos',
        titulo: 'Relatório por sessão:',
        itens: [
          'Nas Sessões, selecione uma sessão "Concluída".',
          'Toque em "Exportar".',
          'Escolha o Perfil: Operacional, Financeiro, Auditoria TI ou Completo.',
          'Escolha o Formato: Excel, PDF ou CSV.',
          'O arquivo é baixado automaticamente.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Relatório Geral (todas as lojas):',
        itens: [
          'No menu → "Rel. Geral".',
          'Filtre por Natureza (Venda, Quarentena ou Todas) e Mês.',
          'Toque em "Gerar e baixar Excel".',
          'O Excel terá uma aba por natureza com todas as lojas.',
          'Cores: verde ≥ 99% acuracidade, amarelo ≥ 90%, vermelho < 90%.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    emoji: '📊',
    titulo: 'Dashboard e KPIs',
    cor: '#6366F1',
    corBg: '#EEF2FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O Dashboard mostra indicadores em tempo real das sessões e inventários. Acesse pelo menu → "Dashboard".',
      },
      {
        tipo: 'passos',
        titulo: 'Principais indicadores:',
        itens: [
          'Sessões ativas: quantas sessões estão em andamento agora.',
          'Aguardando aprovação: sessões encerradas aguardando o gestor revisar.',
          'Acuracidade média: % de itens sem divergência (meta: acima de 95%).',
          'Valor total divergente: ajuste líquido financeiro necessário (sobra − falta).',
          'Top divergências: os 8 produtos com maior valor de diferença.',
          'Acuracidade por loja: desempenho de cada unidade na última sessão.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como interpretar os 3 painéis de apuração:',
        itens: [
          'Apuração de Valor: diferença em R$ entre o contado e o sistema (ajuste líquido).',
          'Apuração de Unidades: diferença em unidades físicas (ajuste líquido).',
          'Apuração de Itens (SKU): quantos SKUs tiveram alguma diferença.',
          'Diferença em %: |ajuste líquido| ÷ total. Quanto menor, melhor.',
          'Acuracidade: 100% − diferença%. Meta mínima: 95%.',
        ],
      },
    ],
  },
  {
    id: 'consolidado',
    emoji: '🏢',
    titulo: 'Consolidado Multi-Loja',
    cor: '#0D9488',
    corBg: '#F0FDFA',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O Dashboard Consolidado mostra todas as lojas em uma única tabela comparativa. Acesse pelo menu → "Consolidado".',
      },
      {
        tipo: 'passos',
        titulo: 'Como usar:',
        itens: [
          'Selecione o Mês de competência nos chips no topo.',
          'Filtre por Natureza se necessário (Venda ou Quarentena).',
          'A coluna amarela "Consolidado" é a soma de todas as lojas com sessão.',
          'Cada coluna à direita é uma loja individualmente.',
          'Lojas sem inventário no período aparecem com valores zerados em cinza.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como interpretar as linhas:',
        itens: [
          'Total de R$ valor: valor total do estoque auditado.',
          'Ajuste positivo (+): valor dos itens encontrados a mais (sobra).',
          'Ajuste negativo (−): valor dos itens encontrados a menos (falta).',
          'Diferença líquida: sobra − falta. Valor real do ajuste necessário.',
          'Diferença em %: |líquido| ÷ total. Indica o nível de divergência.',
          'Acuracidade: 100% − diferença%. Meta: acima de 99%.',
        ],
      },
      {
        tipo: 'texto',
        texto: '📋 Os "Grupos contados nas lojas" no cabeçalho indicam quais grupos de materiais foram inventariados no período selecionado.',
      },
    ],
  },
];

// ── Componente de tabela comparativa ──────────────────────────────
function TabelaPermissoes({ colunas, linhas }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: spacing.sm }}>
      <View>
        {/* Header */}
        <View style={est.tabelaLinha}>
          {colunas.map((c, i) => (
            <View key={i} style={[est.tabelaCel, i === 0 ? est.tabelaCelAcao : est.tabelaCelPerfil]}>
              <Text style={est.tabelaHeaderTxt}>{c}</Text>
            </View>
          ))}
        </View>
        {/* Linhas */}
        {linhas.map((linha, li) => (
          <View key={li} style={[est.tabelaLinha, li % 2 === 0 && { backgroundColor: '#F8FAFC' }]}>
            {linha.map((cel, ci) => (
              <View key={ci} style={[est.tabelaCel, ci === 0 ? est.tabelaCelAcao : est.tabelaCelPerfil]}>
                <Text style={[
                  ci === 0 ? est.tabelaAcaoTxt : est.tabelaValTxt,
                  cel === '✓' && { color: '#16A34A', fontWeight: '700' },
                  cel === '✗' && { color: '#94A3B8' },
                ]}>{cel}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Componente de secao accordion ─────────────────────────────────
function Secao({ secao, expandida, onToggle }) {
  return (
    <View style={[est.secao, { borderLeftColor: secao.cor }]}>
      {/* Header clicavel */}
      <TouchableOpacity style={est.secaoHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={[est.secaoEmojiBg, { backgroundColor: secao.corBg }]}>
          <Text style={est.secaoEmoji}>{secao.emoji}</Text>
        </View>
        <Text style={[est.secaoTitulo, { flex: 1, minWidth: 0 }]} numberOfLines={2}>
          {secao.titulo}
        </Text>
        <Text style={[est.secaoChevron, { color: secao.cor }]}>
          {expandida ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* Conteudo expansivel */}
      {expandida && (
        <View style={est.secaoCorpo}>
          {secao.conteudo.map((bloco, bi) => {
            if (bloco.tipo === 'texto') {
              return (
                <Text key={bi} style={est.texto}>{bloco.texto}</Text>
              );
            }
            if (bloco.tipo === 'passos') {
              return (
                <View key={bi} style={est.passosBox}>
                  {bloco.titulo && (
                    <Text style={[est.passosTitulo, { color: secao.cor }]}>{bloco.titulo}</Text>
                  )}
                  {bloco.itens.map((item, ii) => (
                    <View key={ii} style={est.passoLinha}>
                      <View style={[est.passoBullet, { backgroundColor: secao.cor }]}>
                        <Text style={est.passoBulletTxt}>{ii + 1}</Text>
                      </View>
                      <Text style={[est.passoTxt, { flex: 1, minWidth: 0 }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              );
            }
            if (bloco.tipo === 'tabela') {
              return (
                <TabelaPermissoes key={bi} colunas={bloco.colunas} linhas={bloco.linhas} />
              );
            }
            return null;
          })}
        </View>
      )}
    </View>
  );
}

// ── Tela principal ─────────────────────────────────────────────────
export default function AjudaScreen({ navigation }) {
  const [busca, setBusca] = useState('');
  const [expandidas, setExpandidas] = useState({});

  function toggleSecao(id) {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Filtra secoes pelo texto de busca
  const secoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return SECOES;
    return SECOES.filter(s => {
      const textoSecao = [
        s.titulo,
        ...s.conteudo.map(b =>
          b.tipo === 'passos'
            ? (b.titulo || '') + ' ' + (b.itens || []).join(' ')
            : b.texto || ''
        ),
      ].join(' ').toLowerCase();
      return textoSecao.includes(q);
    });
  }, [busca]);

  return (
    <SafeAreaView style={est.container}>
      {/* Campo de busca */}
      <View style={est.buscaBox}>
        <Text style={est.buscaIcone}>🔍</Text>
        <TextInput
          style={est.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar no guia..."
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')} style={{ padding: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={est.scroll}>

        {/* Titulo */}
        <View style={est.topoTitulo}>
          <Text style={est.topoEmoji}>📖</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={est.topoTituloTxt}>Guia de Uso</Text>
            <Text style={est.topoSubTxt}>Toque em cada seção para expandir</Text>
          </View>
        </View>

        {/* Secoes */}
        {secoesFiltradas.length === 0 ? (
          <View style={est.semResultado}>
            <Text style={est.semResultadoEmoji}>🔍</Text>
            <Text style={est.semResultadoTxt}>Nenhum resultado para "{busca}"</Text>
          </View>
        ) : (
          secoesFiltradas.map(secao => (
            <Secao
              key={secao.id}
              secao={secao}
              expandida={!!expandidas[secao.id]}
              onToggle={() => toggleSecao(secao.id)}
            />
          ))
        )}

        {/* Rodape */}
        <View style={est.rodape}>
          <Text style={est.rodapeVersao}>Sistema de Inventário BOLD — v0.1.0</Text>
          <Text style={est.rodapeSuporte}>
            Dúvidas ou problemas? Contate o administrador do sistema
          </Text>
          <Text style={est.rodapeEmail}>operacoes.claude@bold.net</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const est = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  // Busca
  buscaBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  buscaIcone: { fontSize: 16 },
  buscaInput: {
    flex: 1, fontSize: fontSize.md,
    color: colors.text, minWidth: 0,
  },

  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },

  // Topo
  topoTitulo: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginBottom: spacing.md,
    backgroundColor: '#FFFFFF', borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0',
  },
  topoEmoji:    { fontSize: 32 },
  topoTituloTxt:{ fontSize: fontSize.xl, fontWeight: '800', color: '#0F172A' },
  topoSubTxt:   { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Accordion
  secao: {
    backgroundColor: '#FFFFFF', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#E2E8F0',
    borderLeftWidth: 4, marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  secaoHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
  },
  secaoEmojiBg: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  secaoEmoji:   { fontSize: 20 },
  secaoTitulo:  {
    fontSize: fontSize.md, fontWeight: '700', color: '#0F172A',
    flexWrap: 'wrap',
  },
  secaoChevron: { fontSize: 12, fontWeight: '700', flexShrink: 0 },

  // Corpo do accordion
  secaoCorpo: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: spacing.sm,
  },

  // Texto livre
  texto: {
    fontSize: fontSize.sm, color: '#334155',
    lineHeight: 22, marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },

  // Passos numerados
  passosBox: { marginBottom: spacing.sm },
  passosTitulo: {
    fontSize: fontSize.sm, fontWeight: '700',
    marginBottom: spacing.xs, flexWrap: 'wrap',
  },
  passoLinha: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: spacing.sm, marginBottom: 8,
  },
  passoBullet: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginTop: 1,
  },
  passoBulletTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  passoTxt: {
    fontSize: fontSize.sm, color: '#334155',
    lineHeight: 20, flexWrap: 'wrap',
  },

  // Tabela de permissoes
  tabelaLinha:    { flexDirection: 'row' },
  tabelaCel:      { padding: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
  tabelaCelAcao:  { width: 180, backgroundColor: '#F8FAFC' },
  tabelaCelPerfil:{ width: 72, alignItems: 'center' },
  tabelaHeaderTxt:{ fontSize: 11, fontWeight: '800', color: '#1E40AF', textAlign: 'center' },
  tabelaAcaoTxt:  { fontSize: 11, color: '#334155', flexWrap: 'wrap' },
  tabelaValTxt:   { fontSize: 14, textAlign: 'center' },

  // Sem resultado
  semResultado: { alignItems: 'center', paddingVertical: spacing.xxl },
  semResultadoEmoji: { fontSize: 40, marginBottom: spacing.md },
  semResultadoTxt:   { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' },

  // Rodape
  rodape: {
    marginTop: spacing.xl, paddingTop: spacing.lg,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    alignItems: 'center', gap: 4,
  },
  rodapeVersao:  { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  rodapeSuporte: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  rodapeEmail:   { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },
});
