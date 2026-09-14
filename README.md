# ReviewLens

AI-анализ отзывов клиентов: загрузка отзывов из CSV, определение тональности и темы через LLM, таблица с фильтрами и дашборд.

## База данных

Схема и политики — в `supabase/migrations/`. Проект Supabase облачный, Docker не используется.

- `npx supabase db push --linked --dry-run` — показать, какие миграции будут применены
- `npx supabase db push --linked` — применить миграции
- `npm run db:types` — сгенерировать `src/lib/database.types.ts` после изменения схемы

## Демо-данные

`npm run seed` создаёт демо-датасет «Демо: интернет-магазин» на 5000 отзывов. Генератор — в `scripts/seed/`, сам скрипт — `scripts/seed.ts`.

1. Скопируйте `.env.example` в `.env` и заполните ключи из Project Settings → API Keys.
2. Запустите `npm run seed`.

Скрипт пишет с ключом service_role, который обходит RLS. Этот ключ хранится только в `.env` и никогда не получает префикс `VITE_` — иначе попадёт в клиентский бандл.

Повторный запуск безопасен: скрипт обновляет тот же датасет, удаляет его отзывы через `DELETE` и вставляет заново. Тексты при каждом запуске одинаковые, даты отсчитываются от дня запуска. В конце скрипт проверяет счётчики и то, что анонимный клиент видит демо-отзывы.

## Вход

Вход по коду из письма (Supabase Auth, email OTP) с проверкой на робота через Cloudflare Turnstile. Первый вход создаёт аккаунт, ввод кода подтверждает почту.

### Настройки облачного проекта

Меняются вручную в разделе Authentication облачного проекта в Supabase Dashboard.

> **Не используйте `supabase config push`.** Локальный `config.toml` расходится с облаком (длина кода, MFA, Twilio, Site URL), и push перезаписал бы облачные настройки. Предварительно посмотреть расхождения: `npx supabase config diff`.

1. **Email:** вход по почте включён, подтверждение email включено, длина кода — 8 цифр. Длина кода зашита в `OTP_LENGTH` в `src/features/auth/schema.ts`: при изменении настройки поменяйте и её.
2. **Шаблоны писем:** в «Confirm signup» (первый вход) и «Magic Link» (повторные входы) вставьте текст из `supabase/templates/otp-code.html` — он содержит `{{ .Token }}`. Без него письмо придёт со ссылкой, а не с кодом.
3. **CAPTCHA:** провайдер Turnstile, секретный ключ из Cloudflare. Публичный ключ сайта — в `.env` как `VITE_TURNSTILE_SITE_KEY`. Для разработки подходят тестовые ключи Cloudflare, которые всегда проходят проверку: ключ сайта `1x00000000000000000000AA` и парный секрет `1x0000000000000000000000000000000AA`.
4. **URL Configuration:** Site URL и Redirect URLs должны включать адрес приложения, для разработки — `http://localhost:5173`.
5. **SMTP:** встроенная отправка писем Supabase подходит только для разработки — у неё низкий лимит и она отправляет письма только адресам участников проекта. Для реальных пользователей подключите свой SMTP.

## Проверка политик RLS

Автотестов политик нет (pgTAP требует локальный Supabase). Проверяйте вручную в SQL Editor облачного проекта после каждой миграции, которая меняет таблицы, политики или права.

### Подготовка

1. Создайте двух пользователей в Authentication → Users и подставьте их id вместо `<USER_A>` и `<USER_B>`.
2. Каждый сценарий выполняйте в отдельной транзакции: ошибка прерывает транзакцию, а `rollback` убирает тестовые данные.

Шаблон транзакции:

```sql
begin;

-- Данные создаются от имени postgres: RLS и права на колонки не действуют
insert into public.datasets (id, owner_id, name, is_demo) values
  ('11111111-1111-1111-1111-111111111111', null, 'Демо', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '<USER_A>', 'Датасет A', false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '<USER_B>', 'Датасет B', false);

insert into public.reviews (dataset_id, body) values
  ('11111111-1111-1111-1111-111111111111', 'Демо-отзыв'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Отзыв A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Отзыв B');

-- Действовать как пользователь A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);

-- Или как анонимный посетитель
-- set local role anon;
-- select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- Запрос сценария

rollback;
```

### Сценарии

Коды ошибок: `42501` — нет прав или нарушена политика RLS, `23514` — нарушено ограничение.

**Чтение**

| # | Роль | Запрос | Ожидается |
|---|---|---|---|
| 1 | anon | `select name from datasets;` | только «Демо» |
| 2 | anon | `select body from reviews;` | только «Демо-отзыв» |
| 3 | A | `select name from datasets;` | «Демо» и «Датасет A», без «Датасет B» |
| 4 | A | `select body from reviews;` | «Демо-отзыв» и «Отзыв A» |

**Запись: anon**

| # | Запрос | Ожидается |
|---|---|---|
| 5 | `insert into datasets (name) values ('x');` | `42501 permission denied` |

**Запись: пользователь A, свои данные**

| # | Запрос | Ожидается |
|---|---|---|
| 6 | `insert into datasets (name) values ('Новый') returning owner_id;` | успех, `owner_id` = A |
| 7 | `insert into datasets (name, owner_id) values ('x', '<USER_B>');` | `42501 permission denied` (колонка не разрешена) |
| 8 | `update datasets set is_demo = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';` | `42501 permission denied` |
| 9 | `update datasets set reviews_count = 0 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';` | `42501 permission denied` |
| 10 | `update reviews set sentiment = 'positive';` | `42501 permission denied` (результаты анализа пишет только service_role) |
| 11 | `update reviews set dataset_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';` | `42501 permission denied` |

**Запись: пользователь A, чужие и демо-данные**

| # | Запрос | Ожидается |
|---|---|---|
| 12 | `insert into reviews (dataset_id, body) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x');` | `42501 new row violates row-level security policy` |
| 13 | `insert into reviews (dataset_id, body) values ('11111111-1111-1111-1111-111111111111', 'x');` | `42501 new row violates row-level security policy` |
| 14 | `update datasets set name = 'x' where id in ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111');` | `UPDATE 0`, без ошибки |
| 15 | `delete from reviews where dataset_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';` | `DELETE 0`, без ошибки |

### Счётчики и лимиты

Роль указана для запроса сценария; подготовка данных всегда идёт от postgres.

| # | Роль | Запрос | Ожидается |
|---|---|---|---|
| 16 | A | `insert into reviews (dataset_id, body) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x'), ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'y');` затем `delete from reviews where body = 'x';` затем `select reviews_count from datasets where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';` | `2` |
| 17 | postgres | `update reviews set analysis_status = 'done', sentiment = 'positive', topic = 'delivery' where body = 'Отзыв A';` затем `select analyzed_count from datasets where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';` | `1` |
| 18 | A | `insert into datasets (name) select 'x' || g from generate_series(1, 20) g;` | `23514 Нельзя создать больше 20 датасетов` (у A уже есть один) |
| 19 | postgres | `insert into reviews (dataset_id, body) select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x' from generate_series(1, 20000);` | `23514 ... violates check constraint "datasets_reviews_limit"`, ни одна строка не вставлена |

Удалять отзывы можно только через `DELETE`: `TRUNCATE` не вызывает триггеры, и счётчики разойдутся с реальным числом строк.
