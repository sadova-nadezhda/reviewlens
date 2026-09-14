# ReviewLens

AI-анализ отзывов клиентов: загрузка отзывов из CSV, определение тональности и темы через LLM, таблица с фильтрами и дашборд.

## Стек

- React 19, TypeScript (strict), Vite
- TanStack Query — все запросы к данным
- TanStack Table + TanStack Virtual — таблица отзывов
- shadcn/ui, Tailwind CSS
- React Hook Form + Zod — формы и валидация
- Recharts — графики
- Supabase: Postgres, Auth, Row Level Security, Edge Functions
- Vitest + Testing Library — тесты

## Команды

- `npm run dev` — запуск
- `npm run build` — сборка с проверкой типов
- `npm run lint` — ESLint
- `npm test` — тесты
- `npm run seed` — заполнить базу демо-отзывами (Node-скрипт в `scripts/`)

## Структура

- `src/features/<фича>/` — всё, что относится к фиче: компоненты, хуки, запросы (`api.ts`), схемы Zod (`schema.ts`)
- `src/components/ui/` — компоненты shadcn/ui, не редактировать без необходимости
- `src/lib/` — клиент Supabase, утилиты
- `src/hooks/` — общие хуки, не привязанные к фиче
- `supabase/migrations/` — SQL-миграции
- `supabase/functions/` — Edge Functions
- `scripts/` — Node-скрипты

## Правила

- Никаких `any`. Типы таблиц генерируются командой `supabase gen types`.
- Запросы к Supabase — только через хуки TanStack Query в `features/*/api.ts`, не напрямую из компонентов.
- Ключ LLM API хранится только в секретах Edge Function. Никогда не добавляй его в клиентский код и в переменные `VITE_`.
- Новая таблица — сразу с политиками RLS.
- Логика расчётов (NPS, агрегации для графиков) — в чистых функциях с unit-тестами.
- Работай небольшими шагами: сначала предложи план, после согласования реализуй один шаг и покажи, что изменилось.
- Перед завершением задачи запусти `npm run lint`, `npm test` и `npm run build`.
