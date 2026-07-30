/**
 * Vibracija/haptika za trenutke slavlja (lični rekord).
 *
 * Tri svijeta, jedan poziv:
 *   1. Nativna ljuska (Capacitor, grana native-app) — pravi haptički motor,
 *      radi i na iPhoneu. Poziva se preko `window.Capacitor` globala koji
 *      ljuska ubrizga, pa web kod NE zavisi od @capacitor paketa.
 *   2. Android Chrome — standardni `navigator.vibrate`.
 *   3. iOS Safari — nema nijedno ni drugo; poziv tiho ne uradi ništa.
 *      (Vibracija na iPhoneu stiže tek kroz ljusku — tačka 1.)
 */
export function prHaptics(): void {
  const haptics = (window as any).Capacitor?.Plugins?.Haptics;
  if (haptics?.impact) {
    // Tri udarca u ritmu plamena — jak, pa dva kraća.
    void haptics.impact({ style: 'Heavy' });
    setTimeout(() => void haptics.impact({ style: 'Medium' }), 180);
    setTimeout(() => void haptics.impact({ style: 'Heavy' }), 360);
    return;
  }

  // Obrazac prati animaciju: udar — pauza — duži udar.
  navigator.vibrate?.([90, 70, 90, 70, 160]);
}
