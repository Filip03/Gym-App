import { Injectable } from '@angular/core';

/**
 * Zvučni efekti aplikacije.
 *
 * ZAŠTO SERVIS, A NE `new Audio()` U KOMPONENTI
 *
 * Pregledači ne puštaju zvuk dok korisnik nije ničim dodirnuo stranicu. Raniji
 * kod je zvao `audio.play()` u `ngOnInit` ekrana za prijavu — dakle pri
 * učitavanju, prije ijednog dodira — pa je bio blokiran. Izgledalo je kao da
 * "nekad radi": radilo je samo kad se do ekrana došlo klikom sa druge stranice.
 *
 * ZAŠTO DVA PUTA REPRODUKCIJE
 *
 * Ni jedan način ne radi svuda:
 *
 *   Web Audio    — jedini koji svira kad je na iPhoneu bočni prekidač na tihom,
 *                  ali samo uz `audioSession.type = 'playback'` (Safari 16.4+).
 *                  Traži dekodiranje snimka, što na starijim iOS-ima zna pasti.
 *   <audio>      — uvijek zna da pusti .m4a, ali ga tihi režim iPhonea utišava.
 *
 * Zato se otključavaju OBA u istom dodiru, a pušta se Web Audiom kad je snimak
 * dekodiran, uz <audio> kao zamjenu kad nije.
 *
 * ŠTA JE POKVARILO ZVUK NA IPHONEU (ovo su tri odvojene zamke)
 *
 *   1. Otključavanje mora biti POTPUNO SINHRONO unutar dodira. Jedan `await`
 *      prije `resume()` ili prije puštanja tihog uzorka — i dodir je potrošen.
 *      Zato `unlock()` nema nijedan `await` i mora tako ostati.
 *   2. AudioContext napravljen prije ijednog dodira zna ostati gluv i nakon
 *      `resume()`. Zato se pravi TEK u dodiru, ne u konstruktoru.
 *   3. Web Audio se podrazumijevano vodi kao ambijentalni zvuk, koji bočni
 *      prekidač utišava.
 *
 * Snimci se zato preuzimaju unaprijed kao SIROVI BAJTOVI — za to kontekst nije
 * potreban — a dekodiraju tek kad kontekst postoji.
 *
 * Servis takođe garantuje da zvuk NIKAD ne blokira tok aplikacije: raniji kod
 * je čekao `onended` prije preusmjeravanja, pa je blokiran autoplay značio da
 * korisnik nakon uspješne registracije zauvijek ostane na ekranu.
 */

export type SoundName = 'login' | 'register' | 'record' | 'avatar' | 'blogAdd' | 'glitch';

// Naziv fajla uz originalni "radni naslov", da se zna šta je šta.
// PRAZAN naziv = slot postoji, ali snimak još nije nabavljen — svaki poziv se
// tiho preskoči (bez mrežnog zahtjeva, bez 404 u konzoli). Kad snimak stigne,
// samo se upiše naziv fajla.
const CLIPS: Record<SoundName, string> = {
  login:    'ko-je.m4a',              // "ko je"
  register: 'imun-na-batine.m4a',     // "imun na batine"
  record:   'zmaj-u-mene-25cm.m4a',   // za oboren lični rekord
  avatar:   'obrijanica.m4a',         // klik na profilnu sliku
  blogAdd:  'prskulja.m4a',           // klik na dodavanje fajla u blog
  glitch:   ''                        // uz volt glitch (veća kilaža) — Marko tek bira snimak
};

// Prazan WAV (44 bajta zaglavlja, nula uzoraka). Služi samo da se <audio>
// element jednom pusti unutar dodira; poslije toga mu se izvor smije mijenjati
// i puštati programski.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const VOLUME = 0.5;
const MUTE_KEY = 'gymapp.muted';
const GESTURES: (keyof DocumentEventMap)[] = ['pointerdown', 'touchend', 'click', 'keydown'];

