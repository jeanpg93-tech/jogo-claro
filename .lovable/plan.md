## Minha recomendação de provedor

**The Odds API** (https://the-odds-api.com) é a melhor escolha para o MVP, pelos seguintes motivos objetivos:

| Critério | The Odds API | API-Football |
|---|---|---|
| Foco em odds pré-jogo 1X2 | Sim, é o produto principal | Secundário, exige plano pago |
| Plano gratuito | 500 requisições/mês | 100 req/dia, mas odds são pagas |
| Múltiplas casas por jogo | Sim, nativo (vira nosso "books") | Limitado |
| Esforço de integração | Baixo (1 endpoint, JSON simples) | Médio |
| Cobre Brasileirão + Europa | Sim (`soccer_brazil_campeonato`, etc.) | Sim |

**API-Football** entra melhor na Fase 5, quando quisermos escalações, lesões e estatísticas avançadas.

Vou montar a Fase 4 com um **adapter plugável**: a integração começa preparada para The Odds API, mas a interface `OddsProvider` permite trocar de provedor sem reescrever o painel.

---

## Fase 4 — Integração externa de dados reais

### 1. Camada de provedor (adapter)
- `src/lib/providers/types.ts` — interface `OddsProvider` com `fetchUpcomingGames()` retornando o shape canônico já usado em `DemoGame`.
- `src/lib/providers/the-odds-api.server.ts` — implementação real, lê `THE_ODDS_API_KEY` de `process.env`.
- `src/lib/providers/index.server.ts` — seletor por `process.env.ODDS_PROVIDER` (default `the-odds-api`), fácil de trocar depois.

### 2. Modelo no Supabase
SQL que você roda no painel:
- `games` (id, external_id, provider, competition, home, away, kickoff, updated_at).
- `game_odds` (game_id, side, book, odd).
- `game_reference` (game_id, home, draw, away) — média/mediana das casas, calculada na ingestão.
- `sync_runs` (id, started_at, finished_at, provider, games_inserted, games_updated, error) — para auditoria.
- RLS: leitura pública (`anon` + `authenticated`) somente nas tabelas de jogos/odds; `sync_runs` só admin.

### 3. Ingestão (server functions + rota pública)
- `src/lib/sync.functions.ts` → `syncGames` (`createServerFn`, middleware `requireSupabaseAuth` + check `has_role admin`) para o botão manual no painel Admin.
- `src/routes/api/public/sync.ts` → endpoint para cron, protegido por header `x-sync-secret` (segredo `SYNC_SECRET` gerado via `generate_secret`).
- Ambos chamam a mesma função interna `runSync(provider)` que: busca dados → upsert nas tabelas → calcula referência → grava `sync_runs`.

### 4. Leitura no app
- `src/lib/games.functions.ts` → `listGames` e `getGame` lendo de `games`/`game_odds`/`game_reference` via cliente publishable (server-side, com policy `TO anon SELECT`).
- `src/routes/_authenticated/dashboard.tsx` e `jogos.$id.tsx`: trocar `DEMO_GAMES` por `useSuspenseQuery` chamando essas server fns. A regra de classificação (`classifyGame`) **não muda** — segue 100% objetiva.
- Substituir demo por real: quando há ao menos 1 jogo real na janela, demos somem. Banner "Dados demonstrativos" some quando todos os cards forem reais.
- Cada card mostra `updated_at` real (data/hora da última sincronização).

### 5. Painel Admin de sincronização
- `src/routes/_authenticated/admin.sincronizacao.tsx` (visível só com `effectiveIsAdmin`):
  - Botão **Sincronizar agora**.
  - Tabela com últimas 20 execuções (`sync_runs`): início, duração, provedor, inseridos/atualizados, erro.
  - Status da chave: "configurada" / "ausente" (sem mostrar o valor).

### 6. Cron
- Stable URL `https://project--{id}.lovable.app/api/public/sync` com header `x-sync-secret`.
- Forneço comando `pg_cron` pronto para você colar no Supabase (intervalo padrão 60 min).

### 7. Comunicação responsável (mantida)
- Sem links para casas. Nome das casas exibido apenas como "Fonte A", "Fonte B"... ou o nome bruto sem URL — a definir com você quando aparecer a primeira chave.
- Banner global "Dados demonstrativos" só aparece se a tabela `games` estiver vazia.
- Toda card mostra timestamp real de atualização; se `> MAX_DATA_AGE_HOURS`, classifica como **Aguardar dados** (regra já existe).

### 8. Secrets necessários (peço quando você decidir o provedor)
- `THE_ODDS_API_KEY` — chave do provedor (via `add_secret`).
- `SYNC_SECRET` — gerado automaticamente (`generate_secret`) para autenticar o cron.

### Detalhes técnicos
- Server fns para ingestão e leitura ficam em `src/lib/*.functions.ts`; provedor externo em `*.server.ts`.
- Cliente publishable server-side para leitura pública (cumpre `tanstack-supabase-integration`).
- `supabaseAdmin` carregado dentro do handler (nunca em escopo de módulo) para upserts.
- TanStack Query: `queryOptions` + `ensureQueryData` no loader + `useSuspenseQuery` no componente.

### Critérios de aceite
- Botão Admin executa sync e popula `games`/`game_odds`/`game_reference`.
- Cron consegue chamar `/api/public/sync` com o header secreto e gravar uma linha em `sync_runs`.
- Painel deixa de mostrar dados demo assim que houver dados reais.
- `classifyGame` continua decidindo status apenas por regras objetivas; nenhum uso de IA.
- Erros do provedor não quebram o painel; caem em `Aguardar dados` / mantêm último snapshot bom.

### Fora de escopo (Fase 5)
- Escalações, lesões, estatísticas avançadas, novos mercados, IA externa opt-in, ranking, push notifications.

---

Aprovando este plano, eu começo pela camada do banco + adapter + leitura pública (sem precisar da chave ainda), e só peço a chave do The Odds API via formulário seguro quando chegarmos no passo de ingestão real.