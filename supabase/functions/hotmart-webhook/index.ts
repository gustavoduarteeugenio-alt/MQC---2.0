// Webhook da Hotmart: libera ou retira o acesso ao app conforme o status da compra do curso.
//
// Secrets necessários na Edge Function:
//   HOTMART_HOTTOK       token da conta Hotmart (enviado no header X-HOTMART-HOTTOK)
//   HOTMART_PRODUCT_IDS  opcional; IDs de produto separados por vírgula que dão acesso ao app
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseHotmartEvent, parseProductIds, tokensMatch } from "./events.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expectedToken = Deno.env.get("HOTMART_HOTTOK");
  if (!expectedToken) {
    console.error("HOTMART_HOTTOK não configurado");
    return json({ error: "not configured" }, 500);
  }
  if (!tokensMatch(req.headers.get("x-hotmart-hottok"), expectedToken)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const evt = parseHotmartEvent(body, {
    allowedProductIds: parseProductIds(Deno.env.get("HOTMART_PRODUCT_IDS")),
  });
  if (!evt) return json({ error: "invalid payload" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("apply_hotmart_event", {
    _hotmart_event_id: evt.eventId,
    _event: evt.event,
    _action: evt.action,
    _transaction: evt.transaction,
    _email: evt.email,
    _buyer_name: evt.buyerName,
    _product_id: evt.productId,
    _purchase_status: evt.purchaseStatus,
    _event_at: evt.eventAt,
    _approved_at: evt.approvedAt,
  });

  if (error) {
    // 5xx faz a Hotmart reenviar o evento mais tarde
    console.error("apply_hotmart_event falhou", { event: evt.event, transaction: evt.transaction, error: error.message });
    return json({ error: "processing failed" }, 500);
  }

  console.log("hotmart event", { event: evt.event, action: evt.action, transaction: evt.transaction, result: data });
  return json({ ok: true, action: evt.action, result: data });
});
