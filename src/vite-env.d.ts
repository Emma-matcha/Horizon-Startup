/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PICOVOICE_ACCESS_KEY?: string
  readonly VITE_RHINO_CONTEXT_PATH?: string
  readonly VITE_RHINO_MODEL_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
