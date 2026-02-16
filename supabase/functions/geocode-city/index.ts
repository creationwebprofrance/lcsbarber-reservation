import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const geocodeSchema = z.object({
  city: z.string().trim().min(2, "City name too short").max(100, "City name too long"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = geocodeSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { city } = parsed.data;
    const MAPBOX_ACCESS_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

    if (!MAPBOX_ACCESS_TOKEN) {
      throw new Error("MAPBOX_ACCESS_TOKEN not configured");
    }

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=fr&types=place&limit=1`
    );

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return new Response(
        JSON.stringify({ lat, lng, name: data.features[0].place_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "City not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