@Injectable({ providedIn: 'root' })
export class AudioService {

  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private el: HTMLAudioElement | null = null;

  /** Sirovi bajtovi, preuzeti prije dodira — za mrežu kontekst nije potreban. */
  private readonly raw = new Map<SoundName, ArrayBuffer>();
  /** Dekodirani snimci — dekodiranje traži kontekst, pa ide tek poslije dodira. */
  private readonly decoded = new Map<SoundName, AudioBuffer>();
  /** Dekodiranja u toku — bez ovoga isti snimak krene dva puta paralelno. */
  private readonly decoding = new Map<SoundName, Promise<AudioBuffer | null>>();

  private playing: AudioBufferSourceNode | null = null;
  /** Da li <audio> svira pravi klip (a ne tišinu za otključavanje). */
  private elementActive = false;
  private unlocked = false;

  muted = localStorage.getItem(MUTE_KEY) === '1';

  constructor() {
    // Ovdje se NIŠTA ne pravi — ni kontekst, ni zvuk. Samo se čeka prvi dodir.
    GESTURES.forEach(e =>
      document.addEventListener(e, this.onFirstGesture, { once: true, passive: true })
    );
  }

  // ---------------------------------------------------------------------------

  /** Pusti odmah. Za zvukove koji slijede nakon radnje korisnika. */
  async play(name: SoundName) {
    if (this.muted) return;
    if (!this.unlocked) return;   // bez dodira ionako ne bi zasviralo
    if (!CLIPS[name]) return;     // slot bez snimka — tiho preskoči

    this.stop();

    try {
      const buffer = this.decoded.get(name) ?? await this.decode(name);
      if (buffer && this.ctx && this.gain) {
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        this.startBuffer(buffer);
        return;
      }
    } catch { /* pada na <audio> ispod */ }

    this.playElement(name);
  }

  /**
   * Pusti odmah ako je moguće; ako nije, pusti na prvi dodir.
   *
   * Za zvukove koji pripadaju samom DOLASKU na ekran — npr. poruka na prijavi.
   * Pri prvom otvaranju stranice dodira još nema, pa se čeka; u praksi je to
   * trenutak kad korisnik dodirne polje za unos.
   *
   * @returns funkcija za otkazivanje — pozvati pri napuštanju ekrana.
   */
  playOrArm(name: SoundName): () => void {
    let cancelled = false;

    // Bajtovi se povlače ODMAH, da se u dodiru ne čeka mreža.
    void this.prefetch(name);

    if (this.unlocked) {
      void this.play(name);
      return () => { cancelled = true; };
    }

    const onGesture = () => {
      cleanup();
      if (cancelled) return;
      this.unlock();            // sinhrono, unutar dodira
      void this.play(name);     // tek onda smije asinhrono
    };
    const cleanup = () => GESTURES.forEach(e => document.removeEventListener(e, onGesture));

    GESTURES.forEach(e => document.addEventListener(e, onGesture, { once: true, passive: true }));
    return () => { cancelled = true; cleanup(); };
  }

  /** Prekid trenutnog zvuka — da klip ne pređe na sljedeći ekran. */
  stop() {
    try { this.playing?.stop(); } catch { /* već zaustavljen */ }
    this.playing = null;

    // Samo pravi klip. Pauziranje tišine iz `unlock()` prekida `play()` koji je
    // upravo pokrenut u dodiru (AbortError) — a baš to puštanje je ono što
    // element otključava, pa bi ga prekid poništio.
    if (this.el && this.elementActive) {
      this.elementActive = false;
      this.el.pause();
      this.el.currentTime = 0;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.muted) this.stop();
    return this.muted;
  }

  // ---------------------------------------------------------------------------

  private onFirstGesture = () => this.unlock();

