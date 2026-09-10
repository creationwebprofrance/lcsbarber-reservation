import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// États explicites retournés par chaque adaptateur
type AdapterStatus =
  | "not_configured"
  | "not_supported"
  | "no_match"
  | "ambiguous"
  | "partial"
  | "matched"
  | "fallback"
  | "quota_exceeded"
  | "temporary_error";

interface AdapterResult {
  provider: string;
  status: AdapterStatus;
  message?: string;
  fields?: Record<string, unknown>;
  candidates?: Record<string, unknown>[];
  quota?: { used: number; max: number; period: string };
  raw_available?: boolean;
}

// Plafonds internes, volontairement sous les quotas gratuits annoncés
const LIMITS = {
  apiplaque: 8, // 10 annoncés
  autoref: 45, // 50 annoncés
  carimages: 4500, // 5000 annoncés
  vpic: 200, // pas de quota officiel, garde-fou local
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function consumeQuota(provider: string, max: number) {
  const { data, error } = await admin.rpc("consume_vehicle_api_quota", {
    _provider: provider,
    _max_calls: max,
  });
  if (error) throw new Error(error.message);
  return data as { allowed: boolean; used: number; max: number; period: string };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const timeout = (ms: number) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, clear: () => clearTimeout(t) };
};

// ---------------------------------------------------------------- API Plaque
async function lookupPlate(plate: string, country: string): Promise<AdapterResult> {
  const key = Deno.env.get("APIPLAQUE_RAPIDAPI_KEY");
  const host = Deno.env.get("APIPLAQUE_RAPIDAPI_HOST") ??
    "api-plaque-immatriculation-siv.p.rapidapi.com";
  if (!key) {
    return { provider: "apiplaque", status: "not_configured", message: "Clé API Plaque absente" };
  }
  if (country !== "FR") {
    return {
      provider: "apiplaque",
      status: "not_supported",
      message: "Ce service ne couvre que les plaques françaises.",
    };
  }

  const quota = await consumeQuota("apiplaque", LIMITS.apiplaque);
  if (!quota.allowed) {
    return { provider: "apiplaque", status: "quota_exceeded", quota };
  }

  const t = timeout(12000);
  try {
    const res = await fetch(
      `https://${host}/get-vehicle-info?immatriculation=${encodeURIComponent(plate)}`,
      {
        headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host },
        signal: t.signal,
      },
    );
    if (res.status === 404) return { provider: "apiplaque", status: "no_match", quota };
    if (!res.ok) {
      return {
        provider: "apiplaque",
        status: "temporary_error",
        message: `Réponse ${res.status}`,
        quota,
      };
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return { provider: "apiplaque", status: "temporary_error", quota };
    }
    const d = (data.data ?? data) as Record<string, string>;
    const fields = {
      make: d.marque ?? d.make ?? null,
      model: d.modele ?? d.model ?? null,
      first_registration: d.date_mise_en_circulation ?? d.date1erCir_fr ?? null,
      vin: d.vin ?? null,
      cnit: d.cnit ?? d.type_mine ?? null,
      tvv: d.tvv ?? null,
      fuel: d.energie ?? d.carburant ?? null,
      displacement_cm3: d.cylindree ?? null,
      power_kw: d.puissance_kw ?? null,
      fiscal_power: d.puissance_fiscale ?? d.puissance ?? null,
      body_type: d.carrosserie ?? null,
      engine_version: d.version ?? null,
    };
    const known = Object.values(fields).filter((v) => v !== null && v !== "").length;
    if (known === 0) return { provider: "apiplaque", status: "no_match", quota };
    return {
      provider: "apiplaque",
      status: known >= 6 ? "matched" : "partial",
      fields,
      quota,
    };
  } catch (_e) {
    return { provider: "apiplaque", status: "temporary_error", message: "Service injoignable", quota };
  } finally {
    t.clear();
  }
}

// ------------------------------------------------------- Base ADEME (France)
// Jeu de données public « ADEME - Car Labelling » : marque + modèle -> versions
const ADEME_BASE =
  "https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling";

// La base ADEME écrit certaines marques différemment
const ADEME_MAKE_ALIASES: Record<string, string> = {
  "bmw": "B.M.W.",
  "mercedes-benz": "MERCEDES",
  "mercedes": "MERCEDES",
  "mg": "M.G.",
  "citroën": "CITROEN",
  "land rover": "LAND ROVER",
  "alfa romeo": "ALFA ROMEO",
};

