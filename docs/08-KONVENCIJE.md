# 08 — Konvencije

Izvedeno iz postojećeg koda. **Cilj je da kolega prepozna svoj kod** — nove
izmjene treba da izgledaju kao da ih je pisao isti čovjek, osim tamo gdje se
konvencija svjesno mijenja (i to onda ide u ADR).

---

## Jezik

| Gdje | Jezik |
|---|---|
| Nazivi u kodu (klase, metode, polja) | engleski — `getPlanForUser`, `loggedSets` |
| Stringovi vidljivi korisniku | **srpski/bosanski, latinica** — `'Sačuvaj plan'` |
| Komentari | srpski/bosanski |
| Dokumentacija | srpski/bosanski |
| Poruke commita | srpski/bosanski, kratke |

Dijakritika se piše (`č`, `ć`, `ž`, `š`, `đ`) — postojeći kod je koristi.

### `exercice`, ne `exercise`

Kroz cijeli kod i bazu koristi se `exercice`. To je zadržano **namjerno** —
ispravka bi tražila migraciju baze i dodirnula svaki fajl bez ikakve koristi za
korisnika. Piši `exercice` i u novom kodu. (`04-ROADMAP.md` → van opsega.)

---

## Servisi

Jedan servis po domenu, u `src/app/services/`. Svi su `providedIn: 'root'`.

```ts
@Injectable({ providedIn: 'root' })
export class NekiService {
  constructor(private supabase: SupabaseService) {}

  async getNesto(id: string): Promise<Tip[]> {
    const { data, error } = await this.supabase.client
      .from('tabela')
      .select('*')
      .eq('kolona', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Tip[];
  }
}
```

Pravila:

- Sve metode `async`, uvijek `const { data, error } = await ...`
- `if (error) throw error;` odmah nakon poziva — **servis baca, komponenta hvata**
- Bez `try/catch` u servisu osim kad se greška stvarno obrađuje
- `SupabaseService` je jedino mjesto koje kreira klijenta — nikad ne pozivaj
  `createClient()` nigdje drugdje
- `.maybeSingle()` kad red možda ne postoji, `.single()` kad mora postojati

---

## Komponente

```ts
export class NekaComponent implements OnInit {
  loading = true;
  errorMessage = '';

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    try {
      this.podaci = await this.nekiService.getNesto(user.id);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju podataka.';
    } finally {
      this.loading = false;
    }
  }
}
```

Pravila:

- Polja `loading` i `errorMessage` na svakoj komponenti koja učitava podatke
- `catch (err: any)` → `err.message ?? 'Poruka na našem jeziku.'`
- `finally` uvijek gasi `loading`
- Zasebna polja za zasebne operacije: `creating`, `saving`, `uploading`,
  `followLoading`, `createError`, `saveError`, `uploadError`
- Nema shared state managementa — svaka komponenta učitava svoje

### Forme

**Template-driven**, ne Reactive Forms:

```html
<form (ngSubmit)="onSubmit()" #nekiForm="ngForm">
  <input name="naziv" [(ngModel)]="naziv" required />
  <button type="submit" [disabled]="creating || !nekiForm.valid">
    {{ creating ? 'Čuvam...' : 'Sačuvaj' }}
  </button>
</form>
```

### Modali

```html
<div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
  <div class="modal-card" (click)="$event.stopPropagation()">
    ...
  </div>
</div>
```

`*ngIf` na overlay (ne `[hidden]`), klik na overlay zatvara, `stopPropagation` na
kartici. Za široke modale dodaj klasu `modal-card-large`.

### Ikone

Material Icons: `<i class="material-icons">naziv_ikone</i>`.
Za klikabilne koristi `<span>` ili `<i>` sa `(click)` — ne `<button>`, tako je
u postojećem kodu.

---

## Modeli

Svi interfejsi u `src/app/models/models.ts`, jedan fajl.

- Nazivi polja **tačno kao kolone u bazi**: `profile_pic_url`, `target_sets`,
  `set_number` — snake_case, jer dolaze direktno iz PostgREST-a
- Nullable kolone → `| null`, ne `?`
- Tipovi specifični za jedan servis idu uz taj servis
  (`LeaderboardEntry` u `leaderboard.service.ts`, `ProgressPoint` u `profile.service.ts`)

### O `any`

Postojeći kod koristi `any` za rezultate ugniježđenih JOIN upita
(`viewedPlan: any`, `plan: any`). **U novom kodu to ne radi** — piši tip, makar
lokalni interfejs uz komponentu. Postojeći `any` se čisti u Fazi 4.

---

## SCSS

Jedan `.scss` po komponenti. Bez UI biblioteke, bez globalnih utility klasa.

Trenutne vrijednosti (hardkodirane u svakoj datoteci — Faza 4.6 ih izvlači u tokene):

| Uloga | Vrijednost |
|---|---|
| Akcenat | `greenyellow` |
| Sjena akcenta | `rgba(173, 255, 47, 0.4)` |
| Pozadina kartice | `rgba(255, 255, 255, 0.05)` |
| Ivica kartice | `1px solid rgba(255, 255, 255, 0.15)` |
| Zamućenje | `backdrop-filter: blur(12px)` |
| Radijus kartice | `20px` |
| Radijus polja | `8px` |
| Greška | `#ff6b6b` |
| Sekundarni tekst | `rgba(255, 255, 255, 0.75)` |
| Pozadina modala | `rgba(20, 20, 20, 0.9)` |
| Prelaz | `transition: all 0.2s ease-in-out` |

Mobilni prelom: `@media (max-width: 768px)`. Ista granica se koristi i u TS-u
(`dashboard.component.ts:79` — `window.innerWidth <= 768`).

**Budžet stilova je 8kb po komponenti** (`angular.json`, `anyComponentStyle`) —
`dashboard.component.scss` je već blizu granice sa 857 linija.

---

## Rutiranje

`app-routing.module.ts`, sve eager-loaded. Nova ruta = unos u niz + deklaracija u
`app.module.ts` (osim standalone komponenti — `LoginComponent` i
`RegisterComponent` idu u `imports`).

Ako ruta treba da sakrije logo ili footer, dodaj je u listu u
`app.component.ts:20-28`.

---

## Git

- Radna grana: `XFactor`. Ne push-uj na `main` bez dogovora.
- Poruke commita kratke i na našem jeziku, kao postojeće (`trening`, `dashboard`,
  `profile pic`) — ali dodaj kontekst kad izmjena nije očigledna.
- **Svaki commit koji mijenja ponašanje traži unos u `06-CHANGELOG.md`.**

---

## Šta se ne radi bez razgovora

1. Sigurnosne popravke usput — vidi `03-SIGURNOST.md`
2. Migracija Angulara ili prelazak na standalone komponente
3. Zamjena template-driven formi Reactive formama
4. Preimenovanje `exercice` → `exercise`
5. Deploy na Vercel
6. `npm audit fix --force`
