-- Dan tipa "Custom" — plan tipa Custom ne traži izbor tipa dana po danu,
-- svaki dan automatski dobija ovaj day_type i nudi CIJEL katalog vježbi
-- (dashboard.component.ts ne filtrira preko day_type_muscle_group za njega,
-- zove getAllExercices() direktno).
--
-- Namjerno BEZ day_type_muscle_group mapiranja: da je dodato (npr. na sve
-- mišićne grupe), vježbe bez ijedne mišićne grupe ("Nekategorisano") bi
-- ispale iz ponude preko getExercicesForDayType(). getAllExercices() nema taj
-- problem — otud odluka da se za Custom potpuno zaobiđe day_type_muscle_group.

insert into public.day_type (name)
select 'CUSTOM'
where not exists (
  select 1 from public.day_type where upper(name) = 'CUSTOM'
);
