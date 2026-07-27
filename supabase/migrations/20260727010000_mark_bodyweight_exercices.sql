-- Označavanje vježbi koje se rade tjelesnom težinom.
--
-- Migracija 20260726040000 je dodala kolonu `exercices.is_bodyweight`, ali je
-- ostavila sve na `false` — pa se funkcija nije vidjela ni na jednoj vježbi.
-- Zgibovi su i dalje tražili kilažu, iako je cijela poenta bila da ne traže.
--
-- Označavanje ide MIGRACIJOM, ne ručnim upisom kroz Studio: inače bi svako
-- okruženje (lokalno kod svakoga + cloud) moralo da se podešava zasebno, i prvi
-- sljedeći `db:reset` bi obrisao trud.
--
-- Poređenje je neosjetljivo na velika/mala slova i na višak razmaka, jer su
-- nazivi unošeni ručno kroz aplikaciju.

update public.exercices
set is_bodyweight = true
where lower(btrim(name)) in (
    'pull ups',
    'pullups',
    'pull-ups',
    'chin ups',
    'chinups',
    'chin-ups',
    'dips',
    'push ups',
    'pushups',
    'push-ups'
);

-- Spisak je namjerno širi od onoga što trenutno postoji u bazi (sada postoji
-- samo „Pull Ups"). Kad neko doda sklekove ili propadanja, migracija ih je već
-- pokrila — a ponovno puštanje ništa ne kvari.
