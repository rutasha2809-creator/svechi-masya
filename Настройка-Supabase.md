# Что нужно один раз сделать в Supabase

Дашборд проекта: https://supabase.com/dashboard/project/ahjfdswfafiborxplndr

## 1. Таблица для резервных копий

Откройте слева **SQL Editor**, вставьте всё, что ниже, нажмите **Run**.

```sql
create table if not exists public.app_backups (
  id      bigserial primary key,
  made_at timestamptz not null default now(),
  made_by text,
  version bigint,
  data    jsonb not null
);

alter table public.app_backups enable row level security;

drop policy if exists app_backups_sel on public.app_backups;
drop policy if exists app_backups_ins on public.app_backups;
drop policy if exists app_backups_del on public.app_backups;

create policy app_backups_sel on public.app_backups
  for select to authenticated using (true);
create policy app_backups_ins on public.app_backups
  for insert to authenticated with check (true);
create policy app_backups_del on public.app_backups
  for delete to authenticated using (true);

create index if not exists app_backups_made_at_idx
  on public.app_backups (made_at desc);
```

Пока таблицы нет, приложение работает как раньше, а в разделе «Ещё → Общая база»
вместо списка копий написано, что таблица ещё не заведена.

## 2. Адрес для ссылки из письма

Слева **Authentication → URL Configuration**:

- **Site URL**: `https://rutasha2809-creator.github.io/svechi-masya/`
- **Redirect URLs**: добавить `https://rutasha2809-creator.github.io/svechi-masya/`

Без этого ссылка из письма о смене пароля вернёт человека не туда,
и приложение не увидит токен.

Восстановление пароля работает только на сайте. Если открыть `index.html`
двойным кликом с диска, ссылка из письма туда не приведёт.
