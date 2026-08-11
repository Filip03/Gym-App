-- Jedna reakcija po osobi po objavi (Markova odluka).
--
-- Prvobitno je unique bio (media, profil, vrsta) — ista osoba je mogla
-- nagomilati više raznih emojia na istoj objavi. Sada: (media, profil) —
-- izbor nove vrste ZAMJENJUJE staru (front radi update), ponovni dodir iste
-- skida (toggle).

-- Postojeći viškovi: ostaje najnovija reakcija svake osobe po objavi.
delete from public.blog_reactions br
using public.blog_reactions b2
where br.media_id = b2.media_id
  and br.profile_id = b2.profile_id
  and (br.created_at, br.id) < (b2.created_at, b2.id);

alter table public.blog_reactions
    drop constraint if exists blog_reactions_unique;

alter table public.blog_reactions
    add constraint blog_reactions_one_per_user unique (media_id, profile_id);

comment on constraint blog_reactions_one_per_user on public.blog_reactions is
    'Jedna reakcija po osobi po objavi — nova vrsta zamjenjuje staru.';
