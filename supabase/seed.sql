-- GENERISANO iz produkcijskog dumpa 2026-07-25. Ne uređivati ručno —
-- regenerisati skriptom ako dump bude osvježen.
--
-- Podaci o treningu su PRAVI. Nalozi su ANONIMIZOVANI:
--   email    -> {username}@local.test
--   lozinka  -> "gymapp123" za sve (hash se računa dolje, ne stoji u gitu)
--
-- Namjerno je zadržana i nedosljednost iz produkcije: jedan nalog nema red u
-- profiles. Vidi docs/02-STANJE-KODA.md.

-- Trigger on_auth_user_created se NE gasi (seed se izvršava kao rola postgres,
-- koja nije vlasnik auth.users pa ne smije "alter table ... disable trigger").
-- Umjesto toga: trigger napravi profiles redove sam, mi ih dopunimo pravim
-- vrijednostima kroz upsert, i na kraju obrišemo profil koji u produkciji ne
-- postoji.

-- --------------------------------------------------------------------------
-- Nalozi
-- --------------------------------------------------------------------------

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) values (
    '00000000-0000-0000-0000-000000000000', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'authenticated', 'authenticated', 'ofi@local.test', '', '2026-07-18 16:44:18.321334+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "e281108d-1a1e-42ed-b67a-20db768ffc0b", "email":"ofi@local.test", "height": 185, "weight": 83, "username": "Ćofi", "email_verified": true, "phone_verified": false}', '2026-07-18 16:44:18.279751+00', '2026-07-25 14:46:17.309293+00',
    '', '', '', ''
) on conflict (id) do nothing;

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) values (
    '00000000-0000-0000-0000-000000000000', '1e33125b-15ad-4293-b203-0d9520e2ef4e', 'authenticated', 'authenticated', 'marko@local.test', '', '2026-07-21 14:50:20.278087+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "1e33125b-15ad-4293-b203-0d9520e2ef4e", "email":"marko@local.test", "height": 180, "weight": 73, "username": "marko", "email_verified": true, "phone_verified": false}', '2026-07-21 14:50:20.247343+00', '2026-07-25 12:09:02.018528+00',
    '', '', '', ''
) on conflict (id) do nothing;

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) values (
    '00000000-0000-0000-0000-000000000000', 'a266ec26-aca3-4b00-9ca5-c825837808dc', 'authenticated', 'authenticated', 'test@local.test', '', '2026-07-20 15:04:25.871573+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "a266ec26-aca3-4b00-9ca5-c825837808dc", "email":"test@local.test", "height": 180, "weight": 80, "username": "Test", "email_verified": true, "phone_verified": false}', '2026-07-20 15:04:25.821948+00', '2026-07-21 13:31:10.136588+00',
    '', '', '', ''
) on conflict (id) do nothing;

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
) values (
    '00000000-0000-0000-0000-000000000000', 'e663b76f-4c7a-40e2-95b5-8202cb332831', 'authenticated', 'authenticated', 'kaa@local.test', '', '2026-07-22 17:38:37.257356+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "e663b76f-4c7a-40e2-95b5-8202cb332831", "email":"kaa@local.test", "height": 170, "weight": 69, "username": "Kaća", "email_verified": true, "phone_verified": false}', '2026-07-22 17:38:37.219902+00', '2026-07-22 17:39:09.568583+00',
    '', '', '', ''
) on conflict (id) do nothing;

-- Jedinstvena dev lozinka za sve naloge: gymapp123
update auth.users
set encrypted_password = extensions.crypt('gymapp123', extensions.gen_salt('bf'));

-- Identiteti (bez njih prijava email/lozinkom ne prolazi)

insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
) values (
    'c6f6c897-f143-4b75-a5d1-a2a9b7478d11', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'email', '{"sub": "e281108d-1a1e-42ed-b67a-20db768ffc0b", "email":"ofi@local.test", "height": 185, "weight": 83, "username": "Ćofi", "email_verified": false, "phone_verified": false}', '2026-07-18 16:44:18.311537+00', '2026-07-18 16:44:18.311592+00', '2026-07-18 16:44:18.311592+00'
) on conflict (id) do nothing;

insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
) values (
    '325202be-3ecd-42ce-96eb-e3446e1ed766', 'a266ec26-aca3-4b00-9ca5-c825837808dc', 'a266ec26-aca3-4b00-9ca5-c825837808dc', 'email', '{"sub": "a266ec26-aca3-4b00-9ca5-c825837808dc", "email":"test@local.test", "height": 180, "weight": 80, "username": "Test", "email_verified": false, "phone_verified": false}', '2026-07-20 15:04:25.864415+00', '2026-07-20 15:04:25.864519+00', '2026-07-20 15:04:25.864519+00'
) on conflict (id) do nothing;

insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
) values (
    '0a396e3a-c538-4a22-a91a-9eddf3d40a19', '1e33125b-15ad-4293-b203-0d9520e2ef4e', '1e33125b-15ad-4293-b203-0d9520e2ef4e', 'email', '{"sub": "1e33125b-15ad-4293-b203-0d9520e2ef4e", "email":"marko@local.test", "height": 180, "weight": 73, "username": "marko", "email_verified": false, "phone_verified": false}', '2026-07-21 14:50:20.270373+00', '2026-07-21 14:50:20.270429+00', '2026-07-21 14:50:20.270429+00'
) on conflict (id) do nothing;

insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
) values (
    '3cb861fc-4107-4f30-bfa4-506c475d9430', 'e663b76f-4c7a-40e2-95b5-8202cb332831', 'e663b76f-4c7a-40e2-95b5-8202cb332831', 'email', '{"sub": "e663b76f-4c7a-40e2-95b5-8202cb332831", "email":"kaa@local.test", "height": 170, "weight": 69, "username": "Kaća", "email_verified": false, "phone_verified": false}', '2026-07-22 17:38:37.250744+00', '2026-07-22 17:38:37.250818+00', '2026-07-22 17:38:37.250818+00'
) on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- Podaci aplikacije (doslovno iz produkcije)
-- --------------------------------------------------------------------------

-- public.muscle_group: 6 redova
insert into public.muscle_group (id, name) values
    ('5980afb0-fbfd-4980-87b5-012fba3ae344', 'BICEPS'),
    ('089e4607-955b-4879-9a85-10b1cd29ce44', 'TRICEPS'),
    ('598cbe57-30b8-431c-89d9-4e59b77a3b23', 'SHOULDERS'),
    ('62fdf852-b2a3-427f-952d-70390d068020', 'BACK'),
    ('871b1219-f7cc-4640-815a-f7fab861d1ed', 'CHEST'),
    ('0660fd96-f7c6-45b7-a6b8-679d2038a7da', 'LEGS')
on conflict do nothing;

-- public.day_type: 10 redova
insert into public.day_type (id, name) values
    ('b5201b43-8ed3-465c-b4db-781402ebd605', 'PUSH'),
    ('abbf9562-7dfe-431b-b69a-9dc44e5f05dc', 'PULL'),
    ('35a3de55-3076-4ff9-83ea-a6d0c39aa215', 'LEGS'),
    ('085ed5b6-e53d-44a9-9897-27abc63bd3de', 'UPPER'),
    ('18805e1a-6cd2-4ca1-8e96-3fbbac4f590a', 'LOWER'),
    ('f6d9d95b-8bc4-407f-ad3d-70d0b416338d', 'FULLBODY'),
    ('67682944-7d73-45b3-beed-877211d0363d', 'ARMS'),
    ('10907d8e-b358-4d73-a2d9-ca54897acc07', 'BACK'),
    ('f0ceca5f-b936-4f75-a30f-646b86afde06', 'CHEST'),
    ('3ca3076f-f85f-4a0c-8475-9bee71315af2', 'REST')
on conflict do nothing;

