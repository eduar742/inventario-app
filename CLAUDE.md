# CLAUDE.md - Sistema Inteligente de Inventario Multi-Loja

> **Este arquivo e o briefing oficial do projeto.**
> Toda nova sessao da extensao Claude Code deve comecar lendo este documento.
> Mantenha atualizado conforme o projeto evolui.

---

## 1. Visao geral do projeto

### Contexto de negocio

Sistema de inventario fisico multi-loja para uma rede de **11 lojas de varejo** que comercializa chapas MDF, perfis, colas, fitas e produtos de marcenaria.

**Problema que resolve:** o inventario fisico atual e feito em planilha, com risco de erro humano, falta de rastreabilidade, divergencias nao tratadas adequadamente e baixa produtividade.

**Solucao:** app mobile + API que permite operadores bipar QR Codes dos produtos, registrar contagens e o sistema automatizar a logica de divergencias com 3 contagens (1a contagem -> recontagem se divergente -> desempate).

### Stack tecnologica

**Backend (`inventario-api`):**
- Python 3.12
- FastAPI + SQLAlchemy + Pydantic
- PostgreSQL em producao (Render.com), SQLite em desenvolvimento
- JWT para autenticacao
- bcrypt para senhas
- slowapi para rate limiting
- Deploy: Render.com (plano free)

**App Mobile (`inventario-app`):**
- React Native + Expo SDK 54
- React Navigation (stack navigator)
- AsyncStorage para token local
- expo-camera para leitura de QR Codes
- Estilizacao com StyleSheet nativo (sem styled-components ou Tailwind)

### URLs e credenciais

- API producao: `https://inventario-api-bc1p.onrender.com`
- Repo backend: `https://github.com/eduar742/inventario-api`
- Repo app: (a criar)
- Admin de teste: `admin@inventario.local` / `admin123`

---

## 2. Decisoes arquiteturais e de produto

### Decisao 1: Logica de 3 contagens (implementada)

Quando uma contagem diverge do sistema, o fluxo e:

1. **1a contagem** -> se bate com sistema, produto OK
2. **1a contagem diverge** -> sistema solicita 2a contagem
3. **2a contagem igual a 1a** -> valor confirmado (mesmo divergindo do sistema)
4. **2a contagem diferente da 1a** -> sistema solicita 3a contagem (desempate)
5. **3a contagem** -> valor final e a moda entre as 3 (ou a mais proxima do sistema)

### Decisao 2: Inventario CEGO (implementado)

**Operador NAO ve o saldo sistemico antes de contar.**

**Justificativa:** se o operador ve o saldo, ha tendencia inconsciente de ajustar a contagem pra bater (mesmo que tenha contado errado). Inventario cego revela divergencias REAIS.

**Padrao do mercado:** Walmart, Carrefour, Casas Bahia.

**Onde foi implementado:** `src/screens/ContagemScreen.js` no app mobile.

### Decisao 3: Contagens Parciais com Soma (ROADMAP - nao implementado ainda)

**Cenario:** mesmo SKU pode estar em multiplas localizacoes do deposito (sem WMS).

**Fluxo desejado:**
1. Operador bipa SKU pela 1a vez -> cria contagem parcial (ex: 50 unidades da prateleira A)
2. Operador bipa o mesmo SKU de novo -> sistema pergunta:
   - "Nova contagem" (substitui)
   - "Somar ao parcial existente" (50 + 50 = 100)
3. Operador continua bipando outros produtos
4. Quando termina o inventario do SKU, aperta "Finalizar contagem do produto"
5. **Apenas apos finalizar**, a logica das 3 contagens dispara

**Estimativa:** 4-6h (backend + app). Implementar **pos-apresentacao**.

**Por que e importante:** confirmado pelo cliente que isso ocorre **frequentemente** no deposito.

### Decisao 4: Sessoes de inventario

Inventarios sao agrupados em **sessoes**:
- Cada sessao pertence a uma loja
- Tipos: `geral` (todos produtos) ou `parcial` (subset)
- Status: `criada` -> `em_andamento` -> `concluida`
- Operadores so contam em sessoes `em_andamento`

### Decisao 5: Hardening de seguranca (implementado)

Backend ja tem 8 camadas de seguranca implementadas (ver `docs/SEGURANCA.md` quando criado):
1. SECRET_KEY forte (86 chars, diferente em dev e prod)
2. CORS restritivo
3. 6 Headers HTTP de seguranca (OWASP)
4. Politica de senha forte
5. Sanitizacao de logs (mascara senhas/tokens)
6. Rate limiting (5/min login, 60/min default)
7. Bloqueio temporario (5 falhas = 15min bloqueio)
8. Audit log estruturado (LGPD-ready)

---

## 3. Estrutura dos repositorios

### `inventario-api/` (backend)