const GEARBOX_MAP: Record<string, string> = {
  MECANIQUE: "Manuelle",
  AUTOMATIQUE: "Automatique",
  "VARIATION CONTINUE": "Automatique",
};

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s\-'/])([a-zà-ÿ])/g, (_m, a, b) => a + b.toUpperCase());

async function lookupAdeme(make: string, model: string): Promise<AdapterResult> {
  if (!make || !model) {
    return {
      provider: "ademe",
      status: "not_supported",
      message: "Marque et modèle nécessaires.",
    };
  }
  const adMake = ADEME_MAKE_ALIASES[make.toLowerCase().trim()] ?? make.toUpperCase().trim();
  const qs = `Marque:"${adMake.replace(/"/g, "")}" AND Modèle:"${model.replace(/"/g, "")}"`;
  const url = `${ADEME_BASE}/lines?size=30&qs=${encodeURIComponent(qs)}`;

  const t = timeout(12000);
  try {
    const headers: Record<string, string> = {};
    const key = Deno.env.get("ADEME_API_KEY");
    if (key) headers["x-apiKey"] = key;
    const res = await fetch(url, { headers, signal: t.signal });
    if (!res.ok) {
      return { provider: "ademe", status: "temporary_error", message: `Réponse ${res.status}` };
    }
    const body = await res.json().catch(() => null) as
      | { results?: Record<string, unknown>[] }
      | null;
    const rows = body?.results ?? [];
    if (rows.length === 0) return { provider: "ademe", status: "no_match" };

    const variants = rows.map((r) => {
      const g = String(r["Type_de_boite"] ?? "").toUpperCase();
      const fuel = String(r["Energie"] ?? "");
      const fields: Record<string, unknown> = {
        make: titleCase(String(r["Marque"] ?? adMake)),
        model: String(r["Modèle"] ?? model),
        fuel: fuel ? titleCase(fuel) : null,
        body_type: r["Carrosserie"] ? titleCase(String(r["Carrosserie"])) : null,
        gearbox_type: GEARBOX_MAP[g] ?? (g ? titleCase(g) : null),
        displacement_cm3: r["Cylindrée"] ?? null,
        power_kw: r["Puissance_maximale"] ?? null,
        fiscal_power: r["Puissance_fiscale"] ?? null,
        engine_version: r["Description_Commerciale"] ?? null,
      };
      const label = [
        r["Description_Commerciale"] ?? `${r["Marque"]} ${r["Modèle"]}`,
        fuel ? titleCase(fuel) : null,
        GEARBOX_MAP[g] ?? null,
      ].filter(Boolean).join(" · ");
      return { label, fields };
    });

    if (variants.length === 1) {
      return { provider: "ademe", status: "matched", fields: variants[0].fields };
    }
    return {
      provider: "ademe",
      status: "ambiguous",
      message: `${variants.length} versions trouvées — choisis la tienne.`,
      candidates: variants as unknown as Record<string, unknown>[],
    };
  } catch (_e) {
    return { provider: "ademe", status: "temporary_error", message: "Service injoignable" };
  } finally {
    t.clear();
  }
}


// -------------------------------------------------------------- NHTSA vPIC
async function lookupVpic(vin: string): Promise<AdapterResult> {
  const quota = await consumeQuota("vpic", LIMITS.vpic);
  if (!quota.allowed) return { provider: "vpic", status: "quota_exceeded", quota };
  const t = timeout(12000);
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { signal: t.signal },
    );
    if (!res.ok) return { provider: "vpic", status: "temporary_error", quota };
    const body = await res.json();
    const r = body?.Results?.[0];
    if (!r) return { provider: "vpic", status: "no_match", quota };
    const errorCode = String(r.ErrorCode ?? "");
    const fields = {
      make: r.Make || null,
      model: r.Model || null,
      model_year: r.ModelYear || null,
      body_type: r.BodyClass || null,
      fuel: r.FuelTypePrimary || null,
      displacement_cm3: r.DisplacementCC ? Math.round(Number(r.DisplacementCC)) : null,
      power_kw: r.EngineKW ? Number(r.EngineKW) : null,
      engine_code: r.EngineModel || null,
      gearbox_type: r.TransmissionStyle || null,
    };
    const known = Object.values(fields).filter(Boolean).length;
    if (known === 0) return { provider: "vpic", status: "no_match", quota };
    const clean = errorCode === "0" || errorCode === "";
    return { provider: "vpic", status: clean && known >= 5 ? "matched" : "partial", fields, quota };
  } catch (_e) {
    return { provider: "vpic", status: "temporary_error", quota };
  } finally {
    t.clear();
  }
}

