-- Veličina otpremljenog fajla (u bajtovima) — galerija je nakon merge-a sa
-- XFactor granom počela da prikazuje ušteđeno mjesto nakon kompresije, a to
-- se ne može pouzdano saznati naknadno preko R2 API-ja bez dodatnog poziva.
-- Jednostavnije i tačnije: BlogService.uploadMedia() upisuje stvarnu veličinu
-- fajla (nakon kompresije) u istom insert-u kad upisuje red.

alter table public.blog_media
    add column if not exists size bigint;

comment on column public.blog_media.size is
    'Veličina otpremljenog fajla u bajtovima (nakon kompresije, ako je bilo). '
    'Upisuje se sa fronta pri otpremanju — R2 samo prima fajl, ne prati ovo.';
