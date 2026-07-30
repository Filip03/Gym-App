/**
 * Prevođenje grešaka u poruke koje nekome nešto znače.
 *
 * Kad baza nije dostupna, `fetch` baca `TypeError: Failed to fetch` — poruka
 * koja korisniku ne govori ništa, a razvijaču vrlo malo. Najčešći uzroci su
 * pokrenut `npm start` bez lokalne baze, ili prosto nema interneta.
 */
export function humanError(err: unknown, fallback = 'Došlo je do greške.'): string {
  const raw = (err as any)?.message ?? '';

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return 'Nema veze sa bazom. Provjeri internet, pa pokušaj ponovo.';
  }

  if (/invalid login credentials/i.test(raw)) {
    return 'Pogrešno korisničko ime ili lozinka.';
  }

  if (/user already registered|already been registered/i.test(raw)) {
    return 'Taj email je već registrovan.';
  }

  if (/duplicate key.*username|profiles_username_key/i.test(raw)) {
    return 'To korisničko ime je zauzeto.';
  }

  if (/password should be at least/i.test(raw)) {
    return 'Lozinka mora imati bar 6 znakova.';
  }

  if (/relation .* does not exist/i.test(raw)) {
    return 'Baza nema potrebne tabele. Vidi supabase/cloud/README.md.';
  }

  // Dropset se veže na red iz `exercice_logs`. Ako je ta serija u međuvremenu
  // obrisana — najčešće na drugom uređaju, dok je ovaj ekran ostao otvoren —
  // baza odbije upis. Korisniku je do sada išla sirova poruka o stranom ključu.
  if (/dropset_logs_exercice_log_id_fkey/i.test(raw)) {
    return 'Ta serija više ne postoji — vjerovatno je obrisana na drugom uređaju.';
  }

  return raw || fallback;
}
