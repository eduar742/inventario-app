// Tela de Treinamento / Ajuda do sistema.
// Atualizada com: multi-operador, localizacao, papeis novos,
// importacao historica, parcelas, dash consolidado e credenciais.

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';

const SECOES = [
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'usuarios',
    emoji: '👥',
    titulo: 'Cadastro de Usuários',
    cor: '#7C3AED',
    corBg: '#F5F3FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Apenas o ADM pode criar e gerenciar usuários. Acesse pelo menu principal → bloco "Usuários".',
      },
      {
        tipo: 'passos',
        titulo: 'Como criar um novo usuário:',
        itens: [
          'Toque em "+ Novo usuário" no topo da lista.',
          'Preencha o Nome completo.',
          'Informe o E-mail (será o login de acesso).',
          'Defina uma Senha forte (mín. 10 caracteres, mai/min/num/especial).',
          'Selecione o Papel: Gestor, Gerente, Auditor ou Operador.',
          'Vincule as Lojas: toque no seletor para escolher uma ou mais unidades. Use "Selecionar todas" para gerentes/auditores.',
          'Toque em "Salvar".',
        ],
      },
      {
        tipo: 'texto',
        texto: '🔑 Credenciais visíveis: o card de cada usuário exibe o e-mail e a senha cadastrada pelo ADM. Use o campo "Redefinir senha" para atualizar — a nova senha aparece no card imediatamente.',
      },
      {
        tipo: 'passos',
        titulo: 'Como editar ou inativar:',
        itens: [
          'Toque no card do usuário na lista.',
          'Altere os campos necessários (nome, papel, lojas vinculadas).',
          'Para trocar a senha: preencha "Redefinir senha" e salve.',
          'Para inativar: desmarque "Usuário ativo" e salve.',
          'Usuários inativos não conseguem fazer login.',
        ],
      },
      {
        tipo: 'texto',
        texto: '📍 Operador com loja vinculada: ao fazer login, o operador é redirecionado automaticamente para as sessões da(s) sua(s) loja(s) — sem precisar selecionar.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'permissoes',
    emoji: '🔐',
    titulo: 'Grupos e Permissões',
    cor: '#DC2626',
    corBg: '#FEF2F2',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O sistema possui 5 perfis de acesso. Somente o ADM pode alterar dados — os demais têm acesso somente leitura ou contagem.',
      },
      {
        tipo: 'tabela',
        colunas: ['Ação', 'ADM', 'Gestor', 'Gerente', 'Auditor', 'Operador'],
        linhas: [
          ['Realizar inventário (scanner)', '✓', '✓', '✗', '✗', '✓'],
          ['Criar/encerrar sessões', '✓', '✓', '✗', '✗', '✗'],
          ['Aprovar divergências', '✓', '✓', '✗', '✗', '✗'],
          ['Ver dashboards e KPIs', '✓', '✓', '✓', '✓', '✗'],
          ['Exportar relatórios', '✓', '✓', '✓', '✓', '✗'],
          ['Importar planilhas', '✓', '✓', '✗', '✗', '✗'],
          ['Gerenciar usuários', '✓', '✗', '✗', '✗', '✗'],
          ['Excluir sessões concluídas', '✓', '✗', '✗', '✗', '✗'],
          ['Ver credenciais de acesso', '✓', '✗', '✗', '✗', '✗'],
        ],
      },
      {
        tipo: 'texto',
        texto: '⚠️ Gerente e Auditor têm acesso somente leitura — veem dashboards e relatórios, mas não executam ações. Operadores veem apenas as lojas vinculadas ao seu perfil.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sessao',
    emoji: '📋',
    titulo: 'Como Criar uma Sessão de Inventário',
    cor: '#1E40AF',
    corBg: '#EFF6FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Uma sessão organiza o inventário de uma loja em um período. É obrigatório ter o estoque importado antes de criar a sessão.',
      },
      {
        tipo: 'passos',
        titulo: 'Pré-requisitos:',
        itens: [
          'Importe a planilha de estoque (menu → Importar → aba Estoque) para a loja e mês desejados.',
          'O mês aparece automaticamente como opção ao selecionar a loja na criação.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Passo a passo:',
        itens: [
          'Menu → "Inventário" → selecione a loja → "+ Nova sessão".',
          'Selecione a Loja e o Mês de referência.',
          'Defina o Nome (gerado automaticamente se deixar em branco).',
          'Escolha o Tipo: Geral, Parcial, Cíclico ou Recontagem.',
          'Selecione a Natureza: Natureza Venda, Quarentena ou Todas.',
          'Marque "Iniciar imediatamente" para liberar aos operadores.',
          'Toque em "Criar sessão".',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Encerrar a sessão:',
        itens: [
          'ADM/Gestor: toque em "Encerrar sessão" no card da sessão ativa.',
          'Operador: toque em "Finalizar inventário" no Resumo ao terminar de bipar.',
          'Se ainda houver pendentes, o operador pode tocar em "Finalizar agora" — os itens restantes ficam como não bipados.',
          'Após encerramento, o sistema gera as divergências automaticamente.',
          'A sessão passa para "Aguardando aprovação".',
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'contagem',
    emoji: '📦',
    titulo: 'Como Realizar a Contagem',
    cor: '#059669',
    corBg: '#F0FDF4',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O inventário é CEGO: o operador não vê o saldo do sistema antes de contar, garantindo contagens imparciais.',
      },
      {
        tipo: 'passos',
        titulo: 'Como o operador realiza a contagem:',
        itens: [
          'Login → "Inventário" → sistema vai direto para a loja vinculada.',
          'Selecione a sessão "Em andamento".',
          'Aponte a câmera para o QR Code do produto.',
          'Na tela de contagem, informe a Quantidade física encontrada.',
          'Informe a Localização do produto: ex. "Prateleira A3", "Corredor 2" (opcional, mas recomendado).',
          'Toque em "Adicionar ao inventário".',
          'Repita para todos os produtos da sua área.',
          'Ao finalizar, vá ao Resumo e toque em "Finalizar inventário".',
        ],
      },
      {
        tipo: 'texto',
        texto: '📍 Campo Localização: informe onde o produto foi encontrado. Isso permite rastrear produtos distribuídos em múltiplos locais do depósito.',
      },
      {
        tipo: 'passos',
        titulo: 'Bipagem do mesmo SKU em locais diferentes:',
        itens: [
          'Bipe o produto na Prateleira A → informe a localização "A" e a quantidade (ex: 30).',
          'Bipe o mesmo produto na Prateleira B → informe "B" e a quantidade (ex: 80).',
          'O sistema SOMA automaticamente: 30 + 80 = 110 unidades.',
          'Na tela de divergências aparece: "A: 30 + B: 80 = 110".',
          'Não há erro ou conflito — é o comportamento esperado para produtos multi-posição.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Multi-operador na mesma sessão:',
        itens: [
          'Dois ou mais operadores podem bipar produtos diferentes simultaneamente na mesma sessão.',
          'Se um operador já bipou um produto, o segundo operador vê um aviso roxo: "Outro operador já contou X unidades".',
          'Cada operador bipa apenas a sua área — os totais são somados automaticamente.',
          'ADM/Gestor deve encerrar a sessão somente após todos os operadores finalizarem.',
        ],
      },
      {
        tipo: 'texto',
        texto: '📊 Barra de progresso no scanner: exibe Total (SKUs no sistema) · Bipados · Faltam · Leituras em tempo real durante a contagem.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'divergencias',
    emoji: '⚖️',
    titulo: 'Divergências e Aprovação',
    cor: '#D97706',
    corBg: '#FFFBEB',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Após encerrar a sessão, o sistema compara o contado vs o sistema e gera divergências para revisão do gestor/ADM.',
      },
      {
        tipo: 'passos',
        titulo: 'Como revisar divergências:',
        itens: [
          'No card da sessão (status "Aguard. aprovação"), toque em "Revisar divergências".',
          'Cada card mostra: Sistema | Contado | Diferença.',
          'Se o produto foi bipado em múltiplos locais, aparecem as parcelas: "A: 30 + B: 80 = 110".',
          'Para cada divergência: toque em "Aprovar ajuste" ou "Rejeitar".',
          'Ou use o botão azul "Aprovar todo o inventário" para aprovar tudo de uma vez.',
          'Após aprovar/rejeitar todas, toque em "Concluir sessão de inventário".',
        ],
      },
      {
        tipo: 'texto',
        texto: '📌 O sistema NÃO altera o saldo do estoque automaticamente após aprovação. As divergências ficam registradas como histórico para auditoria. O ajuste no ERP é feito manualmente.',
      },
      {
        tipo: 'passos',
        titulo: 'Produtos não bipados:',
        itens: [
          'Produtos que existem no sistema mas não foram contados geram divergência negativa.',
          'São exibidos no card como "NÃO BIPADO" com o saldo do sistema como diferença.',
          'Devem ser aprovados ou rejeitados da mesma forma.',
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'importacao',
    emoji: '📥',
    titulo: 'Importar Planilhas',
    cor: '#D97706',
    corBg: '#FFFBEB',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'A tela de Importar tem duas abas: Estoque (saldo atual do ERP) e Inventário Histórico (inventário realizado antes do app).',
      },
      {
        tipo: 'passos',
        titulo: 'Aba Estoque — colunas obrigatórias:',
        itens: [
          'Natureza — ex: "Natureza Venda" ou "Natureza Quarentena"',
          'Codigo — código único do produto (SKU)',
          'Descricao — nome do produto',
          'UnidadeMedida — ex: UN, CX, KG',
          'SaldoEstoque — quantidade em estoque (número ≥ 0)',
          'CustoUnitario — valor unitário (opcional)',
          'GrupoMaterial — grupo do produto (opcional, ex: ACM, CHAPAS)',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Aba Inventário Histórico — colunas obrigatórias:',
        itens: [
          'Natureza, Codigo, Descricao, UnidadeMedida — igual ao Estoque.',
          'SaldoSistema — saldo que o ERP mostrava na época do inventário.',
          'QuantidadeContada — o que foi fisicamente contado.',
          'CustoUnitario e GrupoMaterial — opcionais.',
          'O sistema cria automaticamente uma sessão já concluída com contagens e divergências.',
          'Useful para ter histórico de inventários anteriores ao app nos dashboards.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como importar (ambas as abas):',
        itens: [
          'Menu → "Importar" → escolha a aba desejada.',
          'Selecione a Loja e o Mês de referência.',
          'Escolha o Modo (Estoque): Completo (zera ausentes) ou Parcial (só atualiza).',
          'Toque em "Selecionar planilha" → escolha o arquivo .xlsx ou .csv.',
          'Toque em "Importar".',
          'Verifique o resultado: linhas com sucesso e erros, se houver.',
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'relatorios',
    emoji: '📈',
    titulo: 'Exportar Relatórios',
    cor: '#16A34A',
    corBg: '#F0FDF4',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O sistema gera relatórios em Excel (xlsx), PDF e CSV. As colunas de localização e parcelas são incluídas automaticamente quando informadas na contagem.',
      },
      {
        tipo: 'passos',
        titulo: 'Relatório por sessão (aba Contagens e Divergências):',
        itens: [
          'Nas Sessões, selecione uma sessão "Concluída" → "Exportar".',
          'Perfil Operacional: sem dados financeiros.',
          'Perfil Financeiro: com custos e valores.',
          'Perfil Completo: todas as abas.',
          'Colunas de localização: Local 1, Local 2, Local 3 ao lado de cada contagem.',
          'Coluna Parcelas: resumo "L01: 30 + L02: 80 = 110" quando há múltiplos locais.',
        ],
      },
      {
        tipo: 'texto',
        texto: '💡 Indicadores financeiros: o relatório mostra Ajuste Líquido (sobra − falta = o que precisa ser ajustado) e o Impacto Bruto (|sobra| + |falta| = total de exposição financeira). São métricas diferentes e complementares.',
      },
      {
        tipo: 'passos',
        titulo: 'Relatório Geral (todas as lojas):',
        itens: [
          'Menu → "Rel. Geral".',
          'Filtre por Natureza e Mês.',
          'Toque em "Gerar e baixar Excel".',
          'Uma aba por natureza, com todas as lojas e indicadores.',
          'Cores: verde ≥ 99%, amarelo ≥ 90%, vermelho < 90% de acuracidade.',
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    emoji: '📊',
    titulo: 'Dashboard e KPIs',
    cor: '#6366F1',
    corBg: '#EEF2FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O Dashboard mostra indicadores em tempo real. Acesse pelo menu → "Dashboard". Disponível para ADM, Gestor, Gerente e Auditor.',
      },
      {
        tipo: 'passos',
        titulo: 'Principais indicadores:',
        itens: [
          'Sessões ativas: quantas estão em andamento agora.',
          'Aguardando aprovação: sessões encerradas pendentes de revisão.',
          'Acuracidade média: % de itens sem divergência (meta: acima de 99%).',
          'Valor total divergente: AJUSTE LÍQUIDO (sobra − falta) que precisa ser feito no ERP.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Os 3 painéis de apuração por sessão:',
        itens: [
          'Apuração de Valor (R$): usa ajuste LÍQUIDO — o que efetivamente precisa ser ajustado.',
          'Apuração de Unidades: usa ajuste LÍQUIDO — unidades para ajustar.',
          'Apuração de Itens (SKU): conta quantos SKUs tiveram QUALQUER diferença (positiva ou negativa).',
          'Diferença em %: |ajuste líquido| ÷ total. Quanto menor, melhor.',
          'Acuracidade: 100% − diferença%. Meta mínima: 99%.',
        ],
      },
      {
        tipo: 'texto',
        texto: '⚠️ Diferença entre Ajuste Líquido e Impacto Bruto: Ajuste Líquido = sobra − falta (o que você precisa registrar no ERP). Impacto Bruto = |sobra| + |falta| (total de exposição). Ex: sobra R$95k e falta R$93k → Ajuste = R$2k, mas o Impacto Bruto = R$188k.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'consolidado',
    emoji: '🏢',
    titulo: 'Consolidado Multi-Loja',
    cor: '#0D9488',
    corBg: '#F0FDFA',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O Dashboard Consolidado mostra todas as lojas em uma única tabela comparativa por período. Menu → "Consolidado".',
      },
      {
        tipo: 'passos',
        titulo: 'Como usar:',
        itens: [
          'Selecione o Mês de competência nos chips no topo.',
          'Filtre por Natureza se necessário.',
          'A coluna amarela "Consolidado" é a SOMA de todas as lojas com inventário no período.',
          'Cada coluna à direita é uma loja individualmente.',
          'Lojas sem inventário no período aparecem em cinza com valores zerados.',
          'O campo "Grupos contados nas lojas" no cabeçalho indica quais grupos de materiais foram inventariados.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como interpretar as linhas:',
        itens: [
          'Ajuste Líquido (em destaque): sobra − falta — o ajuste real necessário.',
          'Falta (−): déficit real de estoque.',
          'Sobra (+): excesso encontrado.',
          'Diferença em %: |ajuste líquido| ÷ total. Quanto menor, melhor.',
          'Acuracidade: 100% − diferença%. Meta mínima: 99%.',
        ],
      },
      {
        tipo: 'texto',
        texto: '📊 Regra do Consolidado: se só L01 fez inventário, o consolidado espelha L01. Se L01 e L02 fizeram, os valores se somam e os percentuais são calculados sobre o total somado das duas lojas.',
      },
    ],
  },
];

// ── Tabela de permissões ──────────────────────────────────────────
function TabelaPermissoes({ colunas, linhas }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: spacing.sm }}>
      <View>
        <View style={est.tabelaLinha}>
          {colunas.map((c, i) => (
            <View key={i} style={[est.tabelaCel, i === 0 ? est.tabelaCelAcao : est.tabelaCelPerfil]}>
              <Text style={est.tabelaHeaderTxt}>{c}</Text>
            </View>
          ))}
        </View>
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

// ── Accordion ─────────────────────────────────────────────────────
function Secao({ secao, expandida, onToggle }) {
  return (
    <View style={[est.secao, { borderLeftColor: secao.cor }]}>
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

      {expandida && (
        <View style={est.secaoCorpo}>
          {secao.conteudo.map((bloco, bi) => {
            if (bloco.tipo === 'texto') {
              return <Text key={bi} style={est.texto}>{bloco.texto}</Text>;
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
              return <TabelaPermissoes key={bi} colunas={bloco.colunas} linhas={bloco.linhas} />;
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

  const secoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return SECOES;
    return SECOES.filter(s => {
      const txt = [
        s.titulo,
        ...s.conteudo.map(b =>
          b.tipo === 'passos'
            ? (b.titulo || '') + ' ' + (b.itens || []).join(' ')
            : b.texto || ''
        ),
      ].join(' ').toLowerCase();
      return txt.includes(q);
    });
  }, [busca]);

  return (
    <SafeAreaView style={est.container}>
      {/* Busca */}
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
        {/* Topo */}
        <View style={est.topoTitulo}>
          <Text style={est.topoEmoji}>📖</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={est.topoTituloTxt}>Guia de Uso</Text>
            <Text style={est.topoSubTxt}>
              {SECOES.length} seções · Toque para expandir
            </Text>
          </View>
        </View>

        {/* Seções */}
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

        {/* Rodapé */}
        <View style={est.rodape}>
          <Text style={est.rodapeVersao}>Sistema de Inventário BOLD — v0.1.0</Text>
          <Text style={est.rodapeSuporte}>Dúvidas? Contate o administrador do sistema</Text>
          <Text style={est.rodapeEmail}>operacoes.claude@bold.net</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const est = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  buscaBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  buscaIcone: { fontSize: 16 },
  buscaInput: { flex: 1, fontSize: fontSize.md, color: colors.text, minWidth: 0 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  topoTitulo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.md, backgroundColor: '#FFFFFF',
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  topoEmoji:     { fontSize: 32 },
  topoTituloTxt: { fontSize: fontSize.xl, fontWeight: '800', color: '#0F172A' },
  topoSubTxt:    { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  secao: {
    backgroundColor: '#FFFFFF', borderRadius: radius.md,
    borderWidth: 1, borderColor: '#E2E8F0',
    borderLeftWidth: 4, marginBottom: spacing.sm, overflow: 'hidden',
  },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  secaoEmojiBg: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  secaoEmoji:   { fontSize: 20 },
  secaoTitulo:  { fontSize: fontSize.md, fontWeight: '700', color: '#0F172A', flexWrap: 'wrap' },
  secaoChevron: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  secaoCorpo: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: spacing.sm,
  },
  texto: { fontSize: fontSize.sm, color: '#334155', lineHeight: 22, marginBottom: spacing.sm, flexWrap: 'wrap' },
  passosBox: { marginBottom: spacing.sm },
  passosTitulo: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: spacing.xs, flexWrap: 'wrap' },
  passoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 8 },
  passoBullet: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  passoBulletTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  passoTxt: { fontSize: fontSize.sm, color: '#334155', lineHeight: 20, flexWrap: 'wrap' },
  tabelaLinha:    { flexDirection: 'row' },
  tabelaCel:      { padding: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
  tabelaCelAcao:  { width: 200, backgroundColor: '#F8FAFC' },
  tabelaCelPerfil:{ width: 72, alignItems: 'center' },
  tabelaHeaderTxt:{ fontSize: 11, fontWeight: '800', color: '#1E40AF', textAlign: 'center' },
  tabelaAcaoTxt:  { fontSize: 11, color: '#334155', flexWrap: 'wrap' },
  tabelaValTxt:   { fontSize: 14, textAlign: 'center' },
  semResultado: { alignItems: 'center', paddingVertical: spacing.xxl },
  semResultadoEmoji: { fontSize: 40, marginBottom: spacing.md },
  semResultadoTxt:   { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center' },
  rodape: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: '#E2E8F0', alignItems: 'center', gap: 4 },
  rodapeVersao:  { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  rodapeSuporte: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  rodapeEmail:   { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },
});
