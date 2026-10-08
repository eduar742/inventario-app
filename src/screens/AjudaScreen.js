// Tela de Treinamento / Ajuda do sistema.
//
// Guia completo de treinamento: passo a passo de cada fluxo com os prints
// reais das telas, o que cada botao faz, quem pode usar e duvidas comuns.
//
// Tipos de bloco suportados em 'conteudo':
//   { tipo: 'texto', texto }
//   { tipo: 'passos', titulo, itens }   -> item = string ou { texto, imagem, legenda }
//   { tipo: 'botoes', titulo, itens }   -> item = { botao, quem, faz }
//   { tipo: 'destaque', variante, texto } -> variante: dica | atencao | importante | info
//   { tipo: 'imagem', fonte, legenda }
//   { tipo: 'tabela', colunas, linhas }
//
// Os prints ficam em assets/ajuda/ e foram capturados com dados ficticios
// (ambiente local de demonstracao, nunca da producao). Ao mudar uma tela,
// lembre de atualizar o print correspondente.

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Image, Modal,
} from 'react-native';

import AppLayout from '../components/AppLayout';
import { colors, spacing, fontSize, radius } from '../theme/colors';

// ── Prints das telas (require precisa ser estatico no bundler) ─────
const IMG = {
  login01: require('../../assets/ajuda/login-01-preenchido.jpg'),
  login02: require('../../assets/ajuda/login-02-erro.jpg'),
  login03: require('../../assets/ajuda/login-03-esqueci.jpg'),
  home01: require('../../assets/ajuda/home-01-adm.jpg'),
  home02: require('../../assets/ajuda/home-02-menu-adm.jpg'),
  home03: require('../../assets/ajuda/home-03-gestor.jpg'),
  home05: require('../../assets/ajuda/home-05-operador.jpg'),
  home06: require('../../assets/ajuda/home-06-menu-operador.jpg'),

  usr01: require('../../assets/ajuda/usr-01-lista.jpg'),
  usr02: require('../../assets/ajuda/usr-02-novo.jpg'),
  usr03: require('../../assets/ajuda/usr-03-selecionar-lojas.jpg'),
  usr05: require('../../assets/ajuda/usr-05-editar-fim.jpg'),
  usr06: require('../../assets/ajuda/usr-06-gerente-leitura.jpg'),

  sessao01: require('../../assets/ajuda/sessao-01-lojas.jpg'),
  sessao02: require('../../assets/ajuda/sessao-02-sessoes-vazia.jpg'),
  sessao03: require('../../assets/ajuda/sessao-03-form-topo.jpg'),
  sessao04: require('../../assets/ajuda/sessao-04-form-preenchido.jpg'),
  sessao05: require('../../assets/ajuda/sessao-05-form-final.jpg'),
  sessao06: require('../../assets/ajuda/sessao-06-criada.jpg'),
  sessao07: require('../../assets/ajuda/sessao-07-gerente-somente-leitura.jpg'),
  sessao08: require('../../assets/ajuda/sessao-08-ao-vivo.jpg'),
  sessao10: require('../../assets/ajuda/sessao-10-revisar-contagens.jpg'),
  sessao11: require('../../assets/ajuda/sessao-11-ajustar-contagem.jpg'),
  sessao12: require('../../assets/ajuda/sessao-12-reabrir.jpg'),
  sessao13: require('../../assets/ajuda/sessao-13-historico.jpg'),
  sessaoAguardando: require('../../assets/ajuda/div-01-sessao-aguardando.jpg'),

  cont01: require('../../assets/ajuda/contagem-01-sessoes.jpg'),
  cont02: require('../../assets/ajuda/contagem-02-scanner.jpg'),
  cont03: require('../../assets/ajuda/contagem-03-digitar-codigo.jpg'),
  cont05: require('../../assets/ajuda/contagem-05-preenchida.jpg'),
  cont08: require('../../assets/ajuda/contagem-08-scanner-completo.jpg'),
  cont09: require('../../assets/ajuda/contagem-09-resumo.jpg'),
  contSoma: require('../../assets/ajuda/contagem-09-soma-parcial.jpg'),
  cont10: require('../../assets/ajuda/contagem-10-pendentes-liberar.jpg'),
  cont12: require('../../assets/ajuda/contagem-12-pendentes-operador.jpg'),
  cont13: require('../../assets/ajuda/contagem-13-scanner-2a.jpg'),
  cont14: require('../../assets/ajuda/contagem-14-resumo-2a.jpg'),
  cont15: require('../../assets/ajuda/contagem-15-pendentes-lider.jpg'),
  cont17: require('../../assets/ajuda/contagem-17-resumo-final.jpg'),

  div03: require('../../assets/ajuda/div-03-gestor-aguardando-adm.jpg'),
  div05: require('../../assets/ajuda/div-05-adm-lista.jpg'),
  div06: require('../../assets/ajuda/div-06-adm-alterar-qtd.jpg'),
  div07: require('../../assets/ajuda/div-07-adm-ajuste-gravado.jpg'),
  div08: require('../../assets/ajuda/div-08-adm-custo.jpg'),
  div09: require('../../assets/ajuda/div-09-adm-aprovada-1.jpg'),
  div12: require('../../assets/ajuda/div-12-gestor-etapa2.jpg'),
  div16: require('../../assets/ajuda/div-16-concluir.jpg'),
  div17: require('../../assets/ajuda/div-17-sessao-concluida-gestor.jpg'),

  imp01: require('../../assets/ajuda/imp-01-estoque-vazio.jpg'),
  imp02: require('../../assets/ajuda/imp-02-estoque-preenchido.jpg'),
  imp04: require('../../assets/ajuda/imp-04-resultado.jpg'),
  imp05: require('../../assets/ajuda/imp-05-historico-vazio.jpg'),
  imp06: require('../../assets/ajuda/imp-06-historico-preenchido.jpg'),
  imp07: require('../../assets/ajuda/imp-07-historico-resultado.jpg'),
  imp08: require('../../assets/ajuda/imp-08-historico-importacoes.jpg'),
  imp09: require('../../assets/ajuda/imp-09-detalhe-importacao.jpg'),

  rel01: require('../../assets/ajuda/rel-01-concluida-adm.jpg'),
  rel02: require('../../assets/ajuda/rel-02-acuracidade.jpg'),
  rel03: require('../../assets/ajuda/rel-03-exportar.jpg'),
  rel04: require('../../assets/ajuda/rel-04-exportar-custom.jpg'),
  rel05: require('../../assets/ajuda/rel-05-nota-adm.jpg'),
  rel06: require('../../assets/ajuda/rel-06-geral-topo.jpg'),
  rel07: require('../../assets/ajuda/rel-07-geral-sessao-lista.jpg'),

  dash01: require('../../assets/ajuda/dash-01-topo.jpg'),
  dash02: require('../../assets/ajuda/dash-02-acuracidade.jpg'),
  dash03: require('../../assets/ajuda/dash-03-top-divergencias.jpg'),
  dash04: require('../../assets/ajuda/dash-04-sessoes-ativas.jpg'),
  dash05: require('../../assets/ajuda/dash-05-filtros.jpg'),
  dash06: require('../../assets/ajuda/dash-06-por-loja.jpg'),
  dash07: require('../../assets/ajuda/dash-07-historico-loja.jpg'),
  dash08: require('../../assets/ajuda/dash-08-historico-sessoes.jpg'),

  cons02: require('../../assets/ajuda/cons-02-agosto.jpg'),

  aud01: require('../../assets/ajuda/aud-01-painel.jpg'),
  aud02: require('../../assets/ajuda/aud-02-alertas.jpg'),
  aud03: require('../../assets/ajuda/aud-03-resumo.jpg'),
  aud04: require('../../assets/ajuda/aud-04-ferramentas.jpg'),
  aud05: require('../../assets/ajuda/aud-05-participacao.jpg'),
};

