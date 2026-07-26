-- Privilegije nad public šemom — vjerno preslikane iz produkcije.
--
-- U cloud Supabaseu ove GRANT-ove dodijeli platforma sama kad se tabela napravi
-- kroz Studio. Migracija koja tabelu pravi direktno u SQL-u to ne dobija, pa bez
-- ovog fajla aplikacija javlja "permission denied for table workout_plan".
--
-- ⚠️  Ovo je sloj IZNAD RLS-a i njega treba čitati zajedno sa RLS stanjem
-- (vidi 20260725000000_initial_schema.sql). Pošto je RLS ugašen na skoro svim
-- tabelama, ovi GRANT-ovi su jedina stvarna kontrola pristupa — a `anon` na
-- većini tabela ima "all". Popravka je Faza 5, docs/03-SIGURNOST.md.

-- ---------------------------------------------------------------------------
-- Pun pristup za anon, authenticated i service_role
-- ---------------------------------------------------------------------------

grant all on table public.day_exercice          to anon, authenticated, service_role;
grant all on table public.day_type              to anon, authenticated, service_role;
grant all on table public.day_type_muscle_group to anon, authenticated, service_role;
grant all on table public.exercices             to anon, authenticated, service_role;
grant all on table public.muscle_group          to anon, authenticated, service_role;
grant all on table public.plan_members          to anon, authenticated, service_role;
grant all on table public.plan_type             to anon, authenticated, service_role;
grant all on table public.profiles              to anon, authenticated, service_role;
grant all on table public.workout_days          to anon, authenticated, service_role;
grant all on table public.workout_plan          to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Izuzeci: exercice_logs i exercice_muscle
--
-- Ove dvije tabele NE daju anon roli pravo čitanja podataka — samo prava koja
-- ne otkrivaju sadržaj (references, trigger, truncate, maintain). Podatke može
-- čitati isključivo prijavljen korisnik.
--
-- Vjerovatno nije bila svjesna odluka nego posljedica toga kako su tabele
-- nastale, ali je jedina razlika u odnosu na ostatak šeme — pa se prenosi tačno.
-- ---------------------------------------------------------------------------

grant all on table public.exercice_logs   to authenticated;
grant all on table public.exercice_muscle to authenticated;

grant references, trigger, truncate, maintain
    on table public.exercice_logs to anon, service_role;
grant references, trigger, truncate, maintain
    on table public.exercice_muscle to anon, service_role;

-- ---------------------------------------------------------------------------
-- Funkcije
--
-- get_email_by_username mora biti dostupna anon roli — poziva se PRIJE prijave,
-- da bi se korisničko ime prevelo u email.
-- ---------------------------------------------------------------------------

grant all on function public.get_email_by_username(text) to anon, authenticated, service_role;
grant all on function public.handle_new_user()           to anon, authenticated, service_role;