// ----------------------------------------------------------- CarImages 3D
async function lookupVisual(
  make: string,
  model: string,
  gen: string | null,
): Promise<AdapterResult> {
  const apiKey = Deno.env.get("CARIMAGES_API_KEY");
  const apiSecret = Deno.env.get("CARIMAGES_API_SECRET");
  if (!apiKey || !apiSecret) return { provider: "carimages", status: "not_configured" };
  if (!make || !model) {
    return {
      provider: "carimages",
      status: "not_supported",
      message: "Marque et modèle nécessaires (jamais de recherche marque seule).",
    };
  }

  const quota = await consumeQuota("carimages", LIMITS.carimages);
  if (!quota.allowed) return { provider: "carimages", status: "quota_exceeded", quota };

  const slug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const genSlug = gen ? slug(gen) : "";
  const url = `https://carimagesapi.com/api/v1/vehicles/${slug(make)}/${slug(model)}/${
    genSlug || "latest"
  }/model?api_key=${encodeURIComponent(apiKey)}&api_secret=${encodeURIComponent(apiSecret)}`;

  const t = timeout(15000);
  try {
    const res = await fetch(url, { signal: t.signal });
    if (res.status === 404) return { provider: "carimages", status: "no_match", quota };
    if (!res.ok) return { provider: "carimages", status: "temporary_error", quota };
    const d = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!d) return { provider: "carimages", status: "temporary_error", quota };
    const modelUrl = (d.url ?? d.model_url ?? d.glb ?? null) as string | null;
    if (!modelUrl) return { provider: "carimages", status: "no_match", quota };
    const isFallback = Boolean(d.fallback);
    return {
      provider: "carimages",
      status: isFallback ? "fallback" : "matched",
      fields: {
        model_url: modelUrl,
        watermarked: Boolean(d.watermarked ?? true),
        fallback: isFallback,
        make: d.make ?? null,
        model: d.model ?? null,
        generation: d.generation ?? null,
      },
      quota,
    };
  } catch (_e) {
    return { provider: "carimages", status: "temporary_error", quota };
  } finally {
    t.clear();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { error: authError } = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps de requête invalide" }, 400);
  }

  const action = String(body.action ?? "");

  try {
    if (action === "quota") {
      const { data } = await admin
        .from("vehicle_api_quota")
        .select("provider, period, call_count, max_calls")
        .order("period", { ascending: false });
      return json({
        quotas: data ?? [],
        limits: LIMITS,
        configured: {
          apiplaque: Boolean(Deno.env.get("APIPLAQUE_RAPIDAPI_KEY")),
          autoref: false,
          ademe: true,
          carimages: Boolean(
            Deno.env.get("CARIMAGES_API_KEY") && Deno.env.get("CARIMAGES_API_SECRET"),
          ),
          vpic: true,
        },
      });
    }

    if (action === "plate") {
      const plate = String(body.plate ?? "").trim().toUpperCase();
      const country = String(body.country ?? "FR").toUpperCase();
      if (plate.length < 4 || plate.length > 15) return json({ error: "Plaque invalide" }, 400);
      return json(await lookupPlate(plate, country));
    }

    if (action === "ademe") {
      const make = String(body.make ?? "").trim();
      const model = String(body.model ?? "").trim();
      return json(await lookupAdeme(make, model));
    }

    // Recherche par VIN européen suspendue : on s'appuie sur la base ADEME.
    if (action === "vin") {
      return json({
        provider: "autoref",
        status: "not_supported",
        message: "La recherche par VIN européen est suspendue. Utilise la base ADEME (marque + modèle).",
      });
    }

    if (action === "vpic") {
      const vin = String(body.vin ?? "").trim().toUpperCase();
      if (vin.length < 6 || vin.length > 25) return json({ error: "VIN invalide" }, 400);
      if (/[IOQ]/.test(vin) && vin.length === 17) {
        return json({
          provider: "vpic",
          status: "not_supported",
          message: "Ce VIN de 17 caractères contient I, O ou Q : à vérifier.",
        });
      }
      return json(await lookupVpic(vin));
    }


    if (action === "visual") {
      const make = String(body.make ?? "").trim();
      const model = String(body.model ?? "").trim();
      const gen = body.generation ? String(body.generation).trim() : null;
      return json(await lookupVisual(make, model, gen));
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("vehicle-lookup error", (e as Error).message);
    return json({ error: "Erreur interne" }, 500);
  }
});