```
inventario-api/
├── app/
│   ├── api/v1/endpoints/        # Endpoints REST por dominio
│   ├── core/                    # Config, seguranca, logging
│   ├── db/                      # Sessao do SQLAlchemy
│   ├── models/                  # Modelos SQLAlchemy
│   └── schemas/                 # Schemas Pydantic
├── docs/                        # Documentacao tecnica (a criar)
│   ├── ARQUITETURA.md
│   ├── SEGURANCA.md
│   └── LGPD.md
├── logs/                        # Logs de audit (gitignored)
├── .env                         # Variaveis (gitignored)
├── init_db.py                   # Script de seed
├── Procfile                     # Comando Render
├── requirements.txt
└── runtime.txt                  # Python 3.12.8
```

### `inventario-app/` (mobile)

```
inventario-app/
├── src/
│   ├── theme/colors.js          # Paleta azul corporativo
│   ├── services/api.js          # Wrapper de fetch + endpoints
│   ├── components/              # Button, Input
│   ├── screens/                 # 5 telas funcionais
│   │   ├── LoginScreen.js
│   │   ├── LojasScreen.js
│   │   ├── SessoesScreen.js
│   │   ├── ScannerScreen.js
│   │   └── ContagemScreen.js
│   └── navigation/AppNavigator.js
├── App.js
└── package.json
```

---

## 4. Padroes e convencoes (OBRIGATORIO seguir)

### Idioma
- **Nomes de variaveis, funcoes e arquivos em portugues** (ex: `selecionarLoja`, `carregarSessoes`, `LojasScreen.js`)
- **Comentarios em portugues** sem acentos (ASCII puro, pra evitar problemas de encoding no Windows)
- **Mensagens de erro/UI em portugues** para o usuario final

### Estilo de codigo

**Backend (Python):**
- snake_case para variaveis e funcoes
- PascalCase para classes e modelos
- Docstrings em portugues nas funcoes publicas
- Type hints sempre que possivel
- FastAPI: usar `Annotated[X, Depends(Y)]` pra injecao

**App (JavaScript/React):**
- camelCase para variaveis e funcoes
- PascalCase para componentes
- Componentes funcionais com hooks (sem class components)
- StyleSheet nativo (NAO usar styled-components, NAO usar Tailwind)
- Reutilizar componentes de `src/components/` (Button, Input) ao inves de criar novos botoes/inputs

### Tema visual (NAO criar cores avulsas)

Todas as cores DEVEM vir de `src/theme/colors.js`:
- Primario: azul `#1E40AF`
- Cards: fundo branco com borda `colors.border`
- Estados: success (verde), warning (laranja), danger (vermelho), info (azul claro)
- Espacamentos: usar `spacing.xs/sm/md/lg/xl/xxl`
- Tamanhos de fonte: usar `fontSize.xs/sm/md/lg/xl/xxl`
- Cantos: usar `radius.sm/md/lg/full`

### Comunicacao com API

**SEMPRE** usar as funcoes de `src/services/api.js`. NUNCA chamar `fetch` direto nas telas.

Endpoints disponiveis:
- `login(email, senha)`, `logout()`, `pegarUsuario()`
- `listarLojas()`
- `listarSessoes(filtros)`, `buscarSessao(id)`, `listarPendentes(id)`
- `buscarProdutoPorQR(codigoQr)`, `buscarEstoque(qr, lojaId)`
- `registrarContagem({sessaoId, codigoQr, quantidadeContada, observacoes})`

### Navegacao

Usar `navigation.navigate('NomeDaTela', { params })` para ir adiante.
Usar `navigation.goBack()` para voltar.
Usar `navigation.reset(...)` para reset (login/logout).

Telas registradas (em `src/navigation/AppNavigator.js`):
- Login, Lojas, Sessoes, Scanner, Contagem

### Tratamento de erros

- Backend retorna sempre `{"detail": "mensagem amigavel"}` em caso de erro
- App captura erros via try/catch e exibe via `Alert.alert()`
- Erros de rede sao tratados em `chamarAPI` (services/api.js)
- NUNCA mostrar stack trace pro usuario final

### Seguranca - Restricoes inquebraveis

- **NUNCA** commitar `.env`, chaves, senhas ou tokens
- **NUNCA** usar a mesma SECRET_KEY em dev e prod
- **NUNCA** desabilitar o hardening implementado
- **SEMPRE** validar input no backend (Pydantic ja faz, nao remover)
- **SEMPRE** verificar autenticacao antes de operacao sensivel

---

## 5. Estado atual (snapshot)

### Concluido (em producao)

- [x] Backend FastAPI completo com 30+ endpoints
- [x] PostgreSQL em producao com seed (11 lojas, admin, 10 produtos, 110 estoques)
- [x] 8 camadas de seguranca implementadas e testadas
- [x] App mobile com 5 telas funcionais
- [x] Scanner de QR Code lendo em tempo real
- [x] Login JWT funcionando ponta a ponta
- [x] Inventario CEGO implementado (ContagemScreen sem saldo sistemico)
- [x] Logica das 3 contagens funcional no backend

### Pendente (curto prazo)

