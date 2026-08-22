/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API do backend, ex.: http://localhost:8000/api */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
