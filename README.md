# Visão de Jogo

Plataforma de análise pré-jogo de futebol (mercado 1X2 — vencedor da partida).
Não recebe apostas, não executa apostas, não processa pagamentos e não promete resultados.

## Stack

- TanStack Start (Vite) + React 19 + Tailwind v4
- Supabase **externo** (sem Lovable Cloud)
- The Odds API como provedor de odds reais
- **Sem IA nativa do Lovable** para decidir oportunidades — todas as classificações seguem regras objetivas e transparentes (ver `/metodologia`)

## Configuração — Supabase externo

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie a `Project URL` e a `publishable key`.
3. Crie um `.env` na raiz com base em `.env.example`:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publishable
```

4. Em **Authentication → Providers → Email**, habilite confirmação de e-mail (recomendado).
5. Execute as migrações SQL no editor do Supabase (tabelas `profiles`, `user_roles`,
   `journal_entries`, `user_preferences`, `games`, `game_odds`, `game_reference`,
   `sync_runs`, `app_settings`) conforme entregue durante a implementação.

## Sincronização de dados reais

- Provedor: The Odds API (plano Free).
- Segredos no servidor: `THE_ODDS_API_KEY`, `EXT_SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`.
- Endpoint público para cron externo: `POST /api/public/sync` com header `x-sync-secret`.
- Painel admin: `/admin/sincronizacao` permite rodar sincronização manual, escolher
  competições cobertas e copiar configuração para cron-job.org ou GitHub Actions.
- Cadência sugerida: 2x/dia janela ampla + até 4x/dia em dias de rodada.

## Telas implementadas

- Landing pública, cadastro e login (com validação 18+ e aceite de termos)
- Dashboard com filtros por competição
- Detalhe do jogo com tabela de **odds por casa** (regiões EU/UK/AU) e seleção manual
  para cálculo de diferença frente à referência
- Diário pessoal (privado, com filtros e estatísticas)
- Metodologia (regras objetivas e transparentes)
- Perfil e preferências (competições favoritas, limiar pessoal)
- Admin: alternância de papel e painel de sincronização

## Dados demonstrativos

O painel, o detalhe do jogo, o diário e o perfil usam os jogos reais sincronizados
no Supabase. Os dados demonstrativos permanecem **apenas como fallback** quando
ainda não houve nenhuma sincronização, e são sempre claramente identificados.

## O que NÃO é feito

- Sem Lovable Cloud, sem IA nativa do Lovable
- Sem links para casas de apostas, sem carteira, depósito ou saque
- Sem palpites automáticos, sem promessa de lucro
- Sem mercados além de 1X2 nesta fase

## Análise assistida por IA (Gateway externo)

A análise em linguagem natural que aparece na tela do jogo é gerada por uma
IA **externa**, chamada pelo servidor. O produto **não** usa Lovable AI, IA
nativa do Lovable, nem chaves de OpenAI/Anthropic diretas. O provedor está
travado no Gateway externo configurado nos Secrets server-side.

### Variáveis obrigatórias (server-side, nunca `VITE_*`, nunca no frontend/GitHub)

| Variável                  | Obrigatória | O que é                                                                 |
| ------------------------- | :---------: | ----------------------------------------------------------------------- |
| `AI_GATEWAY_BASE_URL`     |     sim     | Base do Gateway (ex.: `https://claude-ss.ia.br/v1`)                     |
| `AI_GATEWAY_API_KEY`      |     sim     | Chave privada do Gateway                                                |
| `AI_GATEWAY_MODEL`        |     sim     | Modelo (ex.: `claude-sonnet-4-6`)                                       |
| `ASSISTED_AI_DAILY_LIMIT` |    opcional | Cota diária de gerações por instalação (default `200`)                  |
| `ASSISTED_AI_MAX_TOKENS`  |    opcional | Limite de tokens de saída (700–2500; default `2000`)                    |

Se qualquer uma das três primeiras estiver ausente, a IA aparece na UI como
**"Provedor de IA não configurado"** e nenhuma geração é feita.

### Tabelas relacionadas (Supabase externo)

- `ai_readings` — cache de análises por jogo. Uma linha por geração; a mais
  recente é reutilizada por 30 min ou até as odds/referência mudarem.
- `ai_readings_quota` — contador diário (`day`, `count`) para respeitar
  `ASSISTED_AI_DAILY_LIMIT`.
- `ai_prompts` — versões do prompt administrativo (`name`, `version`,
  `content`, `active`). Editável em `/admin/ia-prompt`. Apenas uma versão
  fica ativa por vez; se não houver linha ativa o servidor cai no template
  hardcoded.

### Como funciona a chamada

1. Frontend envia apenas `{ gameId }` para `/api/assisted-reading`.
2. Servidor lê `games`, `game_odds` e `game_reference` do Supabase e monta
   o pacote objetivo (coverage + consensus 1X2). O navegador **não** envia
   o pacote — evita manipulação.
3. Servidor calcula um `input_hash`. Se já existir análise recente com o
   mesmo hash, devolve o cache. Se as odds mudaram, marca `stale` e
   permite atualizar.
4. Usuário comum pode gerar/atualizar quando faz sentido. **Regeneração
   forçada** (ignorando cache) é reservada para admin.
5. A saída é filtrada contra termos proibidos (`aposte`, `palpite`,
   `lucro`, `garantido`, `certeza`, `infalível`, `green certo`, etc.)
   antes de ser persistida.

### Segurança de chaves

- `AI_GATEWAY_API_KEY` é **server-side** — nunca prefixe com `VITE_`, nunca
  cole no código-fonte, nunca envie ao repositório.
- O frontend só recebe metadados de status (`configured`, `provider`,
  `health`) — nunca a chave.