const SECOES = [
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'inicio',
    emoji: '🚀',
    titulo: 'Primeiros Passos',
    resumo: 'Login, tela inicial, menu e o ciclo completo de um inventário',
    papeis: ['Todos'],
    cor: colors.primary,
    corBg: colors.primarySoft,
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Bem-vindo ao Sistema de Inventário BOLD. Este guia mostra, tela por tela, como usar cada função do app. Cada seção indica logo abaixo do título para quais perfis ela se aplica. Toque em qualquer print para ver a tela ampliada.',
      },
      {
        tipo: 'passos',
        titulo: 'O ciclo completo de um inventário (visão geral):',
        itens: [
          'ADM importa a planilha de estoque do ERP para a loja e o mês (seção "Importar Planilhas").',
          'ADM cria a sessão de inventário e já a deixa "Em andamento" (seção "Sessões de Inventário").',
          'Operadores bipam os produtos — 1ª contagem, sem ver o saldo do sistema (inventário cego).',
          'Itens que divergiram vão para a 2ª contagem, liberada pelo Líder ou Gestor.',
          'Se a 2ª contagem não bater com a 1ª, o Líder faz a 3ª contagem (desempate).',
          'A sessão encerra e o sistema gera as divergências.',
          'ADM revisa e aprova (1ª etapa); depois o Gestor aprova (2ª etapa).',
          'A sessão é concluída e os resultados aparecem nos relatórios e dashboards.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Como entrar no sistema:',
        itens: [
          {
            texto: 'Abra o app, digite seu e-mail e sua senha e toque em "Entrar". O ícone de olho no campo de senha mostra/oculta o que você digitou.',
            imagem: IMG.login01,
            legenda: 'Tela de login',
          },
          {
            texto: 'Se aparecer "Email ou senha invalidos", confira o que foi digitado. Depois de 5 tentativas erradas o acesso fica bloqueado por 15 minutos (proteção de segurança).',
            imagem: IMG.login02,
            legenda: 'Erro de login',
          },
          {
            texto: 'Esqueceu a senha? Toque em "Esqueceu sua senha?" — a senha é redefinida pelo seu gestor ou pelo administrador do sistema.',
            imagem: IMG.login03,
            legenda: 'Recuperar senha',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'atencao',
        texto: 'Mensagem "Sem conexao com o servidor"? Verifique a internet do celular (Wi-Fi ou dados). O app precisa de conexão para registrar as contagens.',
      },
      {
        tipo: 'passos',
        titulo: 'A tela inicial ("Início"):',
        itens: [
          {
            texto: 'Depois do login aparece "O que deseja fazer?" com um card para cada função que o seu perfil pode usar. O ADM vê todos os cards.',
            imagem: IMG.home01,
            legenda: 'Tela inicial do ADM',
          },
          {
            texto: 'O Gestor vê Inventário, Dashboard, Consolidado e Ajuda.',
            imagem: IMG.home03,
            legenda: 'Tela inicial do Gestor',
          },
          {
            texto: 'O Operador e o Líder veem apenas Inventário e Ajuda.',
            imagem: IMG.home05,
            legenda: 'Tela inicial do Operador',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'O menu lateral:',
        itens: [
          {
            texto: 'Toque no botão "☰" (canto superior esquerdo) para abrir o menu. Ele lista as mesmas funções dos cards, mais "Ajuda" e "Sair" no rodapé.',
            imagem: IMG.home02,
            legenda: 'Menu lateral aberto (ADM)',
          },
          {
            texto: 'O item "Dashboard" mostra um número vermelho quando há sessões aguardando aprovação (para ADM, Gestor e Gerente).',
            imagem: IMG.home06,
            legenda: 'Menu lateral do Operador',
          },
          'Para sair do sistema, toque em "Sair" (em vermelho) no rodapé do menu.',
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'permissoes',
    emoji: '🔐',
    titulo: 'Perfis e Permissões',
    resumo: 'O que cada um dos 6 perfis pode fazer',
    papeis: ['Todos'],
    cor: colors.danger,
    corBg: colors.dangerSoft,
    conteudo: [
      {
        tipo: 'texto',
        texto: 'O sistema tem 6 perfis de acesso. Cada usuário tem um perfil e uma ou mais lojas vinculadas. Legenda da tabela: ✓ pode usar · 👁 só visualiza · ✗ não tem acesso.',
      },
      {
        tipo: 'tabela',
        colunas: ['Ação', 'ADM', 'Gestor', 'Gerente', 'Auditor', 'Operador', 'Líder'],
        linhas: [
          ['Bipar na 1ª e 2ª contagem', '✓', '✓', '✗', '✗', '✓', '✗'],
          ['Fazer a 3ª contagem (desempate)', '✓', '✗', '✗', '✗', '✗', '✓'],
          ['Liberar a 2ª contagem', '✗', '✓', '✗', '✗', '✗', '✓'],
          ['Criar sessão', '✓', '✗', '✗', '✗', '✗', '✗'],
          ['Encerrar sessão', '✓', '✓', '✗', '✗', '✗', '✗'],
          ['Reabrir / cancelar / excluir sessão', '✓', '✗', '✗', '✗', '✗', '✗'],
          ['Acompanhar sessão ao vivo', '✓', '✓', '✓', '✓', '✗', '✓'],
          ['Revisar e aprovar divergências', '✓', '✓', '✗', '✗', '✗', '✗'],
          ['Ajustar quantidade / custo na divergência', '✓', '✗', '✗', '✗', '✗', '✗'],
          ['Ver quantidades brutas nas divergências', '✓', '✗', '✗', '✗', '✗', '✗'],
          ['Dashboard e Consolidado', '✓', '✓', '✓', '✓', '✗', '✗'],
          ['Relatório Geral (todas as lojas)', '✓', '✗', '✓', '✓', '✗', '✗'],
          ['Exportar relatório da sessão', '✓', '✓', '✓', '✓', '✗', '✓'],
          ['Importar planilhas', '✓', '✗', '👁', '✗', '✗', '✗'],
          ['Usuários', '✓', '✗', '👁', '✗', '✗', '✗'],
          ['Auditoria (painel)', '✓', '✗', '✓', '✓', '✗', '✗'],
          ['Exportar audit log', '✓', '✗', '✗', '✗', '✗', '✗'],
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Resumo de cada perfil:',
        itens: [
          { botao: 'ADM', quem: 'Administrador do sistema', faz: 'Faz tudo: importa planilhas, cria e gerencia sessões, ajusta e aprova divergências (1ª etapa), cadastra usuários e exporta o audit log.' },
          { botao: 'Gestor', quem: 'Responsável pela loja', faz: 'Conta produtos, libera a 2ª contagem, encerra sessões e dá a aprovação final (2ª etapa) das divergências da SUA loja. Na aprovação vê apenas o impacto financeiro (R$), não as quantidades.' },
          { botao: 'Gerente', quem: 'Acompanhamento gerencial', faz: 'Enxerga as telas do sistema (Inventário, Dashboard, Consolidado, Relatório Geral, Importar, Usuários, Auditoria) sem executar ações. Não acessa Divergências.' },
          { botao: 'Auditor', quem: 'Auditoria / compliance', faz: 'Somente leitura de dashboards, relatórios e do painel de Auditoria.' },
          { botao: 'Operador', quem: 'Quem conta no depósito', faz: 'Bipa os produtos na 1ª e na 2ª contagem das lojas vinculadas ao seu perfil. Ao entrar, vai direto para a sua loja.' },
          { botao: 'Líder', quem: 'Responsável pelo desempate', faz: 'Faz exclusivamente a 3ª contagem (desempate) e pode liberar a 2ª contagem. Não bipa na 1ª nem na 2ª rodada. Ao final vê a acuracidade da sessão.' },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'importante',
        texto: 'Inventário cego: o Operador nunca vê o saldo do sistema antes de contar. Na aprovação, só o ADM vê as quantidades brutas (Sistema / Contado / Diferença); o Gestor vê apenas o impacto financeiro. Isso evita que a contagem seja "ajustada" para bater.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'usuarios',
    emoji: '👥',
    titulo: 'Cadastro de Usuários',
    resumo: 'Criar, editar, inativar e excluir usuários',
    papeis: ['ADM', 'Gerente (leitura)'],
    cor: '#7C3AED',
    corBg: '#F5F3FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Apenas o ADM cria e altera usuários. Acesse pelo card "Usuários" da tela inicial ou pelo menu lateral.',
      },
      {
        tipo: 'passos',
        titulo: 'Como criar um novo usuário:',
        itens: [
          {
            texto: 'Na tela Usuários, toque em "+ Novo usuario". A lista mostra cada usuário com o e-mail, as lojas vinculadas e o perfil (em cor).',
            imagem: IMG.usr01,
            legenda: 'Lista de usuários (ADM)',
          },
          {
            texto: 'Preencha Nome, E-mail (será o login) e Senha (mínimo 10 caracteres com maiúscula, minúscula, número e caractere especial). Escolha o Papel: Gestor, Gerente, Auditor, Operador ou Líder.',
            imagem: IMG.usr02,
            legenda: 'Formulário "Novo usuario"',
          },
          {
            texto: 'Em "Lojas vinculadas", toque no seletor e marque as lojas. "Selecionar todas" marca as 17 de uma vez; "Limpar tudo" desmarca. Toque em "Confirmar".',
            imagem: IMG.usr03,
            legenda: 'Seleção de lojas',
          },
          'Toque em "Salvar". O usuário já pode entrar no app.',
        ],
      },
      {
        tipo: 'destaque',
        variante: 'dica',
        texto: 'Qual loja vincular? Operador e Líder: a(s) loja(s) onde vão contar. Gestor: a loja pela qual responde (é por ela que ele aprova divergências). Gerente e Auditor: deixe vazio para enxergar todas.',
      },
      {
        tipo: 'passos',
        titulo: 'Como editar, trocar a senha ou inativar:',
        itens: [
          {
            texto: 'Toque no card do usuário. Altere nome, papel ou lojas. Para trocar a senha, preencha "Redefinir senha" (em branco mantém a atual). Para bloquear o acesso, desmarque "Usuario ativo". Toque em "Salvar".',
            imagem: IMG.usr05,
            legenda: 'Editar usuário',
          },
          'Usuários inativos aparecem com "(inativo)" e não conseguem fazer login.',
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Botões desta tela:',
        itens: [
          { botao: '+ Novo usuario', quem: 'ADM', faz: 'Abre o formulário de cadastro.' },
          { botao: 'Excluir usuário', quem: 'ADM', faz: 'Exclui definitivamente após confirmação. Usuários que já registraram contagens, sessões ou importações não podem ser excluídos (para manter a auditoria) — inative-os em vez disso.' },
          { botao: 'Salvar / Cancelar', quem: 'ADM', faz: 'Grava ou descarta as alterações do formulário.' },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Visão do Gerente (somente leitura):',
        itens: [
          {
            texto: 'O Gerente vê a lista completa com o aviso "Modo somente leitura", mas não consegue criar, editar nem excluir.',
            imagem: IMG.usr06,
            legenda: 'Usuários — visão do Gerente',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'importante',
        texto: 'Por segurança, a senha de um usuário nunca é exibida no app. Se alguém esquecer, o ADM define uma nova em "Redefinir senha".',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'importacao',
    emoji: '📥',
    titulo: 'Importar Planilhas',
    resumo: 'Carregar o estoque do ERP e inventários antigos',
    papeis: ['ADM', 'Gerente (leitura)'],
    cor: colors.warning,
    corBg: colors.warningSoft,
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Antes de criar uma sessão, o estoque do mês precisa estar importado — é com esse saldo que o sistema compara as contagens. A tela Importar tem duas abas: "📦 Estoque" e "📋 Inventário Histórico".',
      },
      {
        tipo: 'passos',
        titulo: 'Importar o estoque do ERP (aba Estoque):',
        itens: [
          {
            texto: 'Menu → "Importar". A aba "Estoque" já vem selecionada e mostra as colunas esperadas.',
            imagem: IMG.imp01,
            legenda: 'Aba Estoque',
          },
          {
            texto: 'Selecione a Loja, toque no Mês de referência (01 a 12 do ano corrente) e escolha o Modo. Depois toque em "Toque para selecionar .xlsx / .xls / .csv" e escolha o arquivo.',
            imagem: IMG.imp02,
            legenda: 'Loja, mês, modo e arquivo selecionados',
          },
          {
            texto: 'Toque em "Importar estoque". O resultado mostra quantas linhas foram importadas e quais tiveram erro (com o número da linha).',
            imagem: IMG.imp04,
            legenda: 'Importação concluída',
          },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Modo de importação:',
        itens: [
          { botao: 'Completo', quem: 'Recomendado no inventário geral', faz: 'Processa a planilha inteira e ZERA os produtos que não estão nela.' },
          { botao: 'Parcial', quem: 'Correções pontuais', faz: 'Atualiza somente os produtos que estão no arquivo; os demais ficam como estão.' },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Colunas da planilha de estoque:',
        itens: [
          'Natureza — ex: "Natureza Venda" ou "Natureza Quarentena"',
          'Codigo — código único do produto (SKU)',
          'Descricao — nome do produto',
          'UnidadeMedida — ex: UN, CX, KG, ML',
          'SaldoEstoque — quantidade em estoque (número ≥ 0)',
          'CustoUnitario — valor unitário (opcional, mas necessário para o impacto financeiro)',
          'GrupoMaterial — grupo do produto (opcional, ex: CHAPAS, COLAS) — habilita filtros nos dashboards',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Importar um inventário antigo (aba Inventário Histórico):',
        itens: [
          {
            texto: 'Use para trazer inventários feitos antes do app (em planilha), para que apareçam nos dashboards e no histórico.',
            imagem: IMG.imp05,
            legenda: 'Aba Inventário Histórico',
          },
          {
            texto: 'Selecione Loja, Mês, Natureza (opcional) e o arquivo. O nome da sessão é gerado automaticamente se ficar em branco. Toque em "Importar inventario historico".',
            imagem: IMG.imp06,
            legenda: 'Formulário preenchido',
          },
          {
            texto: 'O sistema cria uma sessão já concluída, com as contagens e as divergências.',
            imagem: IMG.imp07,
            legenda: 'Inventário histórico importado',
          },
          'Colunas: Natureza, Codigo, Descricao, UnidadeMedida, SaldoSistema (saldo do ERP na época), QuantidadeContada (o que foi contado), CustoUnitario e GrupoMaterial (opcionais).',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Histórico de importações:',
        itens: [
          {
            texto: 'Toque em "Ver historico de importacoes" para ver todas as importações com status SUCESSO (verde), PARCIAL (laranja) ou FALHOU (vermelho). Use "Filtrar" para escolher a loja.',
            imagem: IMG.imp08,
            legenda: 'Histórico de importações',
          },
          {
            texto: 'Toque em uma importação para ver os detalhes: loja, mês, modo, data e a lista de erros por linha.',
            imagem: IMG.imp09,
            legenda: 'Detalhe de uma importação',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'info',
        texto: 'Gerente: acessa a tela Importar para consultar o formato e o histórico, mas no lugar do botão de importar aparece "Seu perfil tem acesso somente leitura".',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'sessao',
    emoji: '📋',
    titulo: 'Sessões de Inventário',
    resumo: 'Criar, acompanhar, encerrar, reabrir e cancelar sessões',
    papeis: ['ADM', 'Gestor', 'Gerente (leitura)'],
    cor: '#1E40AF',
    corBg: '#EFF6FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Uma sessão organiza o inventário de uma loja, de um mês e de uma natureza. Ela passa pelos status: EM ANDAMENTO (contando) → AGUARD. APROVACAO (divergências em revisão) → CONCLUIDA. Uma sessão também pode ser CANCELADA pelo ADM.',
      },
      {
        tipo: 'passos',
        titulo: 'Como criar uma sessão (ADM):',
        itens: [
          {
            texto: 'Menu → "Inventário" → selecione a loja. Use a busca ou alterne entre grade (⊞) e lista (☰).',
            imagem: IMG.sessao01,
            legenda: 'Seleção de loja',
          },
          {
            texto: 'Na tela Sessões, toque em "+ Nova sessao".',
            imagem: IMG.sessao02,
            legenda: 'Sessões da loja com o botão "+ Nova sessao"',
          },
          {
            texto: 'O topo do formulário explica o que é necessário. Toque em "Toque para selecionar a loja".',
            imagem: IMG.sessao03,
            legenda: 'Formulário "Nova sessao"',
          },
          {
            texto: 'Os meses já importados aparecem como botões — toque no mês. O nome é sugerido automaticamente (ex: "Inventario Setembro 2026 - L01").',
            imagem: IMG.sessao04,
            legenda: 'Loja e mês selecionados',
          },
          {
            texto: 'Escolha o Tipo (Geral, Parcial, Cíclico ou Recontagem) e a Natureza (obrigatória — sem ela o saldo misturaria Venda e Quarentena). Deixe marcado "Iniciar imediatamente" para liberar a contagem na hora. Toque em "Criar sessao".',
            imagem: IMG.sessao05,
            legenda: 'Tipo, natureza e "Iniciar imediatamente"',
          },
          {
            texto: 'A sessão aparece em "Ativas" com o status EM ANDAMENTO, a barra de progresso e os contadores Total · Contados · Faltam.',
            imagem: IMG.sessao06,
            legenda: 'Sessão criada',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'dica',
        texto: 'Ainda não importou o estoque? Anexe a planilha direto no campo "Planilha de referencia" do formulário: o botão vira "Importar e criar sessao" e faz as duas coisas em um passo.',
      },
      {
        tipo: 'destaque',
        variante: 'importante',
        texto: 'Cada sessão tem o SEU estoque, fixado no momento em que é criada (os itens da planilha anexada, ou o estoque do mês/natureza). Importar depois a planilha de outra sessão do mesmo mês — mesmo em modo Completo — não altera sessões já criadas. Ex: Acrílico e ACM no mesmo mês ficam independentes.',
      },
      {
        tipo: 'destaque',
        variante: 'atencao',
        texto: 'Se não houver estoque importado para o mês, o sistema exige marcar "Criar sem estoque importado". Sem saldo para comparar, as contagens viram divergência — evite isso em inventários reais.',
      },
      {
        tipo: 'botoes',
        titulo: 'Tipos de sessão:',
        itens: [
          { botao: 'Geral', quem: 'Mais comum', faz: 'Todos os produtos da loja.' },
          { botao: 'Parcial', quem: '', faz: 'Um subconjunto de produtos (categorias específicas).' },
          { botao: 'Ciclico', quem: '', faz: 'Rodízio periódico de produtos.' },
          { botao: 'Recontagem', quem: '', faz: 'Verificação de divergências anteriores.' },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Botões do card da sessão — sessão EM ANDAMENTO:',
        itens: [
          { botao: 'Tocar no card', quem: 'ADM, Gestor, Operador', faz: 'Abre o scanner para bipar (1ª contagem). Para o Líder, mostra que ele só faz o desempate.' },
          { botao: 'Ver itens pendentes', quem: 'ADM, Gestor, Operador, Líder', faz: 'Lista o que falta bipar e o que aguarda 2ª/3ª contagem.' },
          { botao: 'Acompanhar ao vivo', quem: 'Todos, exceto Operador', faz: 'Progresso e feed das últimas bipagens, atualizado a cada 15 s.' },
          { botao: 'Encerrar sessao', quem: 'ADM, Gestor', faz: 'Pede confirmação, encerra a contagem e gera as divergências. Operadores não poderão mais bipar.' },
          { botao: 'Cancelar sessao', quem: 'ADM', faz: 'Cancela a sessão após confirmação. Não pode ser desfeito.' },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Botões do card — sessão AGUARD. APROVACAO:',
        itens: [
          { botao: 'Revisar divergencias', quem: 'ADM, Gestor', faz: 'Abre a tela de aprovação das divergências.' },
          { botao: 'Revisar contagens (ADM)', quem: 'ADM', faz: 'Lista todas as contagens por produto e permite corrigir uma contagem com justificativa.' },
          { botao: 'Reabrir sessao (ADM)', quem: 'ADM', faz: 'Volta a sessão para EM ANDAMENTO (exige motivo).' },
          { botao: 'Definir estoque da sessao (ADM)', quem: 'ADM', faz: 'Envia a planilha (modelo do sistema ou export do ERP) com os itens e saldos DESTA sessão. Use para corrigir uma sessão cujo estoque ficou errado. As contagens são mantidas e, se nada foi aprovado ainda, as divergências são recalculadas.' },
          { botao: 'Historico', quem: 'Todos, exceto Operador', faz: 'Todas as contagens de cada produto, rodada a rodada.' },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Botões do card — sessão CONCLUIDA:',
        itens: [
          { botao: 'Acuracidade da Sessao', quem: 'Todos, exceto Operador', faz: 'Indicadores finais: acuracidade, valor divergente e divergências.' },
          { botao: 'Divergencias', quem: 'ADM, Gestor', faz: 'Consulta as divergências (somente leitura).' },
          { botao: 'Exportar', quem: 'Todos, exceto Operador', faz: 'Gera o relatório em Excel, PDF ou CSV.' },
          { botao: 'Registrar alteracao (ADM)', quem: 'ADM', faz: 'Adiciona uma nota explicando uma alteração feita depois da conclusão.' },
          { botao: 'Excluir sessao (ADM)', quem: 'ADM', faz: 'Remove a sessão concluída após confirmação.' },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Acompanhar o inventário em tempo real:',
        itens: [
          {
            texto: 'No card de uma sessão EM ANDAMENTO, toque em "Acompanhar ao vivo". A tela mostra a rodada atual, o % de progresso, Total · Contados · Faltam · Bipagens e o feed das últimas contagens (produto, quantidade, operador e horário).',
            imagem: IMG.sessao08,
            legenda: 'Acompanhamento ao vivo',
          },
          'Use a busca para procurar um SKU ou descrição no feed. A tela se atualiza sozinha a cada 15 segundos.',
          {
            texto: 'O Gerente vê o card com "Acompanhar ao vivo", mas sem os botões de ação.',
            imagem: IMG.sessao07,
            legenda: 'Card da sessão — visão do Gerente',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Encerrar a sessão:',
        itens: [
          'Normalmente a sessão encerra sozinha quando a última rodada termina e todos os produtos esperados foram bipados.',
          'ADM ou Gestor podem encerrar manualmente pelo botão "Encerrar sessao" (com confirmação).',
          'Se só restarem produtos nunca bipados, ADM ou Gestor veem "Finalizar inventario agora" no Resumo — esses itens viram divergência "não bipado".',
          {
            texto: 'Após o encerramento a sessão fica AGUARD. APROVACAO, com os botões de revisão.',
            imagem: IMG.sessaoAguardando,
            legenda: 'Sessão aguardando aprovação (ADM)',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'importante',
        texto: 'Trava contra encerramento prematuro: se algum produto estiver aguardando 2ª ou 3ª contagem, o sistema NÃO deixa encerrar a sessão — nem pelo ADM. Termine essa contagem primeiro; um encerramento no meio do desempate geraria divergências erradas.',
      },
      {
        tipo: 'passos',
        titulo: 'Revisar e corrigir contagens (ADM):',
        itens: [
          {
            texto: 'Em uma sessão AGUARD. APROVACAO, toque em "Revisar contagens (ADM)". Cada produto lista suas contagens (rodada, operador, horário, localização e quantidade).',
            imagem: IMG.sessao10,
            legenda: 'Revisar contagens',
          },
          {
            texto: 'Toque em "Editar ›" na contagem errada, informe a nova quantidade e a justificativa e toque em "Salvar ajuste". O botão "?" no topo mostra o histórico de todos os ajustes.',
            imagem: IMG.sessao11,
            legenda: 'Ajustar uma contagem',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Reabrir uma sessão encerrada por engano (ADM):',
        itens: [
          {
            texto: 'No card da sessão AGUARD. APROVACAO, toque em "Reabrir sessao (ADM)", escreva o motivo (mínimo 5 caracteres) e toque em "Reabrir sessao".',
            imagem: IMG.sessao12,
            legenda: 'Reabrir sessão',
          },
          'A sessão volta para EM ANDAMENTO: todas as bipagens continuam valendo.',
          'As divergências geradas são descartadas e recalculadas quando a sessão for encerrada de novo.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Histórico de contagens:',
        itens: [
          {
            texto: 'O botão "Historico" mostra cada produto com todas as contagens (1ª azul, 2ª laranja, 3ª vermelha), o operador, a data e o valor final. Use a busca por SKU ou descrição.',
            imagem: IMG.sessao13,
            legenda: 'Histórico de contagens',
          },
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'contagem',
    emoji: '📦',
    titulo: 'Como Realizar a Contagem',
    resumo: 'Bipar, 2ª contagem, desempate e produtos em vários locais',
    papeis: ['Operador', 'Líder', 'Gestor', 'ADM'],
    cor: '#059669',
    corBg: '#F0FDF4',
    conteudo: [
      {
        tipo: 'destaque',
        variante: 'importante',
        texto: 'O inventário é CEGO: você não vê o saldo do sistema antes de contar. Conte fisicamente e digite exatamente o que encontrou — é isso que revela as divergências reais.',
      },
      {
        tipo: 'passos',
        titulo: '1ª contagem — passo a passo do operador:',
        itens: [
          'Login → "Inventário". Se você tem uma loja vinculada, o app vai direto para as sessões dela.',
          {
            texto: 'Toque no card da sessão EM ANDAMENTO para abrir o scanner.',
            imagem: IMG.cont01,
            legenda: 'Sessões da loja (visão do Operador)',
          },
          {
            texto: 'Aponte a câmera para o QR Code do produto. "Flash OFF/ON" liga a lanterna em locais escuros.',
            imagem: IMG.cont02,
            legenda: 'Scanner',
          },
          {
            texto: 'Etiqueta danificada? Toque em "Digitar codigo manualmente", digite o código e toque em "Confirmar".',
            imagem: IMG.cont03,
            legenda: 'Digitar código manualmente',
          },
          {
            texto: 'Na tela do produto, digite a Quantidade contada e a Localização (ex: "A3", "Corredor 2"). Em algumas lojas a localização é obrigatória (selo "Obrigatório"). O botão "Scan" lê uma etiqueta de localização.',
            imagem: IMG.cont05,
            legenda: 'Quantidade e localização preenchidas',
          },
          'Toque em "Adicionar ao inventario". A contagem é enviada na hora e você volta ao scanner.',
          {
            texto: 'Repita para todos os produtos da sua área. A barra no rodapé mostra Total · Bipados · Faltam · Leituras.',
            imagem: IMG.cont08,
            legenda: 'Todos bipados — botão "Finalizar 1ª"',
          },
          {
            texto: 'Ao terminar, toque em "Finalizar 1ª". O Resumo mostra os itens que divergiram e vão para a 2ª contagem.',
            imagem: IMG.cont09,
            legenda: 'Resumo da 1ª contagem',
          },
          'Toque em "Voltar para sessoes" (ou "Voltar" no scanner) ao terminar — isso avisa o sistema que você saiu, o que permite liberar a 2ª contagem.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Mesmo produto em vários locais (soma de parciais):',
        itens: [
          'Bipe o produto na Prateleira A → informe a localização "Prateleira A" e a quantidade (ex: 120).',
          {
            texto: 'Bipe o mesmo produto na Prateleira B. Aparece o aviso verde "Produto ja registrado nesta rodada": informe só a quantidade DESTE local (ex: 45).',
            imagem: IMG.contSoma,
            legenda: 'Aviso de soma de parcial',
          },
          'Ao tocar em "Adicionar ao inventario", o app pergunta "Voce ja contou este produto nesta rodada". Toque em "Sim, outro local — somar" para somar: 120 + 45 = 165.',
          'Se você está apenas recontando a MESMA pilha, toque em "Nao, foi recontagem" — nada é somado. (Antes, recontar a mesma pilha somava a quantidade e inflava a contagem.)',
        ],
      },
      {
        tipo: 'destaque',
        variante: 'atencao',
        texto: 'Bipar de novo um produto que você já contou na rodada SOMA as quantidades. Use isso só para pilhas em locais diferentes. Toques repetidos no botão "Adicionar" não duplicam mais a contagem.',
      },
      {
        tipo: 'botoes',
        titulo: 'Avisos que podem aparecer na tela de contagem:',
        itens: [
          { botao: 'Produto nao cadastrado', quem: 'Código não encontrado', faz: 'O código não existe na base. Será registrado só o código e a quantidade — avise o ADM.' },
          { botao: 'Localização diferente da esperada', quem: 'Local divergente', faz: 'O produto está cadastrado em outro local. Toque em "Usar …" para o local cadastrado ou "Confirmar …" para o que você digitou.' },
          { botao: 'Já contado por outro operador', quem: 'Multi-operador', faz: 'Outra pessoa já contou esse item no mesmo local. Toque em "Revisar" para conferir ou "Confirmar mesmo assim" se for outro lugar.' },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Liberar a 2ª contagem (Líder ou Gestor):',
        itens: [
          'A 2ª contagem não começa sozinha: depois da 1ª rodada, o Líder ou o Gestor precisa liberá-la.',
          'Só dá para liberar quando todos os operadores saíram do scanner. Enquanto houver alguém bipando, o botão fica desabilitado com o aviso "Aguardando X operador(es) saírem da sessão".',
          {
            texto: 'Em "Ver itens pendentes", toque em "Liberar 2ª contagem".',
            imagem: IMG.cont10,
            legenda: 'Pronto para liberar',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: '2ª contagem (recontagem):',
        itens: [
          {
            texto: 'Depois de liberada, o operador abre "Ver itens pendentes" e toca em "Iniciar 2ª contagem".',
            imagem: IMG.cont12,
            legenda: '"Iniciar 2ª contagem"',
          },
          {
            texto: 'O scanner mostra a lista dos produtos a recontar ("Ver todos" abre a lista completa; os já bipados ficam com a bolinha verde). A barra do rodapé conta só os itens desta rodada. Bipe e conte cada um de novo, sem olhar a contagem anterior.',
            imagem: IMG.cont13,
            legenda: 'Scanner na 2ª contagem — 1 de 2 itens bipados',
          },
          {
            texto: 'Toque em "Finalizar 2ª". Se a 2ª bateu com a 1ª, o valor está confirmado. Se não bateu, o item vai para o desempate.',
            imagem: IMG.cont14,
            legenda: 'Resumo da 2ª contagem',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: '3ª contagem — desempate (Líder):',
        itens: [
          {
            texto: 'O Líder abre "Ver itens pendentes" e toca em "Iniciar 3ª contagem (desempate)". Para os outros perfis aparece "Apenas um usuario com papel Lider pode fazer o desempate".',
            imagem: IMG.cont15,
            legenda: 'Pendentes — visão do Líder',
          },
          'Bipe e conte o item, depois toque em "Finalizar 3ª".',
          {
            texto: 'Quando não resta nada pendente, a sessão encerra e o Resumo mostra a acuracidade, o valor divergente e as divergências para aprovação.',
            imagem: IMG.cont17,
            legenda: 'Inventário finalizado',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'info',
        texto: 'Regra das 3 contagens: 1ª bate com o sistema → OK. 1ª diverge → 2ª contagem. 2ª igual à 1ª → valor confirmado. 2ª diferente da 1ª → 3ª contagem (Líder). O valor final é a moda entre as três (ou a mais próxima do sistema).',
      },
      {
        tipo: 'passos',
        titulo: 'Retomar itens pendentes a qualquer momento:',
        itens: [
          'Em Sessões, toque em "Ver itens pendentes" no card da sessão.',
          'A tela separa: "Itens que faltou bipar" (vermelho), "Aguardando 2ª contagem" (laranja) e "Aguardando 3ª contagem — desempate" (azul).',
          'Cada grupo tem o botão que abre o scanner já na rodada certa ("Bipar itens que faltaram", "Iniciar 2ª contagem", "Iniciar 3ª contagem").',
          'A lista se atualiza sozinha a cada 15 segundos enquanto a 2ª contagem aguarda liberação.',
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'divergencias',
    emoji: '⚖️',
    titulo: 'Divergências e Aprovação',
    resumo: 'Aprovação em duas etapas: ADM primeiro, depois Gestor',
    papeis: ['ADM', 'Gestor'],
    cor: '#D97706',
    corBg: '#FFFBEB',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Depois que a sessão encerra, o sistema compara o contado com o saldo do sistema e gera uma divergência para cada produto diferente. Só ADM e o Gestor da loja acessam esta tela.',
      },
      {
        tipo: 'botoes',
        titulo: 'Status de uma divergência:',
        itens: [
          { botao: 'PENDENTE', quem: 'Etapa 1 — com o ADM', faz: 'Acabou de ser gerada e aguarda a revisão do ADM.' },
          { botao: 'AGUARDANDO GESTOR', quem: 'Etapa 2 — com o Gestor', faz: 'O ADM aprovou; falta a aprovação final do Gestor.' },
          { botao: 'APROVADA', quem: 'Finalizada', faz: 'Aprovada nas duas etapas.' },
          { botao: 'REJEITADA', quem: 'Finalizada', faz: 'Rejeitada em qualquer etapa — o saldo do sistema é mantido.' },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Etapa 1 — revisão do ADM:',
        itens: [
          {
            texto: 'No card da sessão AGUARD. APROVACAO, toque em "Revisar divergencias". O ADM vê Sistema · Contado · Diferença, as parcelas por localização e o custo de cada item.',
            imagem: IMG.div05,
            legenda: 'Divergências — visão do ADM',
          },
          {
            texto: 'Encontrou a explicação da diferença (pedido em trânsito, item sem custo, produto fora da planilha)? Toque em "Alterar quantidade (ADM)", informe a quantidade final e a justificativa (obrigatória) e toque em "Salvar".',
            imagem: IMG.div06,
            legenda: 'Alterar quantidade contada',
          },
          {
            texto: 'O card mostra "Quantidade ajustada pelo ADM" com o valor original, o novo, quem ajustou e a justificativa. A diferença é recalculada.',
            imagem: IMG.div07,
            legenda: 'Ajuste registrado e auditável',
          },
          {
            texto: 'Item sem custo? Toque em "Informar custo" (ou "Atualizar custo") para preencher custo unitário, descrição, grupo e unidade. Sem custo o botão de aprovar fica bloqueado.',
            imagem: IMG.div08,
            legenda: 'Informações do produto (custo)',
          },
          {
            texto: 'Toque em "Aprovar (ADM)" (ou "Rejeitar") e confirme. O status muda para AGUARDANDO GESTOR.',
            imagem: IMG.div09,
            legenda: 'Item aprovado pelo ADM, aguardando Gestor',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Etapa 2 — aprovação final do Gestor:',
        itens: [
          {
            texto: 'Enquanto o ADM não aprovar, o Gestor vê "Aguardando aprovação do ADM" no lugar dos botões.',
            imagem: IMG.div03,
            legenda: 'Gestor aguardando o ADM',
          },
          {
            texto: 'Depois da etapa 1, o Gestor vê o "Resultado Financeiro" e o impacto em R$ de cada item (verde = ganho, vermelho = perda) e toca em "Aprovar definitivamente" ou "Rejeitar".',
            imagem: IMG.div12,
            legenda: 'Divergências — visão do Gestor',
          },
          {
            texto: 'Quando todas estiverem resolvidas, aparece "Todas as divergencias foram resolvidas!". Toque em "Concluir sessao de inventario".',
            imagem: IMG.div16,
            legenda: 'Concluir a sessão',
          },
          {
            texto: 'A sessão passa para CONCLUIDA e vai para a aba "Concluidas".',
            imagem: IMG.div17,
            legenda: 'Sessão concluída',
          },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Botões da tela de Divergências:',
        itens: [
          { botao: 'Alterar quantidade (ADM)', quem: 'ADM, item PENDENTE', faz: 'Corrige a quantidade final com justificativa obrigatória. O valor original fica preservado.' },
          { botao: 'Informar custo', quem: 'ADM', faz: 'Cadastra/atualiza o custo unitário e dados do produto.' },
          { botao: 'Aprovar (ADM)', quem: 'ADM, item PENDENTE', faz: '1ª etapa. Envia o item para o Gestor.' },
          { botao: 'Aprovar definitivamente', quem: 'Gestor ou ADM, item AGUARDANDO GESTOR', faz: '2ª etapa — aprovação final.' },
          { botao: 'Rejeitar', quem: 'ADM ou Gestor, na sua etapa', faz: 'Rejeita o ajuste; o saldo do sistema é mantido.' },
          { botao: 'Aprovar em lote', quem: 'ADM (1ª etapa) / Gestor (2ª etapa)', faz: 'Aprova de uma vez todos os itens da sua etapa. Itens com ⚠️ ficam de fora.' },
          { botao: 'Concluir sessao de inventario', quem: 'ADM, Gestor', faz: 'Aparece quando nada mais está pendente. Conclui a sessão.' },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'atencao',
        texto: 'Itens com ⚠️ ("Requer aprovacao individual") passaram do limite configurado (ex: diferença acima de 10%). Eles não entram na aprovação em lote — é preciso aprovar um a um.',
      },
      {
        tipo: 'destaque',
        variante: 'dica',
        texto: 'O ADM pode fazer as duas etapas sozinho quando necessário ("Aprovar (ADM)" e depois "Aprovar definitivamente") — ele nunca fica travado esperando o Gestor.',
      },
      {
        tipo: 'destaque',
        variante: 'info',
        texto: 'O sistema NÃO altera o saldo do ERP automaticamente. As divergências aprovadas ficam registradas para auditoria e o ajuste no ERP é feito pela equipe responsável. Produtos nunca bipados aparecem como "NÃO BIPADO" e são aprovados/rejeitados da mesma forma.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'relatorios',
    emoji: '📈',
    titulo: 'Relatórios e Exportação',
    resumo: 'Acuracidade da sessão, exportar Excel/PDF/CSV e Relatório Geral',
    papeis: ['ADM', 'Gestor', 'Gerente', 'Auditor'],
    cor: '#16A34A',
    corBg: '#F0FDF4',
    conteudo: [
      {
        tipo: 'passos',
        titulo: 'Resultado de uma sessão concluída:',
        itens: [
          {
            texto: 'Em Sessões → aba "Concluidas", o card mostra os botões Acuracidade da Sessao, Divergencias, Historico, Exportar e (ADM) Registrar alteracao.',
            imagem: IMG.rel01,
            legenda: 'Sessão concluída (ADM)',
          },
          {
            texto: '"Acuracidade da Sessao" mostra: % de produtos que bateram (verde ≥ 95%, laranja ≥ 85%, vermelho abaixo), o valor divergente em R$ e as divergências pendentes/aprovadas/rejeitadas.',
            imagem: IMG.rel02,
            legenda: 'Acuracidade da sessão',
          },
          {
            texto: 'ADM: "Registrar alteracao (ADM)" adiciona uma nota explicando alterações feitas depois da conclusão. Sessões com nota ganham o selo "?".',
            imagem: IMG.rel05,
            legenda: 'Notas de alteração',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Exportar o relatório de uma sessão:',
        itens: [
          {
            texto: 'Toque em "Exportar". Escolha o Formato e o Perfil de auditoria.',
            imagem: IMG.rel03,
            legenda: 'Exportar relatório',
          },
          {
            texto: 'No perfil "Customizado", marque as abas que quer incluir. Toque em "Gerar e baixar" — no celular abre o compartilhamento (WhatsApp, e-mail, Drive…).',
            imagem: IMG.rel04,
            legenda: 'Perfil customizado',
          },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Formatos:',
        itens: [
          { botao: 'Excel (.xlsx)', quem: 'Mais completo', faz: 'Várias abas, com formatação.' },
          { botao: 'PDF (.pdf)', quem: 'Para apresentar', faz: 'Visual resumido, com as 50 maiores divergências.' },
          { botao: 'CSV (.zip)', quem: 'Para sistemas', faz: 'Um arquivo por aba, separador ponto-e-vírgula.' },
        ],
      },
      {
        tipo: 'botoes',
        titulo: 'Perfis de auditoria:',
        itens: [
          { botao: 'Operacional', quem: 'Gestores de loja', faz: 'Sem dados financeiros.' },
          { botao: 'Financeiro', quem: 'Controladoria', faz: 'Com custos e valores.' },
          { botao: 'Auditoria TI', quem: 'Compliance / ISO 27001', faz: 'Inclui o audit log.' },
          { botao: 'Completo', quem: '', faz: 'Todas as abas disponíveis.' },
          { botao: 'Customizado', quem: '', faz: 'Você escolhe as abas: Resumo, Contagens, Pendentes, Divergências, Top 10, Audit Log, Metadados.' },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Relatório Geral — todas as lojas (ADM, Gerente, Auditor):',
        itens: [
          {
            texto: 'Menu → "Rel. Geral". Filtre Natureza, Lojas e Meses (é possível marcar vários; "Todas"/"Todos" = sem filtro) e toque em "Gerar e baixar Excel". Sai uma aba por natureza com os indicadores de cada loja.',
            imagem: IMG.rel06,
            legenda: 'Relatório Geral com filtros',
          },
          {
            texto: 'Em "Exportar Sessao Individual", escolha o status (Concluidas/Ativas) e a loja para listar as sessões; toque em "Toque para exportar →" para abrir a exportação daquela sessão.',
            imagem: IMG.rel07,
            legenda: 'Exportar sessão individual',
          },
          'Cores de acuracidade no Excel: verde ≥ 99%, amarelo ≥ 90%, vermelho < 90%.',
        ],
      },
      {
        tipo: 'destaque',
        variante: 'info',
        texto: 'Ajuste Líquido = sobra − falta (o que precisa ser ajustado no ERP). Impacto Bruto = |sobra| + |falta| (exposição total). Ex: sobra R$ 95 mil e falta R$ 93 mil → Ajuste Líquido R$ 2 mil, mas Impacto Bruto R$ 188 mil.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    emoji: '📊',
    titulo: 'Dashboard e KPIs',
    resumo: 'Indicadores ao vivo, ranking de lojas e histórico',
    papeis: ['ADM', 'Gestor', 'Gerente', 'Auditor'],
    cor: '#6366F1',
    corBg: '#EEF2FF',
    conteudo: [
      {
        tipo: 'texto',
        texto: 'Menu → "Dashboard". Os números se atualizam sozinhos a cada 30 segundos ("● Ao vivo"). O Gestor vê apenas a própria loja.',
      },
      {
        tipo: 'passos',
        titulo: 'Lendo o Dashboard:',
        itens: [
          {
            texto: 'No topo, os cards de Lojas, Em Andamento, Aguardando e Concluídas (no celular aparecem só os ícones). Abaixo, a "Acuracidade Média" e o "Valor Divergente Total".',
            imagem: IMG.dash01,
            legenda: 'Topo do Dashboard',
          },
          {
            texto: '"Acuracidade por Loja (SKU)" é o ranking: % de produtos que bateram com o sistema, da maior para a menor. Verde ≥ 95% Excelente, laranja 85–94% Atenção, vermelho < 85% Crítico.',
            imagem: IMG.dash02,
            legenda: 'Ranking de acuracidade por loja',
          },
          {
            texto: '"Top Divergências por Valor" lista os produtos com maior impacto em R$ (produto, SKU, loja, valor e status). Use a paginação e "Itens por página".',
            imagem: IMG.dash03,
            legenda: 'Top divergências por valor',
          },
          {
            texto: '"Sessões Ativas" mostra o progresso de cada sessão em andamento. "Atenção Recorrente" destaca SKUs que divergem em várias sessões (↑ Sobra / ↓ Falta).',
            imagem: IMG.dash04,
            legenda: 'Sessões ativas e atenção recorrente',
          },
          {
            texto: 'Toque em "Filtros" para filtrar por Natureza e Grupo de Material. Um ponto amarelo indica filtro ativo.',
            imagem: IMG.dash05,
            legenda: 'Filtros do Dashboard',
          },
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Histórico por loja:',
        itens: [
          {
            texto: 'No fim do Dashboard, toque em "Ver histórico de todas as lojas →" (não disponível para o Gestor). Cada loja mostra a acuracidade da última sessão.',
            imagem: IMG.dash06,
            legenda: 'Dashboard por loja',
          },
          {
            texto: 'Toque em uma loja para ver a apuração detalhada: Valor, Unidades e Itens (SKU), com Total, Ajuste Líquido, Falta, Sobra, Impacto Bruto e Diferença %. Escolha o período em 3M / 6M / 12M.',
            imagem: IMG.dash07,
            legenda: 'Apuração detalhada da loja',
          },
          {
            texto: 'Em "Histórico de Sessões", toque em uma sessão anterior para ver a apuração dela.',
            imagem: IMG.dash08,
            legenda: 'Histórico de sessões da loja',
          },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'info',
        texto: 'Acuracidade = 100% − diferença %. Meta mínima: 99% em valor. Nos painéis de Valor e Unidades: verde ≥ 99%, âmbar ≥ 98%, vermelho abaixo. No painel de Itens (SKU): verde ≥ 90%, âmbar ≥ 80%.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'consolidado',
    emoji: '🏢',
    titulo: 'Consolidado Multi-Loja',
    resumo: 'Todas as lojas lado a lado em um mês',
    papeis: ['ADM', 'Gestor', 'Gerente', 'Auditor'],
    cor: '#0D9488',
    corBg: '#F0FDFA',
    conteudo: [
      {
        tipo: 'passos',
        titulo: 'Como usar:',
        itens: [
          {
            texto: 'Menu → "Consolidado". Toque no mês de competência nos botões do topo e, se quiser, filtre a Natureza. A coluna âmbar "Consolidado" é a SOMA de todas as lojas com inventário no mês; à direita vem uma coluna por loja (deslize para o lado).',
            imagem: IMG.cons02,
            legenda: 'Consolidado de um mês',
          },
          'Lojas sem inventário concluído no período aparecem em cinza com "sem dados".',
          'Role para ver as três apurações: Valor (R$), Unidades e Itens, cada uma com Total, Ajuste positivo, Ajuste negativo, Diferença líquida, Diferença % e Acuracidade.',
        ],
      },
      {
        tipo: 'destaque',
        variante: 'info',
        texto: 'Regra do Consolidado: se só a L01 fez inventário no mês, o consolidado espelha a L01. Se L01 e L02 fizeram, os valores se somam e os percentuais são calculados sobre o total das duas lojas.',
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'auditoria',
    emoji: '🔍',
    titulo: 'Auditoria',
    resumo: 'Painel de inteligência, audit log e participação por operador',
    papeis: ['ADM', 'Gerente', 'Auditor'],
    cor: colors.info,
    corBg: colors.infoSoft,
    conteudo: [
      {
        tipo: 'passos',
        titulo: 'Aba "Painel de Inteligencia":',
        itens: [
          {
            texto: 'Menu → "Auditoria". Os 4 indicadores do topo são: Acuracidade Financeira (meta 99%), Acuracidade SKU (meta 90%), Acuracidade de Unidades (padrão 95%) e Divergência Total. Abaixo, a tendência mensal. Atualiza a cada 5 minutos ou pelo botão "↻".',
            imagem: IMG.aud01,
            legenda: 'Painel de inteligência',
          },
          {
            texto: '"Divergências por Zona" mostra o saldo por loja (sobra em verde, falta em vermelho). "Alertas Críticos" lista os maiores impactos (Alto > R$ 1.000, Médio > R$ 200) — toque em "Ver" para o detalhe.',
            imagem: IMG.aud02,
            legenda: 'Divergências por zona e alertas',
          },
          {
            texto: '"Status da Auditoria" e "Resumo do Período" trazem SKUs planejados/auditados, previsão de conclusão, contagens realizadas e lojas monitoradas.',
            imagem: IMG.aud03,
            legenda: 'Status e resumo do período',
          },
          'Use "Filtros" para escolher Ano, Mês, Loja, Natureza e Grupo. No computador, "Layout" permite reorganizar e redimensionar os blocos.',
        ],
      },
      {
        tipo: 'passos',
        titulo: 'Aba "Ferramentas":',
        itens: [
          {
            texto: 'Exportar Audit Log (somente ADM): escolha o Tipo de ação (Todos, Sessões, Contagens, Divergências, Importações, Usuários) e o período, e toque em "Exportar Audit Log (.xlsx)".',
            imagem: IMG.aud04,
            legenda: 'Ferramentas — exportar audit log',
          },
          {
            texto: 'Participação por Operador: toque em uma sessão concluída para ver, por operador, quantos SKUs contou, quantas leituras fez, a primeira e a última leitura e o tempo ativo.',
            imagem: IMG.aud05,
            legenda: 'Participação por operador',
          },
        ],
      },
    ],
  },
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'faq',
    emoji: '❓',
    titulo: 'Dúvidas Frequentes',
    resumo: 'Problemas comuns e como resolver',
    papeis: ['Todos'],
    cor: colors.warning,
    corBg: colors.warningSoft,
    conteudo: [
      {
        tipo: 'botoes',
        titulo: 'Problema → o que fazer:',
        itens: [
          { botao: 'Não consigo entrar', quem: 'Login', faz: 'Confira e-mail e senha. Após 5 erros o acesso fica bloqueado por 15 minutos. Se esqueceu a senha, peça ao gestor/ADM para redefinir.' },
          { botao: 'Não aparece nenhuma sessão', quem: 'Operador', faz: 'O ADM ainda não criou/iniciou a sessão da sua loja, ou você não está vinculado à loja. Fale com o ADM.' },
          { botao: '"Liberar 2ª contagem" está cinza', quem: 'Líder / Gestor', faz: 'Ainda há operador com o scanner aberto. Peça para tocarem em "Voltar". Se alguém fechou o app sem voltar, a presença expira sozinha em cerca de 6 minutos.' },
          { botao: 'Não consigo encerrar a sessão', quem: 'ADM / Gestor', faz: 'Há produtos aguardando 2ª ou 3ª contagem. Termine essas contagens primeiro (trava de segurança).' },
          { botao: 'O botão "Adicionar" não habilita', quem: 'Operador', faz: 'Falta a quantidade ou a localização (obrigatória em algumas lojas).' },
          { botao: 'Produto nao cadastrado', quem: 'Operador', faz: 'Conte e registre normalmente; avise o ADM para cadastrar o produto.' },
          { botao: 'Encerrei a sessão sem querer', quem: 'ADM', faz: 'Use "Reabrir sessao (ADM)" — nenhuma contagem é perdida.' },
          { botao: '"Aprovar (ADM)" está apagado', quem: 'ADM', faz: 'O item está sem custo. Toque em "Informar custo" antes de aprovar.' },
          { botao: 'Gestor não consegue aprovar', quem: 'Gestor', faz: 'A divergência ainda está PENDENTE — o ADM precisa aprovar a 1ª etapa antes.' },
        ],
      },
      {
        tipo: 'destaque',
        variante: 'dica',
        texto: 'Use a busca no topo deste guia: digite uma palavra (ex: "desempate", "custo", "lote") para encontrar a seção certa.',
      },
    ],
  },
];

// ── Tabela de permissoes ──────────────────────────────────────────
function TabelaPermissoes({ colunas, linhas }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
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

// ── Print de tela (miniatura; toque abre ampliado) ─────────────────
function ImagemTela({ fonte, legenda, onAbrir }) {
  return (
    <TouchableOpacity
      style={est.imagemBox}
      onPress={() => onAbrir({ fonte, legenda })}
      activeOpacity={0.8}
    >
      <Image source={fonte} style={est.imagemMiniatura} resizeMode="contain" />
      <Text style={est.imagemLegenda}>
        {legenda ? `${legenda} · ` : ''}toque para ampliar
      </Text>
    </TouchableOpacity>
  );
}

// ── "O que faz cada botao" ────────────────────────────────────────
function BlocoBotoes({ titulo, itens, cor }) {
  return (
    <View style={est.passosBox}>
      {titulo && <Text style={[est.passosTitulo, { color: cor }]}>{titulo}</Text>}
      {itens.map((item, i) => (
        <View key={i} style={est.botaoLinha}>
          <View style={[est.botaoPilula, { borderColor: cor }]}>
            <Text style={[est.botaoPilulaTxt, { color: cor }]}>{item.botao}</Text>
          </View>
          {!!item.quem && <Text style={est.botaoQuem}>{item.quem}</Text>}
          <Text style={est.botaoFaz}>{item.faz}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Caixa de destaque (dica / atencao / importante / info) ────────
const VARIANTES_DESTAQUE = {
  dica:       { icone: '💡', rotulo: 'Dica',       cor: colors.success, fundo: colors.successSoft },
  atencao:    { icone: '⚠️', rotulo: 'Atenção',    cor: colors.warning, fundo: colors.warningSoft },
  importante: { icone: '🔒', rotulo: 'Importante', cor: colors.danger,  fundo: colors.dangerSoft },
  info:       { icone: 'ℹ️', rotulo: 'Saiba mais', cor: colors.info,    fundo: colors.infoSoft },
};

function Destaque({ variante, texto }) {
  const v = VARIANTES_DESTAQUE[variante] || VARIANTES_DESTAQUE.info;
  return (
    <View style={[est.destaque, { backgroundColor: v.fundo, borderLeftColor: v.cor }]}>
      <Text style={[est.destaqueRotulo, { color: v.cor }]}>{v.icone}  {v.rotulo}</Text>
      <Text style={est.destaqueTxt}>{texto}</Text>
    </View>
  );
}

// Texto de um item de passo (string ou objeto { texto, imagem, legenda })
function textoDoItem(item) {
  return typeof item === 'string' ? item : (item.texto || '');
}

// Texto pesquisavel de um bloco (usado pela busca)
function textoDoBloco(b) {
  if (b.tipo === 'passos') return (b.titulo || '') + ' ' + (b.itens || []).map(textoDoItem).join(' ');
  if (b.tipo === 'botoes') return (b.titulo || '') + ' ' + (b.itens || []).map(i => `${i.botao} ${i.quem} ${i.faz}`).join(' ');
  if (b.tipo === 'tabela') return (b.linhas || []).map(l => l[0]).join(' ');
  return b.texto || b.legenda || '';
}

// Quantos prints a secao tem (mostrado no cabecalho)
function contarImagens(secao) {
  return secao.conteudo.reduce((n, b) => {
    if (b.tipo === 'imagem') return n + 1;
    if (b.tipo === 'passos') return n + b.itens.filter(i => i.imagem).length;
    return n;
  }, 0);
}

// ── Accordion ─────────────────────────────────────────────────────
function Secao({ secao, expandida, onToggle, onAbrirImagem }) {
  const nImagens = contarImagens(secao);
  return (
    <View style={[est.secao, { borderLeftColor: secao.cor }]}>
      <TouchableOpacity style={est.secaoHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={[est.secaoEmojiBg, { backgroundColor: secao.corBg }]}>
          <Text style={est.secaoEmoji}>{secao.emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={est.secaoTitulo} numberOfLines={2}>{secao.titulo}</Text>
          {!!secao.resumo && (
            <Text style={est.secaoResumo} numberOfLines={2}>
              {secao.resumo}{nImagens > 0 ? ` · ${nImagens} telas` : ''}
            </Text>
          )}
        </View>
        <Text style={[est.secaoChevron, { color: secao.cor }]}>
          {expandida ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expandida && (
        <View style={est.secaoCorpo}>
          {!!secao.papeis && (
            <View style={est.papeisLinha}>
              <Text style={est.papeisRotulo}>Para:</Text>
              {secao.papeis.map(p => (
                <View key={p} style={[est.papelChip, { backgroundColor: secao.corBg }]}>
                  <Text style={[est.papelChipTxt, { color: secao.cor }]}>{p}</Text>
                </View>
              ))}
            </View>
          )}
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
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={est.passoTxt}>{textoDoItem(item)}</Text>
                        {item.imagem && (
                          <ImagemTela fonte={item.imagem} legenda={item.legenda} onAbrir={onAbrirImagem} />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              );
            }
            if (bloco.tipo === 'botoes') {
              return <BlocoBotoes key={bi} titulo={bloco.titulo} itens={bloco.itens} cor={secao.cor} />;
            }
            if (bloco.tipo === 'destaque') {
              return <Destaque key={bi} variante={bloco.variante} texto={bloco.texto} />;
            }
            if (bloco.tipo === 'imagem') {
              return (
                <ImagemTela key={bi} fonte={bloco.fonte} legenda={bloco.legenda} onAbrir={onAbrirImagem} />
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
  const [imagemAberta, setImagemAberta] = useState(null);

  function toggleSecao(id) {
    setExpandidas(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const secoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return SECOES;
    return SECOES.filter(s => {
      const txt = [s.titulo, s.resumo || '', ...s.conteudo.map(textoDoBloco)].join(' ').toLowerCase();
      return txt.includes(q);
    });
  }, [busca]);

  const totalTelas = useMemo(() => SECOES.reduce((n, s) => n + contarImagens(s), 0), []);

  return (
    <AppLayout navigation={navigation} telaAtual="Ajuda" titulo="Guia de Uso" scrollavel={false} semPadding>
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
            <Text style={est.topoTituloTxt}>Guia de Uso e Treinamento</Text>
            <Text style={est.topoSubTxt}>
              {SECOES.length} seções · {totalTelas} telas ilustradas · Toque para expandir
            </Text>
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
              onAbrirImagem={setImagemAberta}
            />
          ))
        )}

        {/* Rodape */}
        <View style={est.rodape}>
          <Text style={est.rodapeVersao}>Sistema de Inventário BOLD — v0.2.0</Text>
          <Text style={est.rodapeSuporte}>Dúvidas? Contate o administrador do sistema</Text>
          <Text style={est.rodapeEmail}>operacoes.claude@bold.net</Text>
        </View>
      </ScrollView>

      {/* Print ampliado */}
      <Modal
        visible={!!imagemAberta}
        transparent
        animationType="fade"
        onRequestClose={() => setImagemAberta(null)}
      >
        <TouchableOpacity
          style={est.modalFundo}
          activeOpacity={1}
          onPress={() => setImagemAberta(null)}
        >
          {imagemAberta && (
            <>
              <Image source={imagemAberta.fonte} style={est.modalImagem} resizeMode="contain" />
              {!!imagemAberta.legenda && (
                <Text style={est.modalLegenda}>{imagemAberta.legenda}</Text>
              )}
              <Text style={est.modalFechar}>Toque em qualquer lugar para fechar</Text>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </AppLayout>
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
  secaoResumo:  { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  secaoChevron: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  secaoCorpo: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: spacing.sm,
  },
  papeisLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  papeisRotulo: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  papelChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  papelChipTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  texto: { fontSize: fontSize.sm, color: '#334155', lineHeight: 22, marginBottom: spacing.sm, flexWrap: 'wrap' },
  passosBox: { marginBottom: spacing.md },
  passosTitulo: { fontSize: fontSize.sm, fontWeight: '700', marginBottom: spacing.sm, flexWrap: 'wrap' },
  passoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 10 },
  passoBullet: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  passoBulletTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  passoTxt: { fontSize: fontSize.sm, color: '#334155', lineHeight: 20, flexWrap: 'wrap' },
  botaoLinha: {
    marginBottom: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  botaoPilula: {
    alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.background,
  },
  botaoPilulaTxt: { fontSize: fontSize.sm2, fontWeight: '700' },
  botaoQuem: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600', marginTop: 4 },
  botaoFaz: { fontSize: fontSize.sm, color: '#334155', lineHeight: 20, marginTop: 2 },
  destaque: {
    borderLeftWidth: 4, borderRadius: radius.md,
    padding: spacing.sm + 4, marginBottom: spacing.md,
  },
  destaqueRotulo: { fontSize: fontSize.xs, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  destaqueTxt: { fontSize: fontSize.sm, color: '#334155', lineHeight: 20 },
  imagemBox: {
    marginTop: spacing.sm, marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  imagemMiniatura: {
    width: 150, height: 150 * 844 / 390,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
  },
  imagemLegenda: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4, maxWidth: 240 },
  modalFundo: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.md,
  },
  modalImagem: { width: '100%', maxWidth: 420, height: '80%' },
  modalLegenda: { color: '#FFFFFF', fontSize: fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  modalFechar: { color: '#CBD5E1', fontSize: fontSize.xs, marginTop: spacing.xs },
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
