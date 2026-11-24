// Limiteur d'appels partagé pour les fonctions publiques (sans compte).
// L'adresse IP n'est jamais stockée en clair : seule son empreinte SHA-256 salée l'est,
// dans blade_community_limits via la RPC blade_community_limit (service_role uniquement).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sha256 = async (text: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
};

export const clientIp = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";

/** true = appel autorisé. En cas d'erreur technique du limiteur, l'appel est autorisé (pas de blocage des vrais clients). */
export async function allowRequest(req: Request, scope: string, limit: number, seconds: number): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return true;
  const actor = `${scope}:${await sha256(`${scope}|${key.slice(-16)}|${clientIp(req)}`)}`;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("blade_community_limit", { p_actor: actor, p_scope: scope, p_limit: limit, p_seconds: seconds });
  if (error) { console.warn(`rate-limit ${scope}:`, error.message); return true; }
  return data !== false;
}
