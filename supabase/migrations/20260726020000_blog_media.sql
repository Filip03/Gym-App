-- Blog fajlovi na Cloudflare R2, umjesto Supabase Storage bucketa "blog".
--
-- Razlog: R2 ima mnogo veći besplatni/jeftiniji limit za skladištenje od
-- Supabase Storage-a. Otpremanje ide direktno iz browsera na R2 preko
-- presigned URL-a kojeg generiše Edge Function (supabase/functions/r2-presign)
-- — Angular nikad ne vidi R2 API ključeve.
--
-- R2 (kao S3-kompatibilan storage) nema Supabase Storage-ov list() poziv, pa
-- ova tabela zamjenjuje tu ulogu: BlogService.listMedia() čita odavde umjesto
-- da lista sadržaj bucketa.

create table if not exists public.blog_media (
    id          uuid primary key default gen_random_uuid(),
    key         text not null unique,
    type        text not null,
    uploaded_by uuid,
    created_at  timestamp with time zone not null default now()
);

comment on table public.blog_media is
    'Prati fajlove otpremljene na Cloudflare R2 (bucket gymapp-blog). Zamjenjuje '
    'Supabase Storage list() koji R2 nema.';
comment on column public.blog_media.key is
    'Ključ/putanja objekta unutar R2 bucketa. Javni URL na frontu: '
    'environment.r2PublicUrl + "/" + key.';
comment on column public.blog_media.type is
    '''image'' ili ''video'' — određeno na frontu iz MIME tipa pri otpremanju.';

alter table public.blog_media
    add constraint blog_media_uploaded_by_fkey foreign key (uploaded_by)
    references public.profiles(id) on update cascade on delete set null;

create index if not exists blog_media_created_at_idx
    on public.blog_media (created_at desc);

-- ---------------------------------------------------------------------------
-- Privilegije — isti obrazac kao exercice_logs/weight_logs.
-- ---------------------------------------------------------------------------

grant all on table public.blog_media to authenticated;

grant references, trigger, truncate, maintain
    on table public.blog_media to anon, service_role;
