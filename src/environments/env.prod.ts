// PRODUKCIJSKO okruženje — cloud Supabase projekat.
//
// Angular ovim fajlom zamjenjuje env.ts pri produkcijskom buildu
// (fileReplacements u angular.json). Do 2026-07-25 ta zamjena nije bila
// podešena, pa se ovaj fajl uopšte nije koristio — a ključ u njemu je imao
// grešku u kucanju ("b_publishable_" umjesto "sb_publishable_").
//
// Anon ključ je javan po dizajnu (šalje se u JS bundle-u). Ovdje ne ide nijedna
// druga tajna — ni service_role ključ, ni DB lozinka.
export const environment = {
  production: true,
  supabaseUrl: 'https://nsiwfwjpzyzfzxejewar.supabase.co',
  supabaseKey: 'sb_publishable_CbJq3HcEN3pE7Gr_hWSkCw_jeooBZ0m',
  r2PublicUrl: 'https://pub-57773944709f45ac8032f82aa78d6a4c.r2.dev',

  // Spring Boot FCM servis, deployovan na Render (vidi ADR-0002).
  apiBaseUrl: 'https://gym-app-firebase.onrender.com',

  // Firebase Web app config — ista vrijednost kao u env.ts, nije environment-specific.
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
};
