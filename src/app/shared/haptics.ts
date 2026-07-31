/**
 * Vibracija/haptika za trenutke napretka — tri jačine, po veličini trenutka:
 *
 *   'reps'   — više PONAVLJANJA nego prošli put: kratak, jedva primjetan tap.
 *   'weight' — veća KILAŽA nego prošli put: dva udarca, malo duže.
 *   'record' — NOVI LIČNI REKORD: najjači i najduži obrazac, prati animaciju
 *              plamena (~1.8s). Namjerno preglasan — rekord je događaj.
 *
 * Tri svijeta, jedan poziv:
 *   1. Nativna ljuska (Capacitor, grana native-app) — pravi haptički motor,
 *      radi i na iPhoneu. Poziva se preko `window.Capacitor` globala koji
 *      ljuska ubrizga, pa web kod NE zavisi od @capacitor paketa.
 *   2. Android Chrome — standardni `navigator.vibrate`.
 *   3. iOS Safari — nema nijedno ni drugo; poziv tiho ne uradi ništa.
 *      (Vibracija na iPhoneu stiže tek kroz ljusku — tačka 1.)
 */
export type HapticTier = 'reps' | 'weight' | 'record';

export function progressHaptics(tier: HapticTier): void {
  const haptics = (window as any).Capacitor?.Plugins?.Haptics;

  if (haptics?.impact) {
    switch (tier) {
      case 'reps':
        void haptics.impact({ style: 'Light' });
        return;
      case 'weight':
        void haptics.impact({ style: 'Medium' });
        setTimeout(() => void haptics.impact({ style: 'Medium' }), 150);
        return;
      case 'record':
        // Ritam plamena: tri teška udarca u kreščendu, pa dugi zvon na kraju.
        // (Stari obrazac od tri udarca je na telefonu bio prekratak i pretih —
        // Markova primjedba 31.07.2026.)
        void haptics.impact({ style: 'Heavy' });
        setTimeout(() => void haptics.impact({ style: 'Heavy' }), 170);
        setTimeout(() => void haptics.impact({ style: 'Medium' }), 340);
        setTimeout(() => void haptics.impact({ style: 'Heavy' }), 510);
        setTimeout(() => void (haptics.vibrate
          ? haptics.vibrate({ duration: 400 })
          : haptics.impact({ style: 'Heavy' })), 760);
        return;
    }
  }

  // Web: obrasci rastu sa veličinom trenutka, rekordni prati animaciju.
  switch (tier) {
    case 'reps':   navigator.vibrate?.(45); return;
    case 'weight': navigator.vibrate?.([80, 60, 110]); return;
    case 'record': navigator.vibrate?.([140, 60, 140, 60, 260, 90, 420]); return;
  }
}
