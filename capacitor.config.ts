import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Nativna ljuska (iOS/Android) oko postojeće web aplikacije.
 *
 * ARHITEKTURA: ljuska NE nosi kod aplikacije. Kad je `server.url` uključen,
 * WKWebView učitava produkciju sa Vercela — dakle svaki `git push` na main
 * stiže u aplikaciju SAM, bez novog builda i bez ponovnog sideload-a. Nov
 * build ljuske treba tek kad se doda novi nativni dodatak (plugin).
 *
 * Dok je `server` blok zakomentarisan, ljuska služi upakovan `webDir` —
 * korisno samo za prvu probu da li sideload uopšte radi.
 */
const config: CapacitorConfig = {
  appId: 'com.gymapp.mobile',
  appName: 'GymApp',
  webDir: 'dist/gym-app',

  // TODO(marko): upisati PRAVU produkcijsku adresu (Vercel → projekat →
  // Domains, ona stalna, ne adresa pojedinačnog deploya!) pa otkomentarisati.
  // server: {
  //   url: 'https://OVDJE-PRODUKCIJSKA-ADRESA.vercel.app'
  // },

  ios: {
    // Sadržaj se sam sklanja ispod statusne trake — isto što aplikacija
    // već radi kroz safe-area, pa ljuska ne smije da dodaje svoje razmake.
    contentInset: 'never'
  }
};

export default config;