  /**
   * Otključavanje oba puta reprodukcije.
   *
   * SVE u ovoj metodi je sinhrono i mora ostati takvo — jedan `await` i iPhone
   * više ne priznaje da je ovo dodir korisnika. Zato i `el.play()` ide bez
   * čekanja, a pauza se veže na obećanje koje vrati.
   */
  private unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    // (1) <audio> — radi svuda, ali ga tihi režim iPhonea utišava.
    try {
      const el = new Audio();
      el.preload = 'auto';
      el.volume = VOLUME;
      el.setAttribute('playsinline', '');
      el.src = SILENT_WAV;

      // Bez ručne pauze — snimak je prazan i završi sam. Pauza bi prekinula
      // upravo ono puštanje koje element otključava.
      const started = el.play();
      if (started) started.catch(() => {});

      this.el = el;
    } catch { /* bez zamjene se može */ }

    // (2) Web Audio — jedini koji se čuje i kad je zvono na tihom.
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;

      // Mora prije pravljenja konteksta: svrstava zvuk u reprodukciju umjesto u
      // ambijentalni, koji bočni prekidač na iPhoneu gasi.
      try {
        const session = (navigator as any).audioSession;
        if (session) session.type = 'playback';
      } catch { /* podržano tek od Safarija 16.4 */ }

      const ctx: AudioContext = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = VOLUME;
      gain.connect(ctx.destination);

      ctx.resume();   // BEZ await — vidi komentar iznad

      // Jedan uzorak tišine, odmah. Bez njega iOS prijavi kontekst kao
      // "running", a ne pusti ništa.
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, 22050);
      silent.connect(ctx.destination);
      silent.start(0);

      this.ctx = ctx;
      this.gain = gain;

      // Što je već preuzeto može se sada dekodirati, unaprijed.
      this.raw.forEach((_, name) => void this.decode(name));
    } catch { /* ostaje <audio> */ }
  }

  private startBuffer(buffer: AudioBuffer) {
    if (!this.ctx || !this.gain) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    source.onended = () => { if (this.playing === source) this.playing = null; };
    source.start(0);
    this.playing = source;
  }

  private playElement(name: SoundName) {
    const el = this.el;
    if (!el || !CLIPS[name]) return;

    el.src = `assets/${CLIPS[name]}`;
    el.volume = VOLUME;
    this.elementActive = true;
    el.onended = () => { this.elementActive = false; };

    const started = el.play();
    if (started) started.catch(() => { this.elementActive = false; });
  }

  private async prefetch(name: SoundName): Promise<void> {
    if (!CLIPS[name] || this.raw.has(name)) return;
    try {
      const res = await fetch(`assets/${CLIPS[name]}`);
      if (res.ok) this.raw.set(name, await res.arrayBuffer());
    } catch { /* nema mreže — ostaje <audio>, koji ima svoj keš */ }
  }

  private decode(name: SoundName): Promise<AudioBuffer | null> {
    const cached = this.decoded.get(name);
    if (cached) return Promise.resolve(cached);
    if (!this.ctx) return Promise.resolve(null);

    // `unlock()` grije dekodiranje unaprijed, a `play()` ga traži odmah zatim.
    // Bez ovoga se isti snimak dekodira dvaput paralelno (dva puta po 250 kB).
    const running = this.decoding.get(name);
    if (running) return running;

    const task = this.decodeNow(name).finally(() => this.decoding.delete(name));
    this.decoding.set(name, task);
    return task;
  }

  private async decodeNow(name: SoundName): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;

    if (!this.raw.has(name)) await this.prefetch(name);
    const bytes = this.raw.get(name);
    if (!bytes) return null;

    try {
      // slice(0) — decodeAudioData "pojede" ArrayBuffer, pa original mora ostati
      // netaknut za eventualno ponovno dekodiranje.
      const buffer = await ctx.decodeAudioData(bytes.slice(0));
      this.decoded.set(name, buffer);
      return buffer;
    } catch {
      return null;   // ostaje <audio>
    }
  }
}
