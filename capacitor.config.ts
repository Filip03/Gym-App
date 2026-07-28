import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Nativna ljuska (iOS/Android) oko postojeće web aplikacije.
 *
 * ARHITEKTURA: ljuska NE nosi kod aplikacije. Kad je `server.url` uključen,
 * WKWebView učitava produkciju — dakle svaki `git push` na main
 * stiže u aplikaciju SAM, bez novog builda i bez ponovnog sideload-a. Nov
 * build ljuske treba tek kad se doda novi nativni dodatak (plugin).
 *
 * Dok je `server` blok zakomentarisan, ljuska služi upakovan `webDir` —
 * korisno samo za prvu probu da li sideload uopšte radi.
 */
const config: CapacitorConfig = {
  // Jedinstven ID: com.gymapp.mobile je već zauzet kod Apple-a, pa registracija
  // besplatnim nalogom pada. Ovaj je vezan za Markov nalog i slobodan.
  appId: 'com.markovucinic66.gymapp',
  appName: 'GymApp',
  webDir: 'dist/gym-app',

  // Stalna produkcijska adresa. NAPOMENA: produkcija je na Cloudflare Pages,
  // ne na Vercelu kako starija dokumentacija tvrdi — provjereno 28.07.2026.
  server: {
    url: 'https://gym-app-1gm.pages.dev'
  },

  ios: {
    // Sadržaj se sam sklanja ispod statusne trake — isto što aplikacija
    // već radi kroz safe-area, pa ljuska ne smije da dodaje svoje razmake.
    contentInset: 'never'
  }
};

export default config;
