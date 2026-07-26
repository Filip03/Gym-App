// RAZVOJNO okruženje — gađa LOKALNI Supabase (Docker).
//
// Pokreni prvo:  npm run db:start
// Studio (pregled baze):  http://127.0.0.1:54323
//
// Adresa se izvodi iz onoga na čemu je stranica otvorena, a NE piše fiksno kao
// 127.0.0.1. Razlog: aplikacija se testira i sa telefona na istoj Wi-Fi mreži,
// gdje se laptopu pristupa preko npr. http://192.168.1.224:4300 — a tamo bi
// "127.0.0.1" značilo sam telefon, pa nijedan zahtjev ne bi prošao.
//
// Supabase je već vezan na sve interfejse (0.0.0.0:54321), pa ništa drugo ne
// treba mijenjati. Za pristup sa telefona koristi:  npm run start:lan
const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';

// Ključ lokalnog stacka je fiksni demo ključ — isti na svakoj mašini, nije
// tajna. Produkcijski podaci su u env.prod.ts, koji Angular automatski podmeće
// pri produkcijskom buildu (fileReplacements u angular.json).
export const environment = {
  production: false,
  supabaseUrl: 'https://nsiwfwjpzyzfzxejewar.supabase.co',
  supabaseKey: 'sb_publishable_CbJq3HcEN3pE7Gr_hWSkCw_jeooBZ0m',

  // Javni bucket na Cloudflare R2 (blog slike/video). Nije tajna — isto kao
  // Supabase Storage public URL, samo drugi provajder. Ključevi za PISANJE su
  // isključivo u supabase/functions/r2-presign, nikad ovdje.
  r2PublicUrl: 'https://pub-57773944709f45ac8032f82aa78d6a4c.r2.dev'
}
