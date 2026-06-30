# Visão de Jogo

Plataforma de análise pré-jogo de futebol. Não recebe apostas, não executa apostas e não garante resultados.

## Configuração — Supabase externo

O projeto usa um Supabase **externo**, criado e controlado fora do Lovable (sem Lovable Cloud).

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → API**, copie a `Project URL` e a `anon public key`.
3. Crie um arquivo `.env` na raiz com base em `.env.example`:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon-publica
```

4. (Opcional, recomendado) Habilite confirmação de e-mail em **Authentication → Providers → Email**.

### SQL inicial sugerido

Execute no editor SQL do Supabase para criar a tabela `profiles` e o trigger que cria um perfil quando um usuário se cadastra:

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

## Fases

- **Fase 1 (atual):** identidade, landing, cadastro/login (com confirmação 18+ e aceite dos termos), perfil, páginas legais. Conectado a Supabase externo.
- Fase 2: dashboard com jogos demonstrativos e status analítico.
- Fase 3: diário pessoal, metodologia e preferências.
- Fase 4: integração com fontes externas de dados reais.

Sem IA nativa do Lovable. Sem Lovable Cloud.
