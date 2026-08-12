// Briše fajl sa Cloudflare R2 (bucket gymapp-blog).
//
// ZAŠTO EDGE FUNCTION: isti razlog kao r2-presign — R2 API ključevi ne smiju
// nikad stići u Angular bundle, pa ovdje ostaju u Supabase function secrets.
// Ovo NE briše red iz `blog_media` (to radi BlogService.deleteMedia() direktno
// preko Supabase klijenta) — samo čisti sam fajl sa R2, da ne ostane siroče.
//
// POZIVATI PRIJE brisanja blog_media reda, ne poslije: provjera vlasništva
// ispod čita `uploaded_by` iz tog reda, pa mora još da postoji. Ako reda već
// nema (obrisan u međuvremenu, ili ubačen ručno pa nikad nije ni upisan),
// funkcija ipak briše fajl — nema koga da odbije.
//
// Sekreti — isti kao r2-presign (postaviti preko `supabase secrets set`):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
// SUPABASE_URL i SUPABASE_ANON_KEY su već ubrizgani od strane platforme u
// svaku funkciju — ne treba ih ručno postavljati.

import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { key } = await req.json();
    if (typeof key !== "string" || !key) {
      return jsonResponse({ error: "key je obavezan" }, 400);
    }

    // Isti Authorization header koji je Supabase već provjerio (verify_jwt,
    // podrazumijevano uključeno) — ovdje ga samo iskoristimo da saznamo KO zove.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Nisi prijavljen." }, 401);
    }

    // Vlasništvo: briši samo svoju objavu. Ako reda više nema (već obrisan,
    // ili fajl nikad nije ni imao red — npr. ručno ubačen preko R2 dashboarda),
    // nema koga da odbijemo, pa se briše.
    const { data: row, error: rowError } = await supabase
      .from("blog_media")
      .select("uploaded_by")
      .eq("key", key)
      .maybeSingle();

    if (rowError) throw rowError;

    if (row && row.uploaded_by !== userData.user.id) {
      return jsonResponse({ error: "Nisi vlasnik ove objave." }, 403);
    }

    const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

    // client.fetch (ne client.sign) — ovdje odmah i POTPISUJE i ŠALJE zahtjev,
    // za razliku od r2-presign koji samo vraća potpisani URL klijentu.
    const deleteResponse = await client.fetch(objectUrl, { method: "DELETE" });

    // R2 vraća 404 i kad fajl već ne postoji — to je uspjeh iz perspektive
    // pozivaoca (cilj, "fajl ne postoji", je ionako postignut), ne greška.
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      return jsonResponse({ error: `R2 delete nije uspio (${deleteResponse.status})` }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
