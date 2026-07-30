-- Vježbe koje se rade tjelesnom težinom (zgibovi, sklekovi, dips...).
--
-- Do sada je exercice_logs.weight bio obavezan broj za svaku vježbu, pa je
-- upis "čistih" zgibova morao da ide kroz 0 bez ikakvog konteksta — teren
-- ekran nije znao da je 0 namjerno (bodyweight), a ne zaboravljen unos.
--
-- Rješenje: flag na vježbi. Trening ekran za ovako označene vježbe sakriva
-- polje za kilažu podrazumijevano i nudi dugme da se doda (za opterećene
-- varijante, npr. zgibovi sa tegom). exercice_logs.weight ostaje NOT NULL —
-- i dalje se upisuje 0 kad korisnik ne doda ništa, samo se tako i tumači.

alter table public.exercices
    add column if not exists is_bodyweight boolean not null default false;

comment on column public.exercices.is_bodyweight is
    'Vježba se osnovno radi tjelesnom težinom (npr. zgibovi). Trening ekran '
    'za ovakve vježbe sakriva polje za kilažu dok korisnik eksplicitno ne '
    'doda teg — 0 u exercice_logs.weight znači "bez dodatnog tega", ne prazan unos.';
