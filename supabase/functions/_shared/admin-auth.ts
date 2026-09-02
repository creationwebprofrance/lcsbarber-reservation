import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

// Échappe les valeurs interpolées dans du HTML d'email (anti-XSS / injection)
export const escapeHtml = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

// Vérifie que l'appelant est un utilisateur connecté avec le rôle admin.
// Retourne { user } si OK, sinon { error: Response } à renvoyer directement.
export async function requireAdmin(
  req: Request
): Promise<{ user?: { id: string; email?: string }; error?: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      error: new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: cors }),
    };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) {
    return {
      error: new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: cors }),
    };
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) {
    return {
      error: new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers: cors }),
    };
  }

  return { user };
}
