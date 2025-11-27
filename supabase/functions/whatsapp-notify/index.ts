// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NotifyRequest = {
  to: string;
  text?: string;
  template?: {
    name: string;
    language?: string;
    variables?: string[];
  };
};

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

async function sendWhatsApp(req: NotifyRequest) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    return new Response(JSON.stringify({ error: "Missing WhatsApp credentials" }), { status: 500 });
  }

  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`;

  const payload: any = {
    messaging_product: "whatsapp",
    to: req.to,
  };

  if (req.text) {
    payload.type = "text";
    payload.text = { body: req.text };
  } else if (req.template) {
    payload.type = "template";
    payload.template = {
      name: req.template.name,
      language: { code: req.template.language || "pt_BR" },
      components: req.template.variables && req.template.variables.length > 0 ? [
        {
          type: "body",
          parameters: req.template.variables.map((v) => ({ type: "text", text: v })),
        },
      ] : undefined,
    };
  } else {
    return new Response(JSON.stringify({ error: "No content to send" }), { status: 400 });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.text();
  return new Response(data, { status: res.status });
}

serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const body = await request.json() as NotifyRequest;
    if (!body.to) {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), { status: 400 });
    }
    return await sendWhatsApp(body);
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), { status: 500 });
  }
});

