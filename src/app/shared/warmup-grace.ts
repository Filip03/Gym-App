/**
 * Koliko minuta poslije `started_at` se trening vodi kao „u toku" i BEZ ijedne
 * upisane serije — vrijeme za svlačionicu i zagrijavanje.
 *
 * Zašto baš ovako: sesija (i njen `started_at`, `default now()`) nastane već
 * pri PRVOM otvaranju ekrana treninga za taj datum, pa sam red u bazi ne
 * dokazuje ništa. Prvih pola sata od starta prisustvo se ipak računa — niko ne
 * upiše seriju čim uđe u teretanu. Poslije toga bez ijedne serije status se
 * gasi: zavirivanje u raspored nije trening.
 *
 * Ista granica služi i kao prag BAJATOG sata: ako se ekran treninga otvori nad
 * sesijom bez serija čiji je `started_at` stariji od ovoga, sat se vraća na
 * sada (`TrainingService.restartSessionClock`) — jučerašnje listanje rasporeda
 * tako ne truje ni tajmer ni „trenira sada".
 */
export const WARMUP_GRACE_MIN = 30;

/**
 * Koliko sati poslije `started_at` se sesija uopšte može voditi kao živa —
 * isti prozor koji koriste dashboard („Trening u toku") i „Trenira sada".
 *
 * Služi i pri ponovnom otvaranju završenog treninga: ako je sat stariji od
 * ovoga, vraća se na sada — inače bi status ostao mrtav iako se trenira.
 * Skorije ponovno otvaranje sat ne dira: „zaboravio sam jednu seriju" odmah
 * po zatvaranju nastavlja da broji od pravog početka.
 */
export const LIVE_WINDOW_H = 4;
