/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Le tag livré (`v1.23.0`), figé au build par `livrer.yml` ; absent en dev et en CI de PR. */
  readonly VITE_VERSION?: string
  /** Le SHA court du Journal, figé au build par `livrer.yml` ; absent en dev et en CI de PR. */
  readonly VITE_COMMIT?: string
}
