## Fase 1 — Perfil Analítico do Usuário

Objetivo: capturar o perfil analítico (experiência, risco, objetivo, mercados, competições, tolerância, alertas) sem introduzir IA. As Fases 2–6 do documento ficam para depois; cada uma exige aprovação separada.

### O que muda

**Banco (Supabase) — nova migration SQL a ser executada pelo usuário**

Estender `public.user_preferences` com colunas nullable (não quebra o que já existe):

- `experience_level` text — `iniciante` | `intermediario` | `avancado`
- `risk_profile` text — `conservador` | `equilibrado` | `agressivo` | `oportunista`
- `goals` text[] — subset de `aprender`, `registrar_decisoes`, `comparar_odds`, `buscar_oportunidades`, `melhorar_disciplina`
- `markets` text[] — começa com `["1x2"]`
- `risk_tolerance` int — 1 a 10 (slider)
- `discipline_alerts` boolean default true
- `disclaimer_acknowledged_at` timestamptz — carimbo do aceite explícito
- `analytical_profile_completed_at` timestamptz — quando o usuário concluiu o onboarding do perfil
- CHECK constraints para os enums; sem novos GRANTs (a tabela já é acessível pelo usuário).

`favorite_competitions`, `personal_edge_threshold` e `notify_oportunidade` continuam intactos.

**Frontend**

1. `src/lib/analytical-profile.ts` — constantes (labels PT-BR), tipos TS, defaults, textos padronizados na linguagem do produto (análise, disciplina, risco, decisão do usuário, oportunidade analítica). Nada de "aposta certa", "sinal", "lucro garantido", "green".

2. `src/hooks/use-analytical-profile.tsx` — hook `useAnalyticalProfile()` que lê/atualiza a linha de `user_preferences` do usuário logado, expõe `profile`, `loading`, `save()`, `isComplete`.

3. `src/routes/_authenticated/perfil.tsx` — nova seção **"Perfil analítico"** acima de "Preferências", com:
   - Nível de experiência (radio group)
   - Perfil de risco (radio group com descrição curta de cada)
   - Objetivos na plataforma (checkboxes múltiplos)
   - Mercados de interesse (checkbox; no MVP só `Resultado final (1X2)` marcado e desabilitado com nota "mais mercados em breve")
   - Competições de interesse (reaproveita a lista já existente de `favorite_competitions`, consolidada num único bloco)
   - Tolerância pessoal a risco (slider 1–10 com rótulos "muito conservador" / "muito arrojado")
   - Switch "Receber alertas de cautela e disciplina"
   - Confirmação obrigatória: "Entendo que a plataforma não garante lucro, não executa apostas e não substitui minha decisão." (checkbox exigido para salvar; carimba `disclaimer_acknowledged_at`)
   - Botão único "Salvar perfil analítico" com o `PageLoader` existente.

4. `src/routes/_authenticated/perfil-analitico.tsx` (nova rota) — versão **onboarding** do mesmo formulário: layout de página cheia, título "Complete seu perfil analítico", texto explicando por que pedimos, e ao salvar redireciona pra `/dashboard`. Reutiliza o mesmo componente de formulário do perfil (extraído para `src/components/analytical-profile-form.tsx`).

5. `src/routes/_authenticated/route.tsx` — após login, se `analytical_profile_completed_at` for null, redirecionar para `/perfil-analitico` (exceto quando o usuário já está nessa rota ou em `/jogo-responsavel`). Skip silencioso se a query falhar, para o app continuar funcionando mesmo sem perfil (critério de aceite da Fase 2, mas já protege agora).

6. `src/routes/auth.cadastro.tsx` — após `signUp` bem-sucedido, redirecionar para `/auth/entrar` como hoje; o onboarding do perfil analítico acontece no primeiro login (mais simples e evita bloqueio caso a confirmação de e-mail esteja ativa).

### O que NÃO entra nesta fase

- Nenhuma personalização visual do dashboard/detalhe do jogo pelo perfil (isso é Fase 2 do documento).
- Nenhuma chamada de IA, nenhum bloco "Análise do jogo" novo, nenhum chat (Fases 3–6).
- Nenhuma alteração em `sync-core`, providers de odds, cadência ou dados.

### Entregáveis

- SQL de migration (a ser aplicado pelo usuário no Supabase externo).
- Arquivos novos: `src/lib/analytical-profile.ts`, `src/hooks/use-analytical-profile.tsx`, `src/components/analytical-profile-form.tsx`, `src/routes/_authenticated/perfil-analitico.tsx`.
- Arquivos editados: `src/routes/_authenticated/perfil.tsx`, `src/routes/_authenticated/route.tsx`.

### Critérios de aceite (do documento)

- Usuário novo cria conta e consegue completar o perfil analítico no primeiro login.
- Usuário edita o perfil depois em `/perfil`.
- Preferências existentes (competições favoritas, limiar, notify) continuam funcionando.
- Nenhum texto promete lucro, acerto, sinal vencedor ou aposta certa.

Ao finalizar, paro e aguardo aprovação antes de seguir para a Fase 2 do documento.