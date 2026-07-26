// RAZVOJNO okruženje — gađa LOKALNI Supabase (Docker).
//
// Pokreni prvo:  npx supabase start
// Studio (pregled baze):  http://127.0.0.1:54323
//
// Ključ ispod je fiksni demo ključ lokalnog Supabase stacka — isti je na svakoj
// mašini i nije tajna. Produkcijski podaci su u env.prod.ts, koji Angular
// automatski podmeće pri produkcijskom buildu (fileReplacements u angular.json).
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
};
