# Plano — Conectar Supabase externo

Você escolheu o formulário seguro e ainda não rodou o SQL. Vou cuidar das duas pontas.

## 1. Registrar credenciais (formulário seguro)
Vou abrir o fluxo `add_secret` pedindo os dois valores ao mesmo tempo:
- `VITE_SUPABASE_URL` — Project URL do Supabase (Project Settings → API).
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon public key (mesma tela).

Os valores ficam salvos como variáveis de ambiente do projeto. Nada é colado no chat e nada é gravado em `.env` commitado. O cliente em `src/integrations/supabase/client.ts` já lê essas variáveis e sai automaticamente do modo "stub" assim que ambas estiverem presentes.

## 2. SQL inicial para você rodar no Supabase
Antes de testar o cadastro, abra o **SQL Editor** do seu projeto Supabase e execute exatamente este bloco (cria a tabela `profiles`, as policies de RLS e o trigger que popula o perfil ao cadastrar):

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  birth_date date,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Usuário lê o próprio perfil"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "Usuário atualiza o próprio perfil"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, birth_date, terms_accepted_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'birth_date','')::date,
    nullif(new.raw_user_meta_data->>'terms_accepted_at','')::timestamptz
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Recomendado também: em **Authentication → Providers → Email**, manter "Confirm email" ligado para reforçar o controle 18+.

## 3. Validação
Depois que você (a) preencher os secrets no formulário e (b) confirmar que rodou o SQL, eu verifico:
- Build sem erros com as variáveis presentes.
- Tela `/auth/cadastro` cria usuário no Supabase e popula `public.profiles`.
- Tela `/auth/entrar` autentica e libera `/perfil`.

## Fora deste plano
- Nenhuma mudança de UI, escopo ou regras de Fase 2 agora.
- Nenhum uso de Lovable Cloud ou IA nativa — segue a diretriz do projeto.
- Nenhum dado real ainda; segue tudo como Fase 1.

Aprove para eu disparar o formulário seguro dos dois secrets.
