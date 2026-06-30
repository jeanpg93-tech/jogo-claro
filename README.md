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
