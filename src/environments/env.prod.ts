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
  r2PublicUrl: 'https://pub-57773944709f45ac8032f82aa78d6a4c.r2.dev'
};
