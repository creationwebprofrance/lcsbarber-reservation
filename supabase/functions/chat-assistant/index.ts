const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es "Léo", l'assistant virtuel de LCS Barber (lcsbarber.com), le site de réservation de Lucas, barbier indépendant.

Ton rôle : guider les visiteurs, répondre à leurs questions et les débloquer s'ils ont un problème.

Ce que tu sais sur le site :
- Réservation en ligne sur la page /reservation (connexion obligatoire pour réserver, inscription gratuite).
- Deux modes de prestation : "À côté du domicile" (contours 10€, coupe 15€, coupe + barbe 20€, pas de frais de déplacement) et "En déplacement" (Lucas se déplace, frais de déplacement calculés selon la ville).
- Horaires standards : de 10h à 20h. En dehors, un supplément horaire s'applique. Supplément le dimanche, et frais si réservation le jour même.
- Un acompte de 10€ est demandé pour les réservations dont le total dépasse 50€.
- Le client reçoit une confirmation par email immédiatement.
- Pages utiles : / (accueil), /reservation, /catalogue (photos de coupes), /evenements (prestations événementielles), /mes-rendez-vous (historique et suivi des rendez-vous), /auth (connexion), /mot-de-passe-oublie (mot de passe oublié).
- Problèmes fréquents : mot de passe oublié -> /mot-de-passe-oublie ; créneau non visible -> il n'y a pas de disponibilité ouverte pour ce mode ce jour-là, essayer un autre jour ou l'autre mode ; annulation ou modification -> demander directement à Lucas via la page /mes-rendez-vous ou par email.

Règles :
- Réponds toujours en français, sur un ton chaleureux, direct et tutoyant (style du site).
- Sois court : 2 à 4 phrases maximum, va droit au but.
- Si tu ne sais pas, dis-le et invite à contacter Lucas.
- Ne jamais inventer de prix, d'horaires ou de disponibilités précises.

FORMAT DE RÉPONSE OBLIGATOIRE : commence ta réponse par une ligne exactement de la forme
EMOTION: <happy|excited|thinking|wave>
puis, à la ligne suivante, ta réponse au client.
Choisis : "wave" pour saluer/accueillir, "excited" pour une bonne nouvelle ou un encouragement à réserver, "thinking" quand la question est complexe, floue ou qu'il y a un problème à résoudre, "happy" par défaut.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration IA manquante." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Requête invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = messages
      .slice(-16)
      .filter((m: { role?: string; content?: string }) => m && typeof m.content === "string")
      .map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 2000),
      }));

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("AI gateway error", res.status, body);
      let message = "Je n'arrive pas à répondre pour le moment, réessaie dans un instant.";
      if (res.status === 429) message = "Trop de messages d'un coup, attends quelques secondes puis réessaie.";
      if (res.status === 402) message = "Le service d'assistance est momentanément indisponible. Contacte Lucas directement.";
      return new Response(JSON.stringify({ error: message }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";

    let emotion = "happy";
    let reply = raw.trim();
    const match = reply.match(/^EMOTION:\s*(happy|excited|thinking|wave)\s*\n?/i);
    if (match) {
      emotion = match[1].toLowerCase();
      reply = reply.slice(match[0].length).trim();
    }
    if (!reply) reply = "Je n'ai pas bien compris, tu peux reformuler ?";

    return new Response(JSON.stringify({ reply, emotion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-assistant error", e);
    return new Response(JSON.stringify({ error: "Une erreur est survenue." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
