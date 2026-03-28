import "../bindings";

declare module "cloudflare:workers" {
  interface ProvidedEnv extends Bindings {}
}
