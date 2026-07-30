// RAZVOJNO okruženje — gađa LOKALNI Supabase (Docker).
//
// Pokreni prvo:  npm run db:start
// Studio (pregled baze):  http://127.0.0.1:54323
//
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
  r2PublicUrl: 'https://pub-57773944709f45ac8032f82aa78d6a4c.r2.dev',

  // Spring Boot servis za FCM push notifikacije, deployovan na Render (isti
  // servis kao i env.prod.ts — nema više lokalnog backend-a za dev).
  apiBaseUrl: 'https://gym-app-firebase.onrender.com',

  // Firebase Web app config (projekat gym-app-73338, isti koji koristi i
  // backend za slanje). apiKey/appId nisu tajna — Firebase ih namjerno šalje
  // u svaki browser koji učita stranicu; sigurnost je na serveru, ne ovdje.
  firebase: {
    apiKey: 'AIzaSyAaBAYIP_ni5Vs7PFemgYPbFqL8pqLaSHY',
    authDomain: 'gym-app-73338.firebaseapp.com',
    projectId: 'gym-app-73338',
    storageBucket: 'gym-app-73338.firebasestorage.app',
    messagingSenderId: '354056038315',
    appId: '1:354056038315:web:ecb4521076b0986c18d4ee',
    measurementId: 'G-2GL2B9SFSQ',
    vapidKey: 'BPSG_BdbjHADayISGSaTIcHE7Jf3xCHX7b3sLyxIn1zjcAFLSqUJLIK2PZ5j35Q0pBlhApujW4ofqG6Ab_Dp9MY'
  }
}