-- public.plan_type: 4 redova
insert into public.plan_type (id, name) values
    ('3928f247-ddfb-4dc0-9fec-2d471f89a438', 'PPL (PushPullLegs)'),
    ('ab981f83-d423-4cef-a1bf-4c2cd4fcb901', 'UL (UpperLower)'),
    ('2c3b31d4-c48a-4d87-a884-76d01a04bc72', 'Full Body'),
    ('489689db-49a4-4413-8e39-a60ef6e6fb86', 'Bro Split')
on conflict do nothing;

-- public.exercices: 37 redova
insert into public.exercices (id, name, picture, description) values
    ('043338f7-6634-447a-8a5a-38435787efd3', 'Biceps Bar Curls', 'biceps_bar_curls.webp', 'Vježba za razvoj bicepsa koja omogućava podizanje težine uz stabilan hvat i kontrolisan pokret. Izvodi se savijanjem ruku u laktu dok se šipka podiže prema ramenima, uz zadržavanje mirnih laktova i pravilnu tehniku.'),
    ('71ea2897-f557-4105-ae7d-7f98b3c7a840', 'Biceps Dumbell Curls', 'biceps_db_curls.webp', 'Izolaciona vježba koja cilja biceps brachii, omogućavajući ravnomjeran razvoj obje ruke kroz rad sa zasebnim opterećenjem. Izvodi se podizanjem bučica savijanjem u laktu uz kontrolisan pokret i bez korištenja zamaha tijela.'),
    ('3184e75e-f3f0-4ff1-80b0-05b59e0b7a1b', 'Hack Squat', 'hack_squat.webp', 'Vježba na spravi koja primarno cilja kvadricepse, uz dodatnu aktivaciju gluteusa i zadnje lože. Izvodi se kontrolisanim spuštanjem tijela i potiskivanjem težine prema gore uz stabilan položaj leđa i pravilan položaj stopala.'),
    ('186a9465-f010-4faf-96dc-4cc43bdc2bf9', 'Close Grip Row', 'high_row.png', 'Vježba povlačenja koja cilja mišiće leđa, posebno latove, romboide i srednji dio trapeza, uz dodatnu aktivaciju bicepsa. Izvodi se povlačenjem uskog hvata prema tijelu uz kontrolisan pokret i održavanje ravnih leđa.'),
    ('7f42f165-60f0-4ecf-966c-fd9171e9d494', 'Flat Bench Press', 'flat_bech.webp', 'Osnovna vježba za razvoj grudnih mišića, uz aktivaciju prednjih ramena i tricepsa. Izvodi se spuštanjem šipke prema sredini grudi i potiskivanjem prema početnom položaju uz kontrolisan pokret i stabilan položaj tijela.'),
    ('f4f3bd66-6c5a-441a-a1b2-d954e08154a5', 'Hammer Curls', 'hammer_curls.webp', 'Vježba koja cilja biceps i brachialis mišić podlaktice, pomažući u razvoju debljine i snage ruku. Izvodi se neutralnim hvatom (dlanovi okrenuti jedan prema drugom) uz kontrolisano podizanje bučica i stabilan položaj laktova.'),
    ('4710e467-a074-47a0-bf97-fffed10dc80e', 'High to Low Cable Flys', 'cable_flys.webp', 'Izolaciona vježba koja cilja donji dio grudnih mišića kroz pokret povlačenja sajli odozgo prema dole. Izvodi se kontrolisanim spajanjem ruku ispred tijela uz fokus na maksimalnu kontrakciju grudi i stabilan položaj tijela.'),
    ('bc3f9d4f-4e05-45c9-9e2e-70597fe7bfc4', 'Incline Bench Press', 'incline_bench.jpg', 'Vježba za gornji dio grudi koja dodatno aktivira prednje rame i triceps. Izvodi se na kosoj klupi spuštanjem šipke prema gornjem dijelu grudi i kontrolisanim potiskivanjem težine prema početnoj poziciji.'),
    ('43c5afef-656a-472e-ad0b-9a00429abb06', 'Incline Bench Dumbell Curls', 'incline_db.jpg', 'Izolaciona vježba za biceps koja se izvodi na kosoj klupi i omogućava veće istezanje mišića tokom pokreta. Izvodi se podizanjem bučica uz stabilan položaj ruku i kontrolisano savijanje u laktu, sa fokusom na punu kontrakciju bicepsa.'),
    ('0fe860f1-1dde-4ca5-a3be-bf130f53b84c', 'Incline Dumbell Press', 'incline_db_curls.jpg', 'Vježba koja cilja gornji dio grudnih mišića, uz aktivaciju prednjih ramena i tricepsa. Izvodi se potiskivanjem bučica sa kose klupe uz kontrolisan pokret i stabilan položaj tijela tokom cijelog izvođenja.'),
    ('43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'Lateral Raises', 'lateral_raises.webp', 'zolaciona vježba koja primarno razvija srednji dio deltoidnih mišića i doprinosi širini ramena. Izvodi se podizanjem bučica u stranu do visine ramena uz kontrolisan pokret i blago savijene laktove, ili sa kablovima gdje je nastavak podignut u nivou kukova.'),
    ('8ffec9fe-45dd-41f9-bd83-af305c838833', 'Lying Leg Curls', 'leg_curls.webp', 'Izolaciona vježba koja primarno aktivira zadnju ložu butine (hamstrings) kroz savijanje nogu u koljenu. Izvodi se ležeći na spravi uz kontrolisano povlačenje pete prema tijelu i održavanje stabilnog položaja kukova.'),
    ('0637e4e7-4432-4e95-ba21-650d854e1487', 'Machine Chest Press', 'machine_chest_press.webp', 'Vježba za razvoj grudnih mišića koja omogućava stabilan pokret uz kontrolisano opterećenje na spravi. Primarno aktivira grudi, uz dodatni rad prednjih ramena i tricepsa tokom potiskivanja ručki prema naprijed.'),
    ('f0d3eea0-6473-4841-b31f-467ca945efd1', 'Overhead Triceps Extensions', 'overhead_triceps.jpg', 'Izolaciona vježba koja cilja triceps, posebno dugu glavu mišića zbog položaja ruku iznad glave. Izvodi se spuštanjem težine iza glave i kontrolisanim opružanjem laktova do početnog položaja.'),
    ('6ebf3a3f-ea5d-4c47-ab15-066ca894769d', 'Pec Dec Flys', 'pec_dec.webp', 'Izolaciona vježba koja cilja grudne mišiće, posebno kroz pokret približavanja ruku ispred tijela. Izvodi se na spravi uz kontrolisano spajanje ručki i fokus na istezanje i kontrakciju grudi bez pomoći drugih mišićnih grupa.'),
    ('630eeaa4-3f54-4a20-8f97-63659b69c8c1', 'Pendulum Squat', 'pendulum.webp', 'Vježba na spravi koja primarno razvija kvadricepse, uz aktivaciju gluteusa i mišića zadnje lože. Izvodi se kontrolisanim spuštanjem tijela u čučanj i potiskivanjem platforme prema gore uz stabilan položaj stopala i leđa.'),
    ('8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', 'Rear Delts Flys', 'rear_delts.jpg', 'Izolaciona vježba koja cilja zadnje deltoidne mišiće ramena, uz aktivaciju gornjeg dijela leđa i trapeza. Izvodi se povlačenjem ruku unazad u kontrolisanom pokretu, fokusirajući se na stiskanje lopatica i pravilnu aktivaciju zadnjih ramena.'),
    ('4a47351c-8270-4183-bd79-6f5019bcfbac', 'Pulley Row (Seated Row)', 'seated_row.jpg', 'Vježba za jačanje leđa koja primarno aktivira latove, romboide i trapez, uz pomoć bicepsa i podlaktica. Izvodi se povlačenjem ručke prema donjem dijelu stomaka dok se lopatice skupljaju, uz kontrolisan pokret i stabilan položaj tijela.'),
    ('d50d8e52-562a-477d-8f13-7f188a15a0f0', 'Reverse Curls', 'reverse_curls.jpeg', 'Vježba koja primarno razvija brachioradialis i mišiće podlaktice, uz dodatnu aktivaciju bicepsa. Izvodi se nadhvatom (dlanovi okrenuti prema dole) uz kontrolisano podizanje šipke ili bučica i stabilan položaj laktova.'),
    ('7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'Shoulder Press', 'shoulder_press.webp', 'Osnovna vježba za razvoj mišića ramena, posebno prednjeg i srednjeg dijela deltoida, uz aktivaciju tricepsa. Izvodi se potiskivanjem šipke ili bučica iznad glave uz kontrolisan pokret i'),
    ('a5c0d03b-e186-4c8a-a38e-7a2b48dc8d3d', 'Skullcrushers', 'skullcrushers.jpg', 'Izolaciona vježba koja primarno cilja triceps, posebno dugu glavu mišića, uz kontrolisano istezanje i kontrakciju tokom pokreta. Izvodi se spuštanjem šipke ili bučica prema čelu i potiskivanjem nazad prema početnoj poziciji uz stabilne laktove.'),
    ('63b7aacb-2a37-460d-9abc-d9977c2bc586', 'Unilateral Triceps Extensions', 'unilateral_triceps.webp', 'Izolaciona vježba koja cilja triceps kroz rad jedne ruke, omogućavajući bolju kontrolu pokreta i ravnomjeran razvoj mišića. Izvodi se opružanjem ruke u laktu uz kontrolisano spuštanje i podizanje težine, fokusirajući se na punu kontrakciju tricepsa.'),
    ('48708d8e-cce9-4783-8fef-f581893b9d40', 'Tbar Row', 'tbar_row.png', 'Vježba povlačenja koja primarno razvija srednji i gornji dio leđa, posebno latove, romboide i trapez, uz dodatnu aktivaciju bicepsa. Izvodi se povlačenjem šipke prema grudima ili stomaku uz stabilan položaj trupa i kontrolisan pokret.'),
    ('6bea385d-2d73-4e02-8b44-acdbf3d839ab', 'Triceps Pushdown', 'triceps_pushdowns.webp', 'Izolaciona vježba koja primarno aktivira triceps kroz pokret potiskivanja sajle prema dole. Izvodi se uz stabilne laktove i kontrolisano opružanje ruku, fokusirajući se na punu kontrakciju tricepsa.'),
    ('9530bdc0-c28b-4a60-9184-962573e45778', 'Narrow Lat Pulldown', '9530bdc0-c28b-4a60-9184-962573e45778/picture.png', 'Vježba koja primarno aktivira široki leđni mišić (latissimus dorsi), uz dodatno angažovanje bicepsa i mišića gornjeg dijela leđa. Izvodi se povlačenjem šipke uskim hvatom prema gornjem dijelu grudi, uz kontrolisan pokret i pravilno držanje tijela.'),
    ('9a27ef30-59ec-4978-9eef-5016d91747d0', 'Lat Pulldown', 'lat_pulldown.png', 'Vježba za razvoj leđa koja primarno aktivira široki leđni mišić (latissimus dorsi), uz dodatni rad bicepsa i gornjeg dijela leđa. Izvodi se povlačenjem šipke prema gornjem dijelu grudi uz kontrolisan pokret i fokus na spuštanje lopatica i pravilnu aktivaciju leđa.'),
    ('a8607fb6-80d2-47f2-a974-1498c14df750', 'Adductor Machine', 'adductor.jpg', 'Izolaciona vježba koja cilja unutrašnje mišiće butine (aduktore) i pomaže u razvoju stabilnosti kukova. Izvodi se približavanjem nogu prema sredini uz kontrolisan pokret i održavanje pravilnog položaja tijela na spravi.'),
    ('8ede576c-1f7a-4fa6-925e-b2b0d563c05c', 'Back/Front Squat', 'bar_squat.webp', 'Osnovna vježba za razvoj nogu koja aktivira kvadricepse, gluteuse i zadnju ložu, uz značajan angažman mišića trupa. Izvodi se spuštanjem tijela u čučanj sa šipkom na leđima ili ispred tijela, uz kontrolisan pokret i stabilan položaj kičme.'),
    ('6dd0377b-3d4e-43ad-ad23-5501dcbd2486', 'Bulgarian Split Squats', 'bulgarian.webp', 'Jednostrana vježba za noge koja primarno aktivira kvadricepse i gluteuse, uz dodatni rad zadnje lože i mišića stabilizatora. Izvodi se spuštanjem tijela na jednoj nozi dok je zadnja noga oslonjena na povišenje, uz kontrolisan pokret i stabilan položaj trupa.'),
    ('3ff1935b-a183-4994-9761-a45dae2ac01b', 'Calf Raises', 'calf_raises.webp', 'Izolaciona vježba koja primarno razvija mišiće lista, posebno gastrocnemius i soleus. Izvodi se podizanjem peta prema gore uz kontrolisan pokret i potpuno istezanje i kontrakciju mišića lista.'),
    ('479252ac-47e4-43c7-8fbd-eb7a12d3ec09', 'Leg Extensions', 'leg_extensions.png', 'Izolaciona vježba koja primarno cilja kvadricepse kroz opružanje nogu u koljenu. Izvodi se na spravi uz kontrolisano podizanje opterećenja i fokus na punu kontrakciju prednje strane butine.'),
    ('ba4bbe6f-357c-4ca4-bbc4-4f250306f4af', 'Leg Press', 'leg_press.avif', 'Osnovna vježba za razvoj nogu koja primarno aktivira kvadricepse, gluteuse i zadnju ložu. Izvodi se potiskivanjem platforme nogama uz kontrolisano spuštanje težine i održavanje stabilnog položaja leđa na spravi.'),
    ('36737d85-0ae5-4be6-9bde-b5efbe74c497', 'Preacher Curls', 'preacher_curls.webp', 'Izolaciona vježba koja primarno cilja biceps, uz smanjenje pomoći drugih mišićnih grupa zbog stabilnog položaja na preacher klupi. Izvodi se savijanjem ruku u laktu uz kontrolisano spuštanje i podizanje težine, fokusirajući se na punu kontrakciju bicepsa.'),
    ('0d2948d6-d965-4b41-83e8-a0c9954deaaf', 'Pull Ups', 'pull_ups.jpg', 'Vježba koja jača leđa, bicepse i mišiće podlaktice, uz aktivaciju core-a. Izvodi se povlačenjem tijela prema gore dok brada ne pređe nivo šipke, uz kontrolisano spuštanje.'),
    ('936ece3b-3d24-451e-ac5e-52050668cbd7', 'RDL', 'rdl.jpg', 'Vježba koja primarno razvija zadnju ložu, gluteuse i donji dio leđa kroz pokret pregiba u kukovima. Izvodi se spuštanjem težine uz blago savijena koljena i ravna leđa, a zatim vraćanjem u početni položaj aktivacijom zadnje lože i gluteusa.'),
    ('28a7ae12-a491-484c-83bb-4d14ca483c14', 'Belt Squat', 'belt_Squat.webp', 'Vježba za noge koja primarno aktivira kvadricepse i gluteuse, uz smanjeno opterećenje na donji dio leđa u odnosu na klasični čučanj. Izvodi se spuštanjem tijela u čučanj dok je opterećenje pričvršćeno za pojas, uz kontrolisan pokret i stabilan položaj tijela.'),
    ('90753751-2ad1-4aa1-bf27-85fadb79b58d', 'Forearm Curls', 'forearm_curls.png', 'Izolaciona vježba koja cilja mišiće podlaktice, posebno fleksore šake, i pomaže u razvoju snage hvata. Izvodi se savijanjem zglobova šake uz stabilne podlaktice i kontrolisan pokret bez korištenja drugih mišićnih grupa.')
on conflict do nothing;

-- public.profiles: 3 redova
insert into public.profiles (id, created_at, username, height, weight, profile_pic_url) values
    ('1e33125b-15ad-4293-b203-0d9520e2ef4e', '2026-07-21 14:50:20.244635+00', 'marko', '180', '73', '1e33125b-15ad-4293-b203-0d9520e2ef4e/avatar.mp4'),
    ('e281108d-1a1e-42ed-b67a-20db768ffc0b', '2026-07-18 16:44:18.27593+00', 'Ćofi', '185', '83', 'e281108d-1a1e-42ed-b67a-20db768ffc0b/avatar.jpeg'),
    ('e663b76f-4c7a-40e2-95b5-8202cb332831', '2026-07-22 17:38:37.215245+00', 'Kaća', '170', '69', null)
on conflict (id) do update set created_at = excluded.created_at, username = excluded.username, height = excluded.height, weight = excluded.weight, profile_pic_url = excluded.profile_pic_url;

-- U produkciji jedan nalog nema profil (napravljen prije nego što je
-- trigger dodan). Trigger ga je ovdje napravio — brišemo ga da bi lokalno
-- stanje bilo identično produkciji i da se popravka može testirati.
delete from public.profiles where id not in (
    '1e33125b-15ad-4293-b203-0d9520e2ef4e',
    'e281108d-1a1e-42ed-b67a-20db768ffc0b',
    'e663b76f-4c7a-40e2-95b5-8202cb332831'
);

-- public.workout_plan: 1 redova
insert into public.workout_plan (id, created_at, created_by, name, description, plan_type_id, active) values
    ('c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20 13:34:47.324421+00', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'Fikin PPL', 'Šestodnevni trening sa četvrtkom kao rest day. Ciklus počinje sa Pull day, pa Push pa Legs. Svaka mišićna grupa se trenira 2 puta sedmično.', '3928f247-ddfb-4dc0-9fec-2d471f89a438', 't')
on conflict do nothing;

-- public.workout_days: 7 redova
insert into public.workout_days (id, name, plan_id, day_number, day_type) values
    ('8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', 'Ponedeljak', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '1', 'abbf9562-7dfe-431b-b69a-9dc44e5f05dc'),
    ('6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', 'Utorak', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2', 'b5201b43-8ed3-465c-b4db-781402ebd605'),
    ('ced0d399-d851-427f-9796-bf7afada8a4c', 'Četvrtak', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '4', '3ca3076f-f85f-4a0c-8475-9bee71315af2'),
    ('dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', 'Petak', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '5', 'abbf9562-7dfe-431b-b69a-9dc44e5f05dc'),
    ('aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', 'Subota', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '6', 'b5201b43-8ed3-465c-b4db-781402ebd605'),
    ('069e0d8a-2599-4c00-ba43-3abd77fb576b', 'Nedelja', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '7', '35a3de55-3076-4ff9-83ea-a6d0c39aa215'),
    ('e3a9ed68-7422-49ee-be93-d7a125d58e3b', 'Srijeda', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '3', '35a3de55-3076-4ff9-83ea-a6d0c39aa215')
on conflict do nothing;

-- public.day_exercice: 54 redova
insert into public.day_exercice (id, workout_day_id, exercice_id, order_num, target_sets, target_reps) values
    ('23e0c2ac-3bb9-4b00-bf80-205a21651de7', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '9a27ef30-59ec-4978-9eef-5016d91747d0', '1', '2', '8'),
    ('a0c7e887-92e6-4c63-b174-011f2dc27221', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '48708d8e-cce9-4783-8fef-f581893b9d40', '2', '2', '8'),
    ('4e259021-4377-4b41-b9fb-a1e05adc60f2', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '4a47351c-8270-4183-bd79-6f5019bcfbac', '3', '2', '8'),
    ('78082781-2fb7-45fb-aee2-c049b235e98e', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', '4', '2', '8'),
    ('dbf608a0-811b-4a74-a284-4623d389e0d6', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '043338f7-6634-447a-8a5a-38435787efd3', '5', '2', '8'),
    ('deb5ff39-fb42-4f6c-b19c-2387618e6167', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '43c5afef-656a-472e-ad0b-9a00429abb06', '6', '2', '6'),
    ('2f9d39a5-ed85-4cfe-8c91-11b8250939f9', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', '7', '2', '8'),
    ('c4c089fb-a4f3-4f5f-9ff3-7428e95de669', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', '8', '2', '8'),
    ('7f6267b1-8ef2-4827-be30-6ec5ca830581', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '90753751-2ad1-4aa1-bf27-85fadb79b58d', '9', '2', '10'),
    ('a3121c43-62e7-42fa-8075-b6ed7e917da6', '8b0e3700-0eda-4c1c-8859-cba49c0c3cc2', '36737d85-0ae5-4be6-9bde-b5efbe74c497', '10', '2', '6'),
    ('f4bfedeb-dd83-42ed-aa25-d4698e7cc110', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '7f42f165-60f0-4ecf-966c-fd9171e9d494', '1', '2', '8'),
    ('bd9da7ea-6afb-4485-8a03-a9ff97437cf8', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', '2', '2', '8'),
    ('3cceb0b8-0c29-4a6e-8204-92ca81eff28a', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', '3', '3', '8'),
    ('c600cb25-be95-4e47-82f7-012b7ce4f653', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '0637e4e7-4432-4e95-ba21-650d854e1487', '4', '2', '6'),
    ('149fb6de-1f0a-4c86-a70b-d891e5fbdaa8', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', '5', '3', '8'),
    ('33901e84-8908-4e98-8920-29ab4838db76', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '4710e467-a074-47a0-bf97-fffed10dc80e', '6', '2', '8'),
    ('9f226c72-5ab7-4af8-a472-116af4f34851', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', '7', '2', '8'),
    ('a0c8567e-d8f5-4809-bfe2-8560a20afcaf', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', 'f0d3eea0-6473-4841-b31f-467ca945efd1', '8', '2', '8'),
    ('2781a591-42b0-4d17-941d-a51268a9b054', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', '9', '2', '8'),
    ('88b4a206-6c56-41e1-ac01-3271997e61a0', '6b4bd3dc-f79f-4cc0-af0e-a0002e3a0547', '63b7aacb-2a37-460d-9abc-d9977c2bc586', '10', '2', '8'),
    ('b2c33051-73d7-4407-a86d-f1c28b277c9e', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', '8ffec9fe-45dd-41f9-bd83-af305c838833', '1', '3', '10'),
    ('a878ef11-e5da-4498-9c44-1949a5e849ff', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', '28a7ae12-a491-484c-83bb-4d14ca483c14', '2', '3', '10'),
    ('3b9996b2-cafe-4b80-b3b0-4d9c686ebdf8', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', '936ece3b-3d24-451e-ac5e-52050668cbd7', '3', '2', '12'),
    ('585eb756-2a33-4177-841c-c55eaa2158e7', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', 'ba4bbe6f-357c-4ca4-bbc4-4f250306f4af', '4', '2', '10'),
    ('4bf9c763-b47a-4c0f-a339-18f4c2c55339', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', '479252ac-47e4-43c7-8fbd-eb7a12d3ec09', '5', '3', '10'),
    ('ada78481-ef2d-4af1-bf6f-5182d93d9db4', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', 'a8607fb6-80d2-47f2-a974-1498c14df750', '6', '3', '8'),
    ('4c4ead0d-8335-47a5-92ee-597e7eca31dd', 'e3a9ed68-7422-49ee-be93-d7a125d58e3b', '3ff1935b-a183-4994-9761-a45dae2ac01b', '7', '3', '15'),
    ('a9c43aad-4c1a-4daa-84e5-d8c610b62c8c', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '9a27ef30-59ec-4978-9eef-5016d91747d0', '1', '2', '8'),
    ('4454f06a-ed91-4a57-8fdc-dc43a8502b20', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '48708d8e-cce9-4783-8fef-f581893b9d40', '2', '2', '8'),
    ('54a9a75e-8791-401d-85c9-56e7756a859f', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '4a47351c-8270-4183-bd79-6f5019bcfbac', '3', '2', '8'),
    ('55578808-583f-47ce-9a42-923fe50820f8', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', '4', '2', '8'),
    ('9e8197d9-30a2-4468-9366-2e59ae4cfc8e', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '043338f7-6634-447a-8a5a-38435787efd3', '5', '2', '8'),
    ('186e96db-172c-45cc-ab11-3baa34b02e0f', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '43c5afef-656a-472e-ad0b-9a00429abb06', '6', '2', '6'),
    ('fd287c74-910d-4f23-b369-4d81f180ebb2', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', '7', '2', '8'),
    ('69ddfdb5-855e-4353-a6f6-dd03c561e073', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', '8', '2', '8'),
    ('163ddcbf-5cee-4edb-b3e2-6ebfd1f5b4f5', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '90753751-2ad1-4aa1-bf27-85fadb79b58d', '9', '2', '10'),
    ('2a017684-273d-4486-83c9-650159d5a0fb', 'dd2e7b21-03f7-47a3-9ff2-2683511ec3ac', '36737d85-0ae5-4be6-9bde-b5efbe74c497', '10', '2', '6'),
    ('34591a83-82a6-47e8-b978-dfc4b12f0782', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '7f42f165-60f0-4ecf-966c-fd9171e9d494', '1', '2', '8'),
    ('374f5a6a-9812-4285-aeeb-de4ac5f2f8dc', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', '2', '2', '8'),
    ('b7f6b400-e5b5-4310-8785-854fbde8bcbf', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', '3', '3', '8'),
    ('f7477b86-f056-4a68-8a91-605f16396d37', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '0637e4e7-4432-4e95-ba21-650d854e1487', '4', '2', '6'),
    ('491c9487-e7d7-453d-90a3-0ecaa85c20fd', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', '5', '3', '8'),
    ('75480a93-2b70-4995-892c-77eddbc13c2a', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '4710e467-a074-47a0-bf97-fffed10dc80e', '6', '2', '8'),
    ('a53a43be-f52e-4589-a61b-e42df5800b67', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', '7', '2', '8'),
    ('baeaccee-0e9a-42cb-8b79-82fbcae0979c', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', 'f0d3eea0-6473-4841-b31f-467ca945efd1', '8', '2', '8'),
    ('63135979-4b7b-4869-a771-36b2b123ce06', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', '9', '2', '8'),
    ('cba430cd-5d6b-4f50-9a22-53e318420b07', 'aeecd9fa-0f73-4052-b2fa-ecbe48c4fa48', '63b7aacb-2a37-460d-9abc-d9977c2bc586', '10', '2', '8'),
    ('3f1846af-ae69-436f-a891-d14d740e8e9e', '069e0d8a-2599-4c00-ba43-3abd77fb576b', '8ffec9fe-45dd-41f9-bd83-af305c838833', '1', '3', '10'),
    ('918851cd-94e0-434d-9dd4-2b916906d7cd', '069e0d8a-2599-4c00-ba43-3abd77fb576b', '630eeaa4-3f54-4a20-8f97-63659b69c8c1', '2', '3', '10'),
    ('a1574c78-e9a6-4b68-9daf-d1995780bd51', '069e0d8a-2599-4c00-ba43-3abd77fb576b', '936ece3b-3d24-451e-ac5e-52050668cbd7', '3', '2', '12'),
    ('47810812-6a5b-485e-9bdc-6e8343d4179e', '069e0d8a-2599-4c00-ba43-3abd77fb576b', 'ba4bbe6f-357c-4ca4-bbc4-4f250306f4af', '4', '2', '10'),
    ('7990591e-12d6-479b-8bb1-cab0d1086b80', '069e0d8a-2599-4c00-ba43-3abd77fb576b', '479252ac-47e4-43c7-8fbd-eb7a12d3ec09', '5', '3', '10'),
    ('bbc60692-9164-4006-b038-7e01bbfbc2c2', '069e0d8a-2599-4c00-ba43-3abd77fb576b', 'a8607fb6-80d2-47f2-a974-1498c14df750', '6', '3', '8'),
    ('87fd5db9-8d66-48b7-8471-2c99dc1aae86', '069e0d8a-2599-4c00-ba43-3abd77fb576b', '3ff1935b-a183-4994-9761-a45dae2ac01b', '7', '3', '15')
on conflict do nothing;

-- public.exercice_muscle: 37 redova
insert into public.exercice_muscle (id, exercice_id, muscle_group_id) values
    ('44157f68-0d93-4946-a437-34348fba901f', '043338f7-6634-447a-8a5a-38435787efd3', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('1067a9fd-5582-407b-824a-7169f45d6ce3', '36737d85-0ae5-4be6-9bde-b5efbe74c497', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('ac3d4777-8ea1-4b80-9540-d52783e42612', '43c5afef-656a-472e-ad0b-9a00429abb06', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('07d7a93d-474f-4834-9bde-26e9901b91ce', '71ea2897-f557-4105-ae7d-7f98b3c7a840', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('244c4c7d-073a-41bf-821b-7cea32924fbd', '90753751-2ad1-4aa1-bf27-85fadb79b58d', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('7c24b76e-113e-4d51-94dc-0987ca796294', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('f344b250-d825-435a-bb1b-ed7c06d1867b', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('9e924f34-c042-4ddb-8cc5-6220cf12240b', '63b7aacb-2a37-460d-9abc-d9977c2bc586', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('f3fe1b63-9e86-4b3c-be34-316befba5bf8', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('0f192057-4b9c-4b04-a6e9-e2f2030007de', 'a5c0d03b-e186-4c8a-a38e-7a2b48dc8d3d', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('04c9d56b-b3e8-4f37-ac30-a922cd712702', 'f0d3eea0-6473-4841-b31f-467ca945efd1', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('86c41334-dae5-4865-8af2-f3571b13ea09', '0637e4e7-4432-4e95-ba21-650d854e1487', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('7d4c29ce-743d-4501-bb60-5077dd6674be', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('c97f370f-7dea-4e6c-8ede-4dd05f845378', '4710e467-a074-47a0-bf97-fffed10dc80e', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('cbecd3f7-6fa6-43be-b647-061cd3399e7f', '6ebf3a3f-ea5d-4c47-ab15-066ca894769d', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('96eb7632-e32b-4c8c-99a1-b18d0af08f89', '7f42f165-60f0-4ecf-966c-fd9171e9d494', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('92f2f61d-fc42-4d04-815e-0fd89564a78a', 'bc3f9d4f-4e05-45c9-9e2e-70597fe7bfc4', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('6f29559d-f9d0-46f7-bfba-f8dabd39f24a', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('4223b2e1-afd7-44af-86eb-7bc0e621a550', '48708d8e-cce9-4783-8fef-f581893b9d40', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('7e1c20d4-c3e9-4d33-ab8c-c944712f6c54', '4a47351c-8270-4183-bd79-6f5019bcfbac', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('26e9f9b6-d43d-49ed-a42a-ccb00c5571aa', '9a27ef30-59ec-4978-9eef-5016d91747d0', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('f174f4b0-a7d3-4c1b-89ca-7044c77dcdd6', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', '598cbe57-30b8-431c-89d9-4e59b77a3b23'),
    ('cbc1227c-4770-4f96-be82-02e6adf4b7e7', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', '598cbe57-30b8-431c-89d9-4e59b77a3b23'),
    ('462bfcb9-fbe7-4b91-a48c-801b87e0bf3b', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', '598cbe57-30b8-431c-89d9-4e59b77a3b23'),
    ('36ad38dc-af6c-4760-b1bf-3e80aeb88329', '28a7ae12-a491-484c-83bb-4d14ca483c14', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('9fec3d5e-e8b5-460e-99b4-25bafb75f1fb', '3184e75e-f3f0-4ff1-80b0-05b59e0b7a1b', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('8b105f1d-8e72-4234-8738-97054d4c706e', '3ff1935b-a183-4994-9761-a45dae2ac01b', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('d43ea9ac-b4e8-48ed-a13d-cab15eae135c', '479252ac-47e4-43c7-8fbd-eb7a12d3ec09', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('035e4887-c48d-4889-bc01-b58cf06abd5e', '630eeaa4-3f54-4a20-8f97-63659b69c8c1', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('e9e70c7f-ecdc-4ef7-a49a-76f2b7b97f63', '6dd0377b-3d4e-43ad-ad23-5501dcbd2486', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('5513060e-d812-48a5-b208-58c3969af99d', '8ede576c-1f7a-4fa6-925e-b2b0d563c05c', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('00941670-7c8b-4783-a149-b10cd1e907b1', '8ffec9fe-45dd-41f9-bd83-af305c838833', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('a3011c66-4c60-438c-bc54-4c42cbaa9753', '936ece3b-3d24-451e-ac5e-52050668cbd7', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('c0cb49d7-1938-44c8-8914-951f17bd715d', 'a8607fb6-80d2-47f2-a974-1498c14df750', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('bffe8aa8-ad34-4d5a-b13c-604b24bab094', 'ba4bbe6f-357c-4ca4-bbc4-4f250306f4af', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('a4f10776-3e87-43a8-bb7b-44384ef920e0', '0d2948d6-d965-4b41-83e8-a0c9954deaaf', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('05ea3d48-75ec-434d-b20d-13b56e718f8c', '9530bdc0-c28b-4a60-9184-962573e45778', '62fdf852-b2a3-427f-952d-70390d068020')
on conflict do nothing;

-- public.day_type_muscle_group: 22 redova
insert into public.day_type_muscle_group (id, day_type_id, muscle_group_id) values
    ('d8c09eb3-fd00-44c5-a51e-d378bbcce36b', '085ed5b6-e53d-44a9-9897-27abc63bd3de', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('023ce8d7-64d9-4a3a-9746-aa35c47ed751', '085ed5b6-e53d-44a9-9897-27abc63bd3de', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('36c514df-d8ad-4fbc-bd49-00c97b0f1ec6', '085ed5b6-e53d-44a9-9897-27abc63bd3de', '598cbe57-30b8-431c-89d9-4e59b77a3b23'),
    ('3b0c9c84-dd45-4637-8454-2c3337350767', '085ed5b6-e53d-44a9-9897-27abc63bd3de', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('22eebd53-b16e-4020-8263-cf839864dc5a', '085ed5b6-e53d-44a9-9897-27abc63bd3de', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('c811b0ad-ef94-4a8f-9d4a-261c494c429d', '18805e1a-6cd2-4ca1-8e96-3fbbac4f590a', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('a57adbe3-96a3-46df-bcff-9d50d6b6ea05', '35a3de55-3076-4ff9-83ea-a6d0c39aa215', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('cd27c95d-50c5-45f2-9c7e-f58a0ed82191', '67682944-7d73-45b3-beed-877211d0363d', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('64b796c7-999b-4984-852d-e38c776f4f66', '67682944-7d73-45b3-beed-877211d0363d', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('46a2ba8c-13df-4122-bec0-8736d6dc9207', 'abbf9562-7dfe-431b-b69a-9dc44e5f05dc', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('14f55bc6-3ea9-49c7-b880-548e1fcefd50', 'abbf9562-7dfe-431b-b69a-9dc44e5f05dc', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('2eb3b999-2e10-46a7-a596-a3009c24cb5a', 'b5201b43-8ed3-465c-b4db-781402ebd605', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('cc931d45-b4fe-43b1-88cd-791562d8103b', 'b5201b43-8ed3-465c-b4db-781402ebd605', '598cbe57-30b8-431c-89d9-4e59b77a3b23'),
    ('59d12153-5c7d-47a8-bfc8-5faff87aa591', 'b5201b43-8ed3-465c-b4db-781402ebd605', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('69682fbc-f3eb-42e3-b952-e21e43961db8', 'f0ceca5f-b936-4f75-a30f-646b86afde06', '871b1219-f7cc-4640-815a-f7fab861d1ed'),
    ('9265955a-5993-47cb-b6c5-5762a1a8a78d', '10907d8e-b358-4d73-a2d9-ca54897acc07', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('a7f42859-fff5-47fe-b9af-b3ab91120345', 'f6d9d95b-8bc4-407f-ad3d-70d0b416338d', '0660fd96-f7c6-45b7-a6b8-679d2038a7da'),
    ('a94b9b4b-09f7-479d-b302-2c30e54f5a24', 'f6d9d95b-8bc4-407f-ad3d-70d0b416338d', '089e4607-955b-4879-9a85-10b1cd29ce44'),
    ('3d2f1e3a-a902-4050-814b-9318423bb00c', 'f6d9d95b-8bc4-407f-ad3d-70d0b416338d', '5980afb0-fbfd-4980-87b5-012fba3ae344'),
    ('f252cf1f-4b8a-412d-a021-f6d83dccfeb3', 'f6d9d95b-8bc4-407f-ad3d-70d0b416338d', '598cbe57-30b8-431c-89d9-4e59b77a3b23'),
    ('42ecf33a-bdbb-4e09-a5c4-701874e01579', 'f6d9d95b-8bc4-407f-ad3d-70d0b416338d', '62fdf852-b2a3-427f-952d-70390d068020'),
    ('7bc0f615-9e12-45e0-8298-582fe4b94c7a', 'f6d9d95b-8bc4-407f-ad3d-70d0b416338d', '871b1219-f7cc-4640-815a-f7fab861d1ed')
on conflict do nothing;

-- public.plan_members: 1 redova
insert into public.plan_members (id, plan_id, profile_id, joined_at) values
    ('2c947c7f-c1b0-4295-830e-d097a1dc773d', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '1e33125b-15ad-4293-b203-0d9520e2ef4e', '2026-07-21 15:01:02.172849+00')
on conflict do nothing;

-- public.exercice_logs: 105 redova
insert into public.exercice_logs (id, user_id, exercice_id, plan_id, date, set_number, reps, weight) values
    ('ef3d31ea-aa46-4fca-ba20-a5c8f225ef2b', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '9a27ef30-59ec-4978-9eef-5016d91747d0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '5', '70'),
    ('205674db-4f2e-4f59-a9a3-547489f1959c', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '48708d8e-cce9-4783-8fef-f581893b9d40', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '8', '40'),
    ('03cb5a9a-bfb0-4047-83eb-cf8a72d821f9', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '48708d8e-cce9-4783-8fef-f581893b9d40', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '7', '40'),
    ('67e02c2c-85b9-49ef-8801-5970a8e50dd4', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4a47351c-8270-4183-bd79-6f5019bcfbac', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '7', '50'),
    ('1a164fde-594b-48ff-abd8-3cd74d99f994', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '7', '45'),
    ('ee205225-bd9e-477e-9f2f-7226c1fe59ab', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4a47351c-8270-4183-bd79-6f5019bcfbac', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '6', '50'),
    ('0f902541-83e2-46e3-af6c-831a8d5c9516', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '6', '45'),
    ('6fae0d62-e4e5-454f-b124-50ad6a914ce9', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '043338f7-6634-447a-8a5a-38435787efd3', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '7', '30'),
    ('efb3a97a-12d0-4356-9594-23f51b75e9a1', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '043338f7-6634-447a-8a5a-38435787efd3', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '6', '30'),
    ('d1fbf29c-7cfa-41cc-9f17-85c0206194e2', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43c5afef-656a-472e-ad0b-9a00429abb06', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '4', '12.5'),
    ('ed999ce3-9465-44fe-b6b6-fa54385156fe', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43c5afef-656a-472e-ad0b-9a00429abb06', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '4', '12.5'),
    ('6e121e43-da9f-4dd1-8d8b-938ea11e8cc8', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43c5afef-656a-472e-ad0b-9a00429abb06', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '3', '4', '10'),
    ('917b8369-e824-4ce9-9fa0-88ef2a07dcda', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '8', '12.5'),
    ('593a3abb-289d-4369-a5ad-c4f824b77adb', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '6', '12.5'),
    ('be8433a3-05d9-43a9-b733-7ca5e57fedb0', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '6', '25'),
    ('634f8272-c6e8-4e06-bb44-d872cf8ed599', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '8', '20'),
    ('af4586d6-d31e-4594-a748-74262965071a', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '90753751-2ad1-4aa1-bf27-85fadb79b58d', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '14', '70'),
    ('dbadd9fc-dabf-4423-ad30-5ca768aeece1', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '90753751-2ad1-4aa1-bf27-85fadb79b58d', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '12', '70'),
    ('b3fdcf35-c9ae-4a5d-8cb0-05e0bcce271c', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '36737d85-0ae5-4be6-9bde-b5efbe74c497', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '4', '25'),
    ('8f3d8cc9-597a-48a4-bfbc-bd4564b21f37', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '36737d85-0ae5-4be6-9bde-b5efbe74c497', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '2', '6', '20'),
    ('c800ac1c-a5a6-4184-a880-0a026b134de1', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '7', '22.5'),
    ('ef5e8289-87fa-45ad-a3bc-dfe08b08a47a', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '6', '22.5'),
    ('b77520cd-0824-4849-b3ba-d05af04256b2', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '8', '40'),
    ('59bcd923-9411-46f5-80be-c12cea19b423', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '7', '40'),
    ('241a805d-742a-448d-9025-c41aa50d0dc3', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '3', '6', '40'),
    ('f7669fb0-92a1-47e9-b8f6-8699f13f67e4', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0637e4e7-4432-4e95-ba21-650d854e1487', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '7', '75'),
    ('d545913b-2842-45d2-994a-c885b8869029', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0637e4e7-4432-4e95-ba21-650d854e1487', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '6', '75'),
    ('daa12531-ea3b-4bb7-80f2-0d8aac0c7cee', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '7', '20'),
    ('0c160118-5408-4853-8946-dcb16efaf687', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '6', '20'),
    ('be5bfe12-9f8c-4427-ae80-25c9c83c326e', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '3', '5', '20'),
    ('9adc9853-2001-4b75-9632-f78c4fe3541f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4710e467-a074-47a0-bf97-fffed10dc80e', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '9', '25'),
    ('be8b40ca-51f4-4fc4-aa76-62a55afab510', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4710e467-a074-47a0-bf97-fffed10dc80e', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '7', '25'),
    ('60f2a3d8-7cac-4c20-97b4-b41bff29062f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '9', '50'),
    ('6e88c723-7210-4bf0-b471-ed9e71bd3e46', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '7', '50'),
    ('2683e985-8e45-4ab3-8b02-8c28ac93b01b', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f0d3eea0-6473-4841-b31f-467ca945efd1', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '8', '35'),
    ('c7c61182-d4b5-4882-9f17-50034c949dde', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f0d3eea0-6473-4841-b31f-467ca945efd1', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '6', '35'),
    ('81dafb7a-0308-49ff-951e-7e24ae88add3', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '11', '30'),
    ('187198a3-6295-4374-8148-e198e523d24f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '4', '35'),
    ('be5af15f-180c-43a0-901e-9a03244940c3', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '63b7aacb-2a37-460d-9abc-d9977c2bc586', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '6', '25'),
    ('eed660c9-bd9c-460b-b6f4-fea77cbead22', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '63b7aacb-2a37-460d-9abc-d9977c2bc586', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '6', '25'),
    ('ef395d20-3afd-43dc-b741-ed3129609a1c', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '936ece3b-3d24-451e-ac5e-52050668cbd7', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '10', '80'),
    ('6744bd0f-21ef-4106-80fe-0fa5b0b6c226', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'ba4bbe6f-357c-4ca4-bbc4-4f250306f4af', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '8', '140'),
    ('356c0ccb-dc7c-4be7-9520-094c27548e2c', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '9a27ef30-59ec-4978-9eef-5016d91747d0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-20', '1', '7', '70'),
    ('20b805dc-aefc-4ac3-9ac6-f97586d8cf2f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'ba4bbe6f-357c-4ca4-bbc4-4f250306f4af', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '6', '140'),
    ('029ff116-0b1b-43ea-b1ef-c78bb46ff296', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'a8607fb6-80d2-47f2-a974-1498c14df750', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '11', '60'),
    ('33e35ff7-f7e0-40f6-92cb-87dded727370', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'a8607fb6-80d2-47f2-a974-1498c14df750', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '10', '60'),
    ('4c342f64-b32a-46e0-ab4f-41f0b9f263bb', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'a8607fb6-80d2-47f2-a974-1498c14df750', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '3', '9', '60'),
    ('b90791ba-3753-4d9e-afa4-21018c5f8cdd', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7f42f165-60f0-4ecf-966c-fd9171e9d494', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '1', '7', '60'),
    ('8e2429c7-60e0-44c7-b77a-8baede0e87f9', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7f42f165-60f0-4ecf-966c-fd9171e9d494', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-21', '2', '5', '60'),
    ('f3ca2a12-5036-4abf-90d5-5c8e3446be9c', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8ffec9fe-45dd-41f9-bd83-af305c838833', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '11', '70'),
    ('79d22868-585f-4c8b-ba53-7f5862d7e54d', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8ffec9fe-45dd-41f9-bd83-af305c838833', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '9', '70'),
    ('e6b4183b-260a-407c-94be-5d6a55fdddfb', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8ffec9fe-45dd-41f9-bd83-af305c838833', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '3', '8', '70'),
    ('f535b97c-dc6c-492c-b10c-638744f67811', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '28a7ae12-a491-484c-83bb-4d14ca483c14', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '7', '120'),
    ('b3d0abd0-cb4d-43d0-a593-ee6e6943d80f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '28a7ae12-a491-484c-83bb-4d14ca483c14', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '4', '120'),
    ('c5d0afb0-f0c8-46a7-b8af-f158a810bf5b', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '28a7ae12-a491-484c-83bb-4d14ca483c14', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '3', '10', '100'),
    ('a55648ff-8485-4bfd-a266-76481e981dcd', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '936ece3b-3d24-451e-ac5e-52050668cbd7', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '12', '80'),
    ('aef2cc52-3a8f-4a45-8818-26494827f2ed', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '479252ac-47e4-43c7-8fbd-eb7a12d3ec09', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '11', '80'),
    ('41a58138-9922-4aa1-83dc-51317665c013', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '479252ac-47e4-43c7-8fbd-eb7a12d3ec09', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '9', '80'),
    ('4cf2aea1-c222-4dc9-bfe8-d733bdb1c5ac', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '479252ac-47e4-43c7-8fbd-eb7a12d3ec09', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '3', '9', '80'),
    ('a068bf3b-1b3e-43cd-8305-1809b987e14d', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '3ff1935b-a183-4994-9761-a45dae2ac01b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '1', '15', '120'),
    ('1ab8137a-62d8-4031-b39d-216a42ddd157', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '3ff1935b-a183-4994-9761-a45dae2ac01b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '2', '12', '120'),
    ('b1f2489e-d4fc-434b-901d-124be465bfa9', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '3ff1935b-a183-4994-9761-a45dae2ac01b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-22', '3', '11', '120'),
    ('538e8991-2c0c-4613-bfe4-f67bc9cb7860', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '9a27ef30-59ec-4978-9eef-5016d91747d0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '8', '70'),
    ('beffb583-7707-4418-8643-8cd2fc1abc09', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '9a27ef30-59ec-4978-9eef-5016d91747d0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '6', '70'),
    ('347a400e-911d-4a20-b4a8-6a9e8822c7fe', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '48708d8e-cce9-4783-8fef-f581893b9d40', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '9', '40'),
    ('921f2bf6-b799-49bf-a0f0-2d6dc2f67ea3', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '48708d8e-cce9-4783-8fef-f581893b9d40', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '7', '45'),
    ('83e4af90-df3a-41fb-b379-21bd28ab78f9', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4a47351c-8270-4183-bd79-6f5019bcfbac', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '7', '50'),
    ('f4312f9a-6d38-4e3c-9cb0-d5f153092944', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4a47351c-8270-4183-bd79-6f5019bcfbac', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '7', '50'),
    ('9024cae5-34b1-4675-be1a-1f7d48f6069e', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '8', '45'),
    ('9f37e3ff-d389-432c-8499-052a38fb3947', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '186a9465-f010-4faf-96dc-4cc43bdc2bf9', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '6', '45'),
    ('d91a4402-2359-486e-a9ff-05e6c4e95e41', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '043338f7-6634-447a-8a5a-38435787efd3', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '8', '30'),
    ('0c3e9a6d-46bb-4965-83e0-8201117ec842', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '043338f7-6634-447a-8a5a-38435787efd3', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '6', '30'),
    ('680e6740-3a12-4709-94d6-c4a730d3592d', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43c5afef-656a-472e-ad0b-9a00429abb06', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '5', '12.5'),
    ('a8b7d4c7-fc1d-4518-ac9a-cac3078eac1f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43c5afef-656a-472e-ad0b-9a00429abb06', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '4', '12.5'),
    ('06a195b8-d330-425e-b33b-38e8808166a6', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '5', '15'),
    ('36bb22e2-7d1f-4f72-8fa1-59b644ad133d', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f4f3bd66-6c5a-441a-a1b2-d954e08154a5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '4', '15'),
    ('877d1b77-b686-4fb7-a980-3a4f64b2b18d', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '6', '25'),
    ('02ca0ba1-6f91-4abc-86ec-158aa9f91a08', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'd50d8e52-562a-477d-8f13-7f188a15a0f0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '5', '25'),
    ('e0c10b89-3fa5-4bde-aa7c-7a1452f112cd', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '90753751-2ad1-4aa1-bf27-85fadb79b58d', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '7', '15'),
    ('f6dce97e-f069-4410-b430-01dedeaa82c1', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '90753751-2ad1-4aa1-bf27-85fadb79b58d', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '6', '15'),
    ('2212b7db-d4ee-4cae-8e2a-8ca9e106a2dd', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '90753751-2ad1-4aa1-bf27-85fadb79b58d', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '3', '6', '15'),
    ('db0a2488-c86d-4c85-b975-c7114ee3c9af', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '36737d85-0ae5-4be6-9bde-b5efbe74c497', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '1', '5', '25'),
    ('eca465e8-ca7b-43f2-88cb-f30a9f46c58b', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '36737d85-0ae5-4be6-9bde-b5efbe74c497', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-24', '2', '7', '20'),
    ('7e3d7883-686c-40db-9818-dd8f7e286dbf', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7f42f165-60f0-4ecf-966c-fd9171e9d494', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '7', '60'),
    ('f8b7fd0e-68ed-42cf-8764-d7d8184c671a', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7f42f165-60f0-4ecf-966c-fd9171e9d494', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '5', '60'),
    ('f36865e5-c568-403f-97dd-df143e58fed1', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '9', '22.5'),
    ('e44355ee-f357-4f05-bd8c-f569360a731e', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0fe860f1-1dde-4ca5-a3be-bf130f53b84c', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '5', '25'),
    ('7184dd73-7ecc-4e77-bb78-cf503c794134', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '7', '50'),
    ('8382da88-c4e2-4c57-8dd5-5be5d9ac0430', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '5', '50'),
    ('45d61e7e-e320-46aa-8e4b-5db1e819e758', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '7becdf95-2c34-4cc1-ad8d-088a539bedb5', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '3', '4', '50'),
    ('fc813a5d-41b4-46eb-aefd-55944195d79f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0637e4e7-4432-4e95-ba21-650d854e1487', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '9', '75'),
    ('b072a378-ff09-4f1c-8d46-cce60fe8d73f', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '0637e4e7-4432-4e95-ba21-650d854e1487', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '6', '80'),
    ('7f758bbf-ea38-4ac3-ba3d-5abc5c8bca10', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '6', '20'),
    ('dc693b92-f06d-4876-95df-413e6e32f7d5', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '7', '20'),
    ('cbdef6f3-20cf-4c42-b6ee-93940d5fe308', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '43a2ec0a-f31a-4c99-b944-ef9a1612ab9b', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '3', '6', '20'),
    ('986a0181-6cb4-42f4-92ee-faeb90ba33b1', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '9', '50'),
    ('54a9bc5a-31a4-4c2d-b19e-ac7fb06a0537', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4710e467-a074-47a0-bf97-fffed10dc80e', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '14', '25'),
    ('9294836a-617b-43b6-889d-48b158c64d9c', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '8e885ebd-cb9a-47c6-96e8-d9ffed2ed7e0', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '9', '50'),
    ('c9999015-0e22-49bb-a655-9e94552c3df8', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '4710e467-a074-47a0-bf97-fffed10dc80e', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '8', '30'),
    ('cf9cfca1-9678-4238-9bd8-7c086495e023', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f0d3eea0-6473-4841-b31f-467ca945efd1', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '7', '40'),
    ('c9677521-c0ca-4768-a913-4dc77809fea7', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', 'f0d3eea0-6473-4841-b31f-467ca945efd1', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '5', '40'),
    ('68e9f73d-4c35-4e46-84e4-987e58da4755', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '10', '30'),
    ('a7d97bd3-4d41-4373-840f-b7f97c78d80d', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '6bea385d-2d73-4e02-8b44-acdbf3d839ab', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '4', '35'),
    ('9d7c9a9b-6e3f-4160-ad8a-a67b11e0eae6', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '63b7aacb-2a37-460d-9abc-d9977c2bc586', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '1', '6', '25'),
    ('b918bd9f-4d8a-4a19-aea0-32da19d58d16', 'e281108d-1a1e-42ed-b67a-20db768ffc0b', '63b7aacb-2a37-460d-9abc-d9977c2bc586', 'c87a6715-586c-41b9-8fb5-a1c3e15b163e', '2026-07-25', '2', '5', '25')
on conflict do nothing;

-- --------------------------------------------------------------------------
-- Sesije za istorijske upise
--
-- Isti SQL je i u migraciji 20260726000000_workout_sessions.sql (za
-- produkciju). Ovdje se ponavlja jer migracije idu PRIJE seed-a, pa tamo
-- nemaju nad čim da rade. Bez ovoga "prethodni trening" nema podataka.
-- --------------------------------------------------------------------------

insert into public.workout_sessions (user_id, plan_id, date, started_at, finished_at)
select distinct l.user_id, l.plan_id, l.date, l.date::timestamptz, l.date::timestamptz
from public.exercice_logs l
where l.session_id is null
on conflict (user_id, date) do nothing;

update public.exercice_logs l
set session_id = s.id
from public.workout_sessions s
where l.session_id is null and s.user_id = l.user_id and s.date = l.date;

insert into public.session_exercices (session_id, exercice_id, order_num)
select l.session_id, l.exercice_id,
       row_number() over (partition by l.session_id order by min(l.set_number), l.exercice_id)
from public.exercice_logs l
where l.session_id is not null
group by l.session_id, l.exercice_id
on conflict do nothing;
