// Bindings and variables from wrangler.toml.
declare namespace Cloudflare {
  interface Env {
    Room: DurableObjectNamespace<import('./Room').Room>;
    DATA_ORIGIN: string;
    ALLOWED_ORIGINS: string;
  }
}
interface Env extends Cloudflare.Env {}
