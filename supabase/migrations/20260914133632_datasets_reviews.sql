-- Датасеты и отзывы: типы, таблицы, счётчики через триггер, RLS и права Data API.

-- Типы -----------------------------------------------------------------------

create type public.review_sentiment as enum ('positive', 'neutral', 'negative');

create type public.review_topic as enum (
  'delivery',
  'product_quality',
  'price',
  'assortment',
  'packaging',
  'payment',
  'returns',
  'support',
  'website_app',
  'other'
);

create type public.analysis_status as enum ('pending', 'done', 'error');

-- Таблицы --------------------------------------------------------------------

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  is_demo boolean not null default false,
  reviews_count integer not null default 0 check (reviews_count >= 0),
  analyzed_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint datasets_owner_required check (is_demo or owner_id is not null),
  constraint datasets_analyzed_count_range check (analyzed_count between 0 and reviews_count),
  constraint datasets_reviews_limit check (reviews_count <= 20000)
);

create table public.reviews (
  id bigint generated always as identity primary key,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  score smallint check (score between 0 and 10),
  author text check (char_length(author) <= 200),
  source text check (char_length(source) <= 200),
  reviewed_at timestamptz,
  sentiment public.review_sentiment,
  topic public.review_topic,
  analysis_status public.analysis_status not null default 'pending',
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reviews_done_has_result check (
    analysis_status <> 'done' or (sentiment is not null and topic is not null)
  )
);

create index datasets_owner_id_idx on public.datasets (owner_id);
create index reviews_dataset_reviewed_at_idx on public.reviews (dataset_id, reviewed_at desc);
create index reviews_dataset_sentiment_idx on public.reviews (dataset_id, sentiment);
create index reviews_dataset_topic_idx on public.reviews (dataset_id, topic);

-- Счётчики reviews_count / analyzed_count ------------------------------------
-- Триггеры уровня statement с transition tables: пачка из 500 строк обновляет
-- датасет одним UPDATE, а не 500 раз. Функция security definer, потому что
-- у клиентов нет права UPDATE на колонки счётчиков.
--
-- Удалять отзывы можно только через DELETE. TRUNCATE не вызывает эти триггеры,
-- и счётчики разойдутся с реальным числом строк. У anon и authenticated права
-- TRUNCATE нет (см. revoke all ниже), но service_role и postgres его имеют.

create function public.sync_dataset_review_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.datasets d
    set reviews_count = d.reviews_count + s.total,
        analyzed_count = d.analyzed_count + s.analyzed
    from (
      select dataset_id,
             count(*) as total,
             count(*) filter (where analysis_status = 'done') as analyzed
      from new_rows
      group by dataset_id
    ) s
    where d.id = s.dataset_id;

  elsif tg_op = 'DELETE' then
    update public.datasets d
    set reviews_count = d.reviews_count - s.total,
        analyzed_count = d.analyzed_count - s.analyzed
    from (
      select dataset_id,
             count(*) as total,
             count(*) filter (where analysis_status = 'done') as analyzed
      from old_rows
      group by dataset_id
    ) s
    where d.id = s.dataset_id;

  else
    update public.datasets d
    set reviews_count = d.reviews_count + s.total,
        analyzed_count = d.analyzed_count + s.analyzed
    from (
      select dataset_id, sum(total) as total, sum(analyzed) as analyzed
      from (
        select dataset_id, 1 as total, (analysis_status = 'done')::int as analyzed
        from new_rows
        union all
        select dataset_id, -1, -(analysis_status = 'done')::int
        from old_rows
      ) changes
      group by dataset_id
    ) s
    where d.id = s.dataset_id
      and (s.total <> 0 or s.analyzed <> 0);
  end if;

  return null;
end;
$$;

revoke execute on function public.sync_dataset_review_counts() from public, anon, authenticated;

create trigger reviews_counts_after_insert
  after insert on public.reviews
  referencing new table as new_rows
  for each statement execute function public.sync_dataset_review_counts();

