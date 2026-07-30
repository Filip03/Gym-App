// Generiše presigned PUT URL za Cloudflare R2 (bucket gymapp-blog).
//
// ZAŠTO EDGE FUNCTION: R2 API ključevi (Access Key ID / Secret Access Key) ne
// smiju nikad stići u Angular bundle — bilo ko bi mogao njima da piše u
// bucket. Zato Angular ovdje samo TRAŽI kratkotrajni potpisani URL, a stvarne
// ključeve drži isključivo ova funkcija (Supabase function secrets).
//
// Podrazumijevano Supabase provjerava JWT prije poziva funkcije (verify_jwt),
// pa je ovo dostupno samo prijavljenim korisnicima — ništa dodatno nije
// potrebno podešavati.
//
// Sekreti (postaviti preko `supabase secrets set`, NIKAD u kod):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

import { AwsClient } from "npm:aws4fetch@1.0.20";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;

// Koliko dugo potpisani URL važi. Klijent otprema odmah nakon dobijanja URL-a,
// pa 5 minuta ostavlja dosta prostora bez nepotrebnog rizika.
const PRESIGN_TTL_SECONDS = 300;

const client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // "*" umjesto pobrojane liste — supabase-js dodaje svoje headere (npr.
  // x-client-info) koji se mijenjaju između verzija biblioteke, pa je
  // nabrajanje stalni izvor "blocked by CORS policy" grešaka.
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
    const { ext } = await req.json();
    // Samo alfanumerički nastavak — ne dozvoljavamo da proizvoljan string uđe u putanju.
    const safeExt = typeof ext === "string" && /^[a-zA-Z0-9]{1,10}$/.test(ext) ? ext : "bin";

    const key = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

    const objectUrl = new URL(
      `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`
    );
    objectUrl.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));

    // signQuery: true -> autorizacija ide kroz query parametre URL-a (presigned
    // URL), ne kroz Authorization header — zato klijent poslije samo radi
    // običan PUT fetch na ovaj URL, bez ikakvih R2 ključeva.
    const signedRequest = await client.sign(objectUrl.toString(), {
      method: "PUT",
      aws: { signQuery: true },
    });

    return jsonResponse({ uploadUrl: signedRequest.url, key });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
