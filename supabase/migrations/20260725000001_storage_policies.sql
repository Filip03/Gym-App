-- Storage politike — vjerno preslikane iz produkcije (2026-07-25).
--
-- Za razliku od public tabela, na storage.objects RLS JESTE uključen (Supabase ga
-- uključuje sam), pa ove politike stvarno rade.
--
-- ⚠️  Primijeti šta nedostaje, i ne popravljaj ovdje (Faza 5, docs/03-SIGURNOST.md):
--   - upload u 'blog' i 'exercices-pictures' NEMA "to authenticated" —
--     dakle bilo ko, i neprijavljen, može ubaciti fajl u ta dva bucketa
--   - nema nijedne DELETE politike — brisanje fajlova je nemoguće za sve,
--     uključujući vlasnika (zato u aplikaciji i ne postoji brisanje blog objava)
--   - samo profile-pictures ograničava korisnika na sopstveni folder

-- Čitanje

drop policy if exists "Allow read access to buckets" on storage.buckets;
create policy "Allow read access to buckets"
    on storage.buckets for select using (true);

drop policy if exists "Allow read access to blog" on storage.objects;
create policy "Allow read access to blog"
    on storage.objects for select using (bucket_id = 'blog');

drop policy if exists "Allow read access to exercices-pictures" on storage.objects;
create policy "Allow read access to exercices-pictures"
    on storage.objects for select using (bucket_id = 'exercices-pictures');

drop policy if exists "Allow read access to profile-pictures" on storage.objects;
create policy "Allow read access to profile-pictures"
    on storage.objects for select using (bucket_id = 'profile-pictures');

-- Upis — bez provjere prijave (vjerno prema produkciji)

drop policy if exists "Allow uploads to blog" on storage.objects;
create policy "Allow uploads to blog"
    on storage.objects for insert with check (bucket_id = 'blog');

drop policy if exists "Allow uploads to exercices-pictures" on storage.objects;
create policy "Allow uploads to exercices-pictures"
    on storage.objects for insert with check (bucket_id = 'exercices-pictures');

drop policy if exists "Allow update to blog" on storage.objects;
create policy "Allow update to blog"
    on storage.objects for update
    using (bucket_id = 'blog') with check (bucket_id = 'blog');

drop policy if exists "Allow update to exercices-pictures" on storage.objects;
create policy "Allow update to exercices-pictures"
    on storage.objects for update
    using (bucket_id = 'exercices-pictures') with check (bucket_id = 'exercices-pictures');

-- Profilne slike — jedine sa provjerom vlasništva

drop policy if exists "Users can upload own profile picture" on storage.objects;
create policy "Users can upload own profile picture"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'profile-pictures'
        and (storage.foldername(name))[1] = (auth.uid())::text
    );

drop policy if exists "Users can update own profile picture" on storage.objects;
create policy "Users can update own profile picture"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'profile-pictures'
        and (storage.foldername(name))[1] = (auth.uid())::text
    )
    with check (
        bucket_id = 'profile-pictures'
        and (storage.foldername(name))[1] = (auth.uid())::text
    );