create trigger reviews_counts_after_update
  after update on public.reviews
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.sync_dataset_review_counts();

create trigger reviews_counts_after_delete
  after delete on public.reviews
  referencing old table as old_rows
  for each statement execute function public.sync_dataset_review_counts();

-- Лимиты ---------------------------------------------------------------------

-- Не более 20 000 отзывов в датасете держит ограничение datasets_reviews_limit
-- в таблице datasets. Когда sync_dataset_review_counts увеличивает reviews_count
-- сверх лимита, UPDATE падает с check_violation и откатывает всю пачку отзывов.
-- Отдельного триггера нет, зависимости от порядка триггеров тоже. От гонок
-- защищает блокировка строки датасета, которую берёт UPDATE счётчиков.

-- Не более 20 датасетов на пользователя. Демо-датасеты без владельца не считаются.
-- Advisory-блокировка по owner_id не даёт двум параллельным вставкам
-- одновременно увидеть 19 датасетов.

create function public.enforce_datasets_per_owner_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('datasets_per_owner:' || new.owner_id::text, 0));

  if (select count(*) from public.datasets where owner_id = new.owner_id) >= 20 then
    raise exception 'Нельзя создать больше 20 датасетов'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_datasets_per_owner_limit() from public, anon, authenticated;

create trigger datasets_limit_before_insert
  before insert on public.datasets
  for each row execute function public.enforce_datasets_per_owner_limit();

-- RLS ------------------------------------------------------------------------
-- Демо-датасеты читают все, включая anon. Меняет их только service_role.

alter table public.datasets enable row level security;
alter table public.reviews enable row level security;

create policy datasets_select_demo_or_own
  on public.datasets for select
  to anon, authenticated
  using (is_demo or owner_id = (select auth.uid()));

create policy datasets_insert_own
  on public.datasets for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and not is_demo);

create policy datasets_update_own
  on public.datasets for update
  to authenticated
  using (owner_id = (select auth.uid()) and not is_demo)
  with check (owner_id = (select auth.uid()) and not is_demo);

create policy datasets_delete_own
  on public.datasets for delete
  to authenticated
  using (owner_id = (select auth.uid()) and not is_demo);

create policy reviews_select_demo_or_own
  on public.reviews for select
  to anon, authenticated
  using (
    dataset_id in (
      select id from public.datasets
      where is_demo or owner_id = (select auth.uid())
    )
  );

create policy reviews_insert_own
  on public.reviews for insert
  to authenticated
  with check (
    dataset_id in (
      select id from public.datasets
      where owner_id = (select auth.uid()) and not is_demo
    )
  );

create policy reviews_update_own
  on public.reviews for update
  to authenticated
  using (
    dataset_id in (
      select id from public.datasets
      where owner_id = (select auth.uid()) and not is_demo
    )
  )
  with check (
    dataset_id in (
      select id from public.datasets
      where owner_id = (select auth.uid()) and not is_demo
    )
  );

create policy reviews_delete_own
  on public.reviews for delete
  to authenticated
  using (
    dataset_id in (
      select id from public.datasets
      where owner_id = (select auth.uid()) and not is_demo
    )
  );

-- Права Data API -------------------------------------------------------------
-- Вместо автоматических GRANT ALL выдаём только нужное. Колонки owner_id,
-- is_demo, счётчики и результаты анализа клиент записать не может:
-- их заполняют значения по умолчанию, триггер или service_role.

revoke all on table public.datasets, public.reviews from anon, authenticated;

grant select on table public.datasets, public.reviews to anon;
grant select, delete on table public.datasets, public.reviews to authenticated;

grant insert (name, description), update (name, description)
  on table public.datasets to authenticated;

grant insert (dataset_id, body, score, author, source, reviewed_at),
      update (body, score, author, source, reviewed_at)
  on table public.reviews to authenticated;
