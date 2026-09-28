-- Attention Wikipédia (29/09/2026) : vues quotidiennes de la page d'un artiste.
--   wiki_pageviews  vues par jour et par article (API Pageviews de Wikimedia, données CC0) :
--                   publiques, lisibles par tout compte connecté
--   wiki_links      quel article pour quel artiste du roster ou de la liste A&R, par espace :
--                   trouvé par Wikidata (« auto »), corrigé par le client (« manual »),
--                   ou « none » (aucune page). Lecture : mêmes règles que les registres ;
--                   liste A&R réservée au propriétaire et à l'équipe.
create table if not exists public.wiki_pageviews (
  project text not null check (project in ('fr.wikipedia', 'en.wikipedia')),
  article text not null check (char_length(article) between 1 and 250),
  day date not null,
  views integer not null check (views >= 0),
  primary key (project, article, day)
);

create table if not exists public.wiki_links (
  id uuid primary key default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  artist_id uuid references public.artists (id) on delete cascade,
  watch_id uuid references public.ar_watchlist (id) on delete cascade,
  qid text check (qid ~ '^Q[0-9]+$'),
  project text check (project in ('fr.wikipedia', 'en.wikipedia')),
  article text check (char_length(article) between 1 and 250),
  method text not null check (method in ('auto', 'manual', 'none')),
  check ((artist_id is null) <> (watch_id is null)),
  check ((method = 'none') = (article is null)),
  check ((article is null) = (project is null)),
  unique (artist_id),
  unique (watch_id)
);
create index if not exists wiki_links_article_idx on public.wiki_links (project, article);

alter table public.wiki_pageviews enable row level security;
drop policy if exists "connectés : lecture" on public.wiki_pageviews;
create policy "connectés : lecture" on public.wiki_pageviews for select to authenticated using (true);
revoke all on table public.wiki_pageviews from anon, authenticated;
grant select on table public.wiki_pageviews to authenticated;
grant select, insert, update, delete on table public.wiki_pageviews to service_role;

alter table public.wiki_links enable row level security;
drop policy if exists "membres : lecture" on public.wiki_links;
create policy "membres : lecture" on public.wiki_links for select to authenticated using (
  private.member_role(workspace_id) in ('owner', 'member')
  or (private.member_role(workspace_id) = 'artist' and artist_id = private.member_artist(workspace_id)));
revoke all on table public.wiki_links from anon, authenticated;
grant select on table public.wiki_links to authenticated;
grant select, insert, update, delete on table public.wiki_links to service_role;
