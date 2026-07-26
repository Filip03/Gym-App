import { Injectable } from '@angular/core';

/**
 * Zvučni efekti aplikacije.
 *
 * ZAŠTO SERVIS, A NE `new Audio()` U KOMPONENTI
 *
 * Svi pregledači blokiraju puštanje zvuka dok korisnik nije ničim dodirnuo
 * stranicu. Raniji kod je zvao `audio.play()` u `ngOnInit` ekrana za prijavu —
 * dakle pri učitavanju stranice, prije ijednog klika — pa je bio blokiran svaki
 * put kad se stranica otvori direktno. Izgledalo je kao da "nekad radi": radilo
 * je samo ako se do ekrana došlo klikom sa druge stranice.
 *
 * Rješenje je Web Audio API: `AudioContext` se otključa jednom, na prvi dodir
 * bilo gdje u aplikaciji. Od tog trenutka zvuk se može pustiti kad god treba,
 * bez novog dodira. To je i jedini način koji radi na iOS Safariju.
 *
 * Servis takođe garantuje da zvuk NIKAD ne blokira tok aplikacije — raniji kod
 * je čekao `onended` prije preusmjeravanja, pa je blokiran autoplay značio da
 * se korisnik nakon uspješne registracije zaglavi na ekranu zauvijek.
 */

export type SoundName = 'login' | 'register' | 'record' | 'avatar' | 'blogAdd';

// Naziv fajla uz originalni "radni naslov", da se zna šta je šta.
const CLIPS: Record<SoundName, string> = {
  login:    'ko-je.m4a',              // "ko je"
  register: 'imun-na-batine.m4a',     // "imun na batine"
  record:   'zmaj-u-mene-25cm.m4a',   // za oboren lični rekord
  avatar:   'obrijanica.m4a',         // klik na profilnu sliku
  blogAdd:  'prskulja.m4a'            // klik na dodavanje fajla u blog
};

const MUTE_KEY = 'gymapp.muted';

@Injectable({ providedIn: 'root' })
export class AudioService {

  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private playing: AudioBufferSourceNode | null = null;
  private unlocked = false;

  muted = localStorage.getItem(MUTE_KEY) === '1';

  constructor() {
    this.armUnlock();
  }

  // ---------------------------------------------------------------------------

  async play(name: SoundName) {
    if (this.muted) return;

    try {
      const ctx = this.context();
      if (!ctx) return;

      // Kontekst zna da se uspava kad je kartica dugo neaktivna.
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running') return;

      const buffer = await this.load(name);
      if (!buffer) return;

      this.startBuffer(ctx, buffer);
    } catch {
      // Zvuk je ukras. Nijedna greška ovdje ne smije zaustaviti aplikaciju.
    }
  }

  /**
   * Pusti odmah ako je moguće; ako nije, pusti na prvi dodir korisnika.
   *
   * Za zvukove koji pripadaju SAMOM DOLASKU na ekran, a ne nekoj radnji —
   * npr. poruka "moraš se predstaviti" na ekranu za prijavu. Takav zvuk se ne
   * može pustiti pri prvom otvaranju stranice jer pregledač to zabranjuje dok
   * korisnik nije ništa dodirnuo. Umjesto da se tiho izgubi, čeka na prvi
   * dodir — a to je u praksi trenutak kad korisnik klikne polje za unos.
   *
   * Kad se do ekrana dođe iz same aplikacije (odjava, preusmjeravanje), dodir
   * je već postojao pa se pušta odmah.
   *
   * @returns funkcija za otkazivanje — pozvati je pri napuštanju ekrana, da
   *          zvuk ne krene nakon što je korisnik već otišao.
   */
  playOrArm(name: SoundName): () => void {
    let cancelled = false;

    // Snimak se dekodira ODMAH, prije ijednog dodira. To je ključno: kad dodir
    // stigne, u rukovaocu se smije raditi samo ono što traje trenutak.
    void this.load(name).catch(() => {});

    const ctx = this.context();
    if (ctx?.state === 'running') {
      this.play(name);
      return () => { cancelled = true; };
    }

    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchend', 'keydown'];

    const onGesture = () => {
      cleanup();
      if (cancelled) return;

      // SINHRONO, unutar samog dodira — bez setTimeout i bez await.
      //
      // Ovo je bio uzrok zašto zvuk na ekranu za prijavu nije radio pri prvom
      // otvaranju: ranije se `resume()` i puštanje odgađalo kroz setTimeout i
      // await na preuzimanje snimka. Pregledači, a Safari strogo, priznaju
      // odobrenje samo ako se traži unutar zadatka koji je pokrenuo dodir.
      // Sve poslije toga tretiraju kao autoplay i tiho odbiju.
      const c = this.context();
      if (!c) return;

      c.resume();

      const buffer = this.buffers.get(name);
      if (buffer) {
        this.startBuffer(c, buffer);
      } else {
        // Snimak još nije dekodiran — kontekst je ipak otključan ovim dodirom,
        // pa puštanje prolazi i kad stigne.
        void this.play(name);
      }
    };

    const cleanup = () => events.forEach(e => document.removeEventListener(e, onGesture));
    events.forEach(e => document.addEventListener(e, onGesture, { once: true, passive: true }));

    return () => { cancelled = true; cleanup(); };
  }

  /** Kreiranje i pokretanje izvora — jedino mjesto koje stvarno pušta zvuk. */
  private startBuffer(ctx: AudioContext, buffer: AudioBuffer) {
    this.stop();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain!);
    source.onended = () => {
      if (this.playing === source) this.playing = null;
    };
    source.start(0);
    this.playing = source;
  }

  /** Prekid trenutnog zvuka — npr. da klip ne pređe na sljedeći ekran. */
  stop() {
    try {
      this.playing?.stop();
    } catch {
      // već zaustavljen
    }
    this.playing = null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.muted) this.stop();
    return this.muted;
  }

  // ---------------------------------------------------------------------------

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;

    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;

    this.ctx = new Ctor();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.5;
    this.gain.connect(this.ctx.destination);

    return this.ctx;
  }

  /**
   * Otključavanje na prvi dodir bilo gdje u aplikaciji.
   *
   * Pušta se jedan uzorak tišine — bez toga iOS Safari drži kontekst
   * "running" ali ne pušta ništa. Slušači se skidaju odmah nakon prvog
   * okidanja (`once`), pa nema trajnog troška.
   */
  private armUnlock() {
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'touchend', 'keydown'];

    const unlock = async () => {
      if (this.unlocked) return;
      this.unlocked = true;

      try {
        const ctx = this.context();
        if (!ctx) return;
        if (ctx.state === 'suspended') await ctx.resume();

        const silent = ctx.createBufferSource();
        silent.buffer = ctx.createBuffer(1, 1, 22050);
        silent.connect(ctx.destination);
        silent.start(0);
      } catch {
        // Bez zvuka se može živjeti.
      }
    };

    events.forEach(e => document.addEventListener(e, unlock, { once: true, passive: true }));
  }

  private async load(name: SoundName): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return cached;

    const ctx = this.context();
    if (!ctx) return null;

    const res = await fetch(`assets/${CLIPS[name]}`);
    if (!res.ok) return null;

    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    this.buffers.set(name, buffer);
    return buffer;
  }
}
