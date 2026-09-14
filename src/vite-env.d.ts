/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Могут отсутствовать: значения проверяет parseClientEnv в src/lib/env.ts
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
  readonly VITE_TURNSTILE_SITE_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