- [ ] Documentacao tecnica:
  - [ ] Criar pasta `docs/` no backend
  - [ ] `ARQUITETURA.md` (stack, modelo de dados, decisoes, roadmap incluindo Parciais)
  - [ ] `SEGURANCA.md` (controles, gaps, ISO 27001 Anexo A, OWASP Top 10)
  - [ ] `LGPD.md` (mapeamento de dados, base legal, retencao, DPO a confirmar)
- [ ] Commit final do backend no GitHub
- [ ] Criar repositorio do app mobile no GitHub + 1o commit
- [ ] Apresentacao para o time de TI

### Roadmap (medio prazo, pos-apresentacao)

- [ ] Implementar Contagens Parciais com Soma (4-6h)
- [ ] Tela de ADM para criar sessoes pelo app (criacao e exclusiva do ADM)
- [ ] Tela de historico de contagens
- [ ] Tela de divergencias (visualizar e resolver)
- [ ] Multi-operador na mesma sessao
- [ ] Notificacoes push quando recontagem necessaria

### Roadmap (longo prazo)

- [ ] Integracao com ERP corporativo (a definir com TI)
- [ ] Migrar para hospedagem corporativa (sair do Render)
- [ ] Hardening adicional (WAF, SIEM, etc)
- [ ] Conformidade ISO 27001 completa
- [ ] Testes automatizados (pytest no backend, Jest no app)

---

## 6. Como interagir com este projeto (instrucoes pra Claude Code)

### Antes de qualquer mudanca

1. Ler este `CLAUDE.md` completo
2. Verificar `git status` pra ver o que esta modificado
3. Se a tarefa for grande, **apresentar plano em alto nivel ANTES de codar**

### Princıpios para mudancas

- **Uma feature por vez:** nao misturar mudancas nao relacionadas no mesmo commit
- **Manter padroes:** seguir o que ja existe (idioma, naming, estrutura)
- **Reutilizar antes de criar:** usar Button/Input ja existentes, cores do theme, funcoes do services
- **Testar mentalmente:** se a mudanca quebra algum fluxo existente, avisar antes
- **Commit pequenos:** mudancas focadas, mensagens descritivas em portugues

### O que NAO fazer (vetos)

- ❌ NAO criar novos arquivos `.env*` versionados
- ❌ NAO instalar bibliotecas pesadas sem justificar (Redux, MobX, Material-UI etc)
- ❌ NAO mudar a estrutura de pastas sem aviso
- ❌ NAO traduzir nomes de variaveis ja existentes pra ingles
- ❌ NAO remover comentarios explicativos sem motivo
- ❌ NAO usar bibliotecas com dependencias nativas pesadas no app (precisa funcionar no Expo Go)
- ❌ NAO mexer em codigo de seguranca/hardening sem alinhar antes

### Quando estiver em duvida

Pergunte ao usuario antes de:
- Adicionar uma nova dependencia
- Mudar a estrutura de uma tabela do banco
- Alterar comportamento de um endpoint ja em uso
- Quebrar compatibilidade com codigo existente

---

## 7. Glossario de dominio

- **Sessao de inventario:** evento de contagem agrupando varios produtos de uma loja
- **Contagem:** registro de quantidade fisica de um produto em uma sessao (1a, 2a ou 3a)
- **Recontagem:** 2a contagem solicitada apos divergencia na 1a
- **Desempate:** 3a contagem quando 1a e 2a nao convergem
- **Divergencia:** diferenca entre quantidade contada e quantidade sistemica
- **Sistemico (saldo):** quantidade que o sistema (ERP/banco) diz que tem
- **Parcial:** contagem de parte do estoque de um SKU (quando esta em multiplos lugares)
- **Inventario cego:** modo em que operador nao ve o saldo sistemico antes de contar
- **SKU:** Stock Keeping Unit, codigo unico do produto (ex: CHP001)
- **QR Code:** etiqueta visual que identifica fisicamente o produto (ex: QR-CHP001)

---

## 8. Contexto do cliente final

- Empresa de **porte medio** com TI estruturado
- **ISO 27001 em processo** de implementacao
- Requisitos de **LGPD** (mas sem dados pessoais sensiveis, so operacionais)
- 11 lojas de varejo (chapas MDF, perfis, colas, fitas)
- TI ciente do projeto desde o inicio
- Apresentacao formal ao time de TI: **mais de 1 semana**
- Posicionamento: **POC robusto pronto para revisao tecnica**, NAO "pronto para producao"

---

## 9. Decisoes pendentes (alinhar com TI)

- [ ] Hospedagem definitiva (sair do Render para ambiente corporativo?)
- [ ] DPO oficial (quem assume responsabilidade LGPD?)
- [ ] Integracao com ERP existente (quais campos sincronizar?)
- [ ] Politica de retencao de logs (quanto tempo guardar?)
- [ ] Criterio de criacao de usuarios (SSO corporativo? AD?)
- [ ] Estrategia de backup do banco
- [ ] Janela de manutencao (quando pode haver downtime?)

---

**Ultima atualizacao:** Este arquivo deve ser atualizado sempre que houver mudanca de escopo, decisao arquitetural ou conclusao de etapa.
