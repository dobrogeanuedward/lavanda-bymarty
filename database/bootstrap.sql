-- Lavanda CMS: apply ONCE to a NEW, DEDICATED Supabase project using the SQL editor.
-- This is a reviewed bootstrap, not an applied migration and not a change to existing projects.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

create table public.cms_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Redazione' check(length(display_name) between 1 and 100),
  role text not null default 'viewer' check(role in ('admin','editor','author','viewer')),
  active boolean not null default false,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Authorization lives in a protected table, never in user-editable auth metadata.
-- This private SECURITY DEFINER avoids policy recursion and only returns the current user's role.
create function private.cms_role() returns text language sql stable security definer set search_path='' as $$
  select case when auth.uid() is null then null else
    (select p.role from public.cms_profiles p where p.id=auth.uid() and p.active) end
$$;
revoke all on function private.cms_role() from public;
grant execute on function private.cms_role() to anon,authenticated;

create table public.cms_taxonomies (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
  slug text not null check(length(slug)<=150 and slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check(kind in ('category','tag')), description text not null default '' check(length(description)<=2000),
  version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(kind,slug)
);
create table public.cms_media (
  id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 240),
  alt text not null default '' check(length(alt)<=1000), caption text not null default '' check(length(caption)<=2000),
  credit text not null default '' check(length(credit)<=500),folder text not null default '' check(length(folder)<=100),
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf')),
  size_bytes integer not null check(size_bytes between 1 and 3145728),
  storage_path text not null unique check(storage_path~'^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif|avif|pdf)$'),
  public_url text not null check(public_url~'^/api/media\?id=[0-9a-f-]{36}$'),published boolean not null default false,
  author_id uuid not null references public.cms_profiles(id),version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.cms_entries (
  id uuid primary key default gen_random_uuid(),type text not null check(type in ('post','page','fanzine')),
  title text not null check(length(title) between 1 and 240),slug text not null check(length(slug)<=150 and slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '' check(length(excerpt)<=1000), body text not null default '' check(length(body)<=500000),
  status text not null default 'draft' check(status in ('draft','review','scheduled','published','archived','trash')),
  author_id uuid not null references public.cms_profiles(id),
  cover_media_id uuid references public.cms_media(id),category_id uuid references public.cms_taxonomies(id) on delete set null,
  tags text[] not null default '{}' check(cardinality(tags)<=30),
  seo jsonb not null default '{}' check(jsonb_typeof(seo)='object' and octet_length(seo::text)<=5000),
  metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=12000),
  fanzine_pages jsonb not null default '[]' check(jsonb_typeof(fanzine_pages)='array' and jsonb_array_length(fanzine_pages)<=100 and octet_length(fanzine_pages::text)<=1100000),
  published_at timestamptz,version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(type,slug),
  check(status not in ('published','scheduled') or (published_at is not null and (length(trim(body))>0 or jsonb_array_length(fanzine_pages)>0)))
);
create index cms_entries_public_idx on public.cms_entries(type,published_at desc) where status in ('published','scheduled');
create index cms_entries_author_idx on public.cms_entries(author_id);
create index cms_entries_cover_idx on public.cms_entries(cover_media_id);
create index cms_entries_category_idx on public.cms_entries(category_id);
create index cms_media_author_idx on public.cms_media(author_id);
-- Private drafting notes are separate from the publicly readable entry record.
create table public.cms_entry_notes(
 entry_id uuid primary key references public.cms_entries(id)on delete cascade,
 body text not null default '' check(length(body)<=20000)
);
alter table public.cms_entry_notes enable row level security;
revoke all on public.cms_entry_notes from public,anon,authenticated;
grant select,insert,update on public.cms_entry_notes to authenticated;
create policy cms_entry_notes_read on public.cms_entry_notes for select to authenticated using((select private.cms_role())is not null);
create policy cms_entry_notes_insert on public.cms_entry_notes for insert to authenticated with check(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and exists(select 1 from public.cms_entries e where e.id=entry_id and e.author_id=(select auth.uid())and e.status in('draft','review','trash')))
);
create policy cms_entry_notes_update on public.cms_entry_notes for update to authenticated using(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and exists(select 1 from public.cms_entries e where e.id=entry_id and e.author_id=(select auth.uid())and e.status in('draft','review','trash')))
)with check(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and exists(select 1 from public.cms_entries e where e.id=entry_id and e.author_id=(select auth.uid())and e.status in('draft','review','trash')))
);
create table public.cms_revisions (
  id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.cms_entries(id),
  actor_id uuid references public.cms_profiles(id),snapshot jsonb not null,created_at timestamptz not null default now()
);
create index cms_revisions_entry_idx on public.cms_revisions(entry_id,created_at desc);
create index cms_revisions_actor_idx on public.cms_revisions(actor_id);
create table public.cms_settings (
  id uuid primary key default gen_random_uuid(),singleton boolean not null default true unique check(singleton),
  site_title text not null default 'Lavanda' check(length(site_title) between 1 and 150),tagline text not null default 'Strega di quartiere' check(length(tagline)<=240),
  site_description text not null default '' check(length(site_description)<=1000),seo jsonb not null default '{}' check(jsonb_typeof(seo)='object' and octet_length(seo::text)<=5000),
  social_links jsonb not null default '{}' check(jsonb_typeof(social_links)='object' and octet_length(social_links::text)<=25000),
  navigation jsonb not null default '[]' check(jsonb_typeof(navigation)='array' and jsonb_array_length(navigation)<=20 and octet_length(navigation::text)<=50000),
  version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.cms_settings(site_title,tagline)values('Lavanda','Strega di quartiere');
create table public.cms_redirects (
  id uuid primary key default gen_random_uuid(),source text not null unique check(source~'^/[^[:space:]<>]*$' and source!~'^//' and source!~'^/(api|admin)(/|$)' and length(source)<=2048),
  target text not null check((target~'^/[^[:space:]<>]*$' and target!~'^//')or target~'^https://[^[:space:]<>]+$'),
  code integer not null default 301 check(code in (301,302)),version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(source<>target)
);
create table public.cms_comments (
  id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.cms_entries(id),
  author_name text not null check(length(author_name) between 1 and 100),body text not null check(length(body) between 1 and 10000),
  status text not null default 'pending' check(status in ('pending','approved','spam','trash')),
  version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index cms_comments_entry_idx on public.cms_comments(entry_id);
create table public.cms_audit (
  id uuid primary key default gen_random_uuid(),actor_id uuid references public.cms_profiles(id),
  resource text not null,resource_id uuid not null,action text not null check(action in ('INSERT','UPDATE','DELETE')),
  created_at timestamptz not null default now()
);
create index cms_audit_actor_idx on public.cms_audit(actor_id);
create table public.cms_analytics_daily (
  day date not null,path text not null,event text not null check(event in ('page_view','article_open','fanzine_open','download','outbound_click')),
  count bigint not null default 1 check(count>0),primary key(day,path,event)
);
create table private.cms_secrets(name text primary key,value text not null check(length(value)>=32));
create table private.cms_event_limits(minute timestamptz primary key,count integer not null default 1);
revoke all on private.cms_secrets,private.cms_event_limits from public,anon,authenticated;

-- The database repeats validation that must hold if a caller bypasses the application API.
create function private.cms_validate_entry() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor_role text;page jsonb; media_uuid uuid;
begin
  actor_role:=private.cms_role();
  if tg_op='UPDATE' then
    if new.id<>old.id or new.author_id<>old.author_id or new.created_at<>old.created_at then raise exception 'Immutable content identity' using errcode='42501';end if;
    if actor_role='author' and (old.status not in('draft','review','trash') or new.status not in('draft','review','trash')) then raise exception 'Editor required' using errcode='42501';end if;
  end if;
  if new.seo - array['title','description','canonical','noindex'] <> '{}'::jsonb or new.metadata-array['subtitle','cover_url','image_alt','source_note','category_name','source_status','issue_number','article_ids']<>'{}'::jsonb then raise exception 'Unknown content metadata' using errcode='23514';end if;
  if new.seo ? 'canonical' and new.seo->>'canonical'<>'' and new.seo->>'canonical'!~'^https://[^[:space:]<>]+$' then raise exception 'Unsafe canonical' using errcode='23514';end if;
  if new.metadata ? 'cover_url' and new.metadata->>'cover_url'<>'' and new.metadata->>'cover_url'!~'^(https://[^[:space:]<>]+|/[^/[:space:]<>][^[:space:]<>]*)$' then raise exception 'Unsafe cover URL' using errcode='23514';end if;
  if new.status='published' and (new.published_at is null or new.published_at>now()) then new.published_at:=now();end if;
  if new.status='scheduled' and (new.published_at is null or (tg_op='INSERT' and new.published_at<=now()))then raise exception 'Future schedule required' using errcode='23514';end if;
  if new.status in('published','scheduled') then
    if new.cover_media_id is not null and not exists(select 1 from public.cms_media m where m.id=new.cover_media_id and m.published)then raise exception 'Publish the cover media first' using errcode='23514';end if;
    for page in select value from jsonb_array_elements(new.fanzine_pages)loop
      if page ? 'media_id' and page->>'media_id' is not null then
        media_uuid:=(page->>'media_id')::uuid;
        if not exists(select 1 from public.cms_media m where m.id=media_uuid and m.published)then raise exception 'Publish fanzine media first' using errcode='23514';end if;
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.cms_validate_entry() from public;
create trigger cms_entry_validate before insert or update on public.cms_entries for each row execute function private.cms_validate_entry();

create function private.cms_version_row()returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.created_at<>old.created_at then raise exception 'Immutable identity' using errcode='42501';end if;
    new.version:=old.version+1;new.updated_at:=now();
  else new.version:=1;new.created_at:=now();new.updated_at:=now();end if;
  return new;
end $$;
revoke all on function private.cms_version_row() from public;
do $$declare t text;begin foreach t in array array['cms_entries','cms_media','cms_taxonomies','cms_settings','cms_profiles','cms_redirects','cms_comments']loop
 execute format('create trigger cms_version before insert or update on public.%I for each row execute function private.cms_version_row()',t);
end loop;end $$;

-- Trigger-only privileges: callers cannot manufacture audit records or edit revisions.
create function private.cms_audit_row()returns trigger language plpgsql security definer set search_path='' as $$
declare row_id uuid;begin
 if auth.uid() is null then return null;end if;
 row_id:=case when tg_op='DELETE' then old.id else new.id end;
 insert into public.cms_audit(actor_id,resource,resource_id,action)values(auth.uid(),tg_table_name,row_id,tg_op);
 if tg_table_name='cms_entries' and tg_op<>'DELETE' then
   insert into public.cms_revisions(entry_id,actor_id,snapshot)values(new.id,auth.uid(),to_jsonb(new));
 end if;
 return null;
end $$;
revoke all on function private.cms_audit_row() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['cms_entries','cms_media','cms_taxonomies','cms_settings','cms_profiles','cms_redirects','cms_comments']loop
 execute format('create trigger cms_audit after insert or update or delete on public.%I for each row execute function private.cms_audit_row()',t);
end loop;end $$;

create function private.cms_new_user()returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.cms_profiles(id,display_name,role,active)values(new.id,'Redazione','viewer',false);return new;end $$;
revoke all on function private.cms_new_user()from public,anon,authenticated;
create trigger lavanda_new_user after insert on auth.users for each row execute function private.cms_new_user();

-- No anonymous sign-up can gain access. An admin must activate an existing account.
insert into public.cms_profiles(id)select id from auth.users on conflict(id)do nothing;

do $$declare t text;begin foreach t in array array['cms_profiles','cms_entries','cms_media','cms_taxonomies','cms_settings','cms_redirects','cms_revisions','cms_comments','cms_audit','cms_analytics_daily']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop;end $$;
grant select on public.cms_entries,public.cms_media,public.cms_taxonomies,public.cms_settings to anon;
grant select on public.cms_entries,public.cms_media,public.cms_taxonomies,public.cms_settings,public.cms_profiles,public.cms_redirects,public.cms_comments,public.cms_revisions,public.cms_audit,public.cms_analytics_daily to authenticated;
grant insert,update on public.cms_entries to authenticated;
grant insert,update,delete on public.cms_media,public.cms_taxonomies,public.cms_redirects,public.cms_comments to authenticated;
grant update on public.cms_settings,public.cms_profiles to authenticated;

create policy cms_profiles_read on public.cms_profiles for select to authenticated using(id=(select auth.uid()) or(select private.cms_role())is not null);
create policy cms_profiles_admin on public.cms_profiles for update to authenticated using((select private.cms_role())='admin')with check((select private.cms_role())='admin');

create policy cms_entries_read on public.cms_entries for select to anon,authenticated using(
 (status in('published','scheduled')and published_at<=now())or(select private.cms_role())is not null
);
create policy cms_entries_insert on public.cms_entries for insert to authenticated with check(
 author_id=(select auth.uid())and((select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and status in('draft','review')))
);
create policy cms_entries_update on public.cms_entries for update to authenticated using(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and author_id=(select auth.uid())and status in('draft','review','trash'))
)with check(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and author_id=(select auth.uid())and status in('draft','review','trash'))
);

create policy cms_media_read on public.cms_media for select to anon,authenticated using(published or(select private.cms_role())is not null);
create policy cms_media_insert on public.cms_media for insert to authenticated with check(
 author_id=(select auth.uid())and storage_path like (select auth.uid())::text||'/%'and((select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and not published))
);
create policy cms_media_update on public.cms_media for update to authenticated using(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and author_id=(select auth.uid())and not published)
)with check(
 (select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and author_id=(select auth.uid())and not published)
);
create policy cms_media_delete on public.cms_media for delete to authenticated using(not published and((select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and author_id=(select auth.uid()))));
create policy cms_taxonomies_read on public.cms_taxonomies for select to anon,authenticated using(true);
create policy cms_taxonomies_write on public.cms_taxonomies for all to authenticated using((select private.cms_role())in('admin','editor'))with check((select private.cms_role())in('admin','editor'));
create policy cms_settings_read on public.cms_settings for select to anon,authenticated using(true);
create policy cms_settings_update on public.cms_settings for update to authenticated using((select private.cms_role())='admin')with check((select private.cms_role())='admin');
create policy cms_redirects_read on public.cms_redirects for select to authenticated using((select private.cms_role())is not null);
create policy cms_redirects_write on public.cms_redirects for all to authenticated using((select private.cms_role())='admin')with check((select private.cms_role())='admin');
create policy cms_comments_read on public.cms_comments for select to authenticated using((select private.cms_role())is not null);
create policy cms_comments_write on public.cms_comments for all to authenticated using((select private.cms_role())in('admin','editor'))with check((select private.cms_role())in('admin','editor'));
create policy cms_revisions_read on public.cms_revisions for select to authenticated using((select private.cms_role())is not null);
create policy cms_audit_read on public.cms_audit for select to authenticated using((select private.cms_role())='admin');
create policy cms_analytics_read on public.cms_analytics_daily for select to authenticated using((select private.cms_role())is not null);

-- Author media identity and storage path cannot be changed through the direct Data API.
create function private.cms_validate_media()returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE'and(new.author_id<>old.author_id or new.storage_path<>old.storage_path or new.mime_type<>old.mime_type or new.size_bytes<>old.size_bytes or new.public_url<>old.public_url)then raise exception 'Immutable media identity' using errcode='42501';end if;
 if new.public_url<>('/api/media?id='||new.id::text)then raise exception 'Invalid media URL' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.cms_validate_media()from public;
create trigger cms_media_validate before insert or update on public.cms_media for each row execute function private.cms_validate_media();

-- Prevent a direct API call from deactivating/demoting its own admin account.
create function private.cms_validate_profile()returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.id=auth.uid()and old.role='admin'and(new.role<>'admin'or not new.active)then raise exception 'Cannot remove own admin access' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.cms_validate_profile()from public;
create trigger cms_profile_validate before update on public.cms_profiles for each row execute function private.cms_validate_profile();

-- Private bucket: publication of a media row controls access to the underlying object.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lavanda-media','lavanda-media',false,3145728,array['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf']);
create policy lavanda_storage_read on storage.objects for select to anon,authenticated using(
 bucket_id='lavanda-media'and(
  exists(select 1 from public.cms_media m where m.storage_path=name and m.published)
  or(select private.cms_role())in('admin','editor','viewer')
  or((select private.cms_role())='author'and(storage.foldername(name))[1]=(select auth.uid())::text)
 )
);
create policy lavanda_storage_insert on storage.objects for insert to authenticated with check(
 bucket_id='lavanda-media'and(select private.cms_role())in('admin','editor','author')and(storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.cms_media m where m.storage_path=name)
);
create policy lavanda_storage_delete on storage.objects for delete to authenticated using(
 bucket_id='lavanda-media'and((select private.cms_role())in('admin','editor')or((select private.cms_role())='author'and(storage.foldername(name))[1]=(select auth.uid())::text))
 and not exists(select 1 from public.cms_media m where m.storage_path=name)
);

-- Privacy: no visitor IDs, IPs, cookies, referrers, device strings or raw-event table.
-- Anonymous calls require a short-lived HMAC from the server, not a service-role key.
create function private.cms_record_event(p_event text,p_path text,p_timestamp bigint,p_signature text)returns boolean
language plpgsql security definer set search_path='' as $$
declare secret text;expected text;payload text;bucket timestamptz;hits integer;
begin
 if p_event is null or p_path is null or p_timestamp is null or p_signature is null then raise exception 'Missing event signature' using errcode='42501';end if;
 if p_event not in('page_view','article_open','fanzine_open','download','outbound_click')or length(p_path)>200 or p_path!~'^/[A-Za-z0-9/_\.-]*$'or p_path~'(^|/)(api|admin)(/|$)'then raise exception 'Invalid event' using errcode='22023';end if;
 if abs(extract(epoch from clock_timestamp())-p_timestamp)>60 then raise exception 'Expired signature' using errcode='42501';end if;
 select value into secret from private.cms_secrets where name='analytics_hmac';
 if secret is null then raise exception 'Analytics not configured' using errcode='42501';end if;
 payload:=p_timestamp::text||'.{"event":'||to_json(p_event)::text||',"path":'||to_json(p_path)::text||'}';
 expected:=encode(extensions.hmac(payload,secret,'sha256'),'hex');
 if length(p_signature)<>64 or p_signature is distinct from expected then raise exception 'Invalid signature' using errcode='42501';end if;
 bucket:=date_trunc('minute',clock_timestamp());
 insert into private.cms_event_limits(minute,count)values(bucket,1)on conflict(minute)do update set count=private.cms_event_limits.count+1 returning count into hits;
 if hits>600 then return false;end if;
 insert into public.cms_analytics_daily(day,path,event,count)values((now()at time zone'UTC')::date,p_path,p_event,1)
 on conflict(day,path,event)do update set count=public.cms_analytics_daily.count+1;
 delete from private.cms_event_limits where minute<now()-interval'2 hours';
 delete from public.cms_analytics_daily where day<current_date-400;
 return true;
end $$;
revoke all on function private.cms_record_event(text,text,bigint,text)from public;
grant execute on function private.cms_record_event(text,text,bigint,text)to anon,authenticated;
create function public.cms_record_event(p_event text,p_path text,p_timestamp bigint,p_signature text)returns boolean
language sql security invoker set search_path='' as $$select private.cms_record_event(p_event,p_path,p_timestamp,p_signature)$$;
revoke all on function public.cms_record_event(text,text,bigint,text)from public;
grant execute on function public.cms_record_event(text,text,bigint,text)to anon,authenticated;

create function public.cms_analytics(p_days integer default 30)returns jsonb language sql stable security invoker set search_path='' as $$
 with d as(select day,path,event,count from public.cms_analytics_daily where day>=((now()at time zone'UTC')::date-greatest(1,least(p_days,365))+1)),
 totals as(select jsonb_object_agg(e,coalesce((select sum(d.count)from d where event=e),0))as val from unnest(array['page_view','article_open','fanzine_open','download','outbound_click'])e),
 daily as(select day,event,sum(count)as count from d group by day,event order by day),
 pages as(select path,sum(count)as count from d where event='page_view'group by path order by sum(count)desc limit 20)
 select jsonb_build_object('totals',(select val from totals),'daily',coalesce((select jsonb_agg(jsonb_build_object('date',day,'event',event,'count',count))from daily),'[]'::jsonb),'pages',coalesce((select jsonb_agg(to_jsonb(pages))from pages),'[]'::jsonb),'periodDays',greatest(1,least(p_days,365)),'privacy','aggregate-no-identifiers')
$$;
revoke all on function public.cms_analytics(integer)from public,anon;
grant execute on function public.cms_analytics(integer)to authenticated;

-- One transaction writes the entry, its version/revision and its private research notes.
-- SECURITY INVOKER is essential: the caller's normal RLS is always applied.
create function public.cms_save_entry(p_id uuid,p_expected_version integer,p_entry jsonb,p_editorial_notes text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous public.cms_entries;proposed public.cms_entries;saved public.cms_entries;actor_role text;
begin
 actor_role:=private.cms_role();
 if auth.uid()is null or actor_role is null or actor_role='viewer'then raise exception 'Writer required' using errcode='42501';end if;
 if p_entry is null or jsonb_typeof(p_entry)<>'object'or p_entry-array['type','title','slug','excerpt','body','status','cover_media_id','category_id','tags','seo','metadata','published_at','fanzine_pages']<>'{}'::jsonb then raise exception 'Unknown entry fields' using errcode='22023';end if;
 if p_editorial_notes is not null and length(p_editorial_notes)>20000 then raise exception 'Notes too long' using errcode='22023';end if;
 if p_id is null then
  proposed:=jsonb_populate_record(null::public.cms_entries,p_entry);
  insert into public.cms_entries(type,title,slug,excerpt,body,status,author_id,cover_media_id,category_id,tags,seo,metadata,published_at,fanzine_pages)
  values(proposed.type,proposed.title,proposed.slug,coalesce(proposed.excerpt,''),coalesce(proposed.body,''),coalesce(proposed.status,'draft'),auth.uid(),proposed.cover_media_id,proposed.category_id,coalesce(proposed.tags,'{}'),coalesce(proposed.seo,'{}'),coalesce(proposed.metadata,'{}'),proposed.published_at,coalesce(proposed.fanzine_pages,'[]'))returning*into saved;
 else
  if p_expected_version is null or p_expected_version<1 then raise exception 'Version required' using errcode='22023';end if;
  select*into previous from public.cms_entries where id=p_id for update;
  if not found then raise exception 'Entry not found' using errcode='P0002';end if;
  if previous.version<>p_expected_version then raise exception 'Version conflict' using errcode='40001';end if;
  proposed:=jsonb_populate_record(previous,p_entry);
  update public.cms_entries set type=proposed.type,title=proposed.title,slug=proposed.slug,excerpt=proposed.excerpt,body=proposed.body,status=proposed.status,
   cover_media_id=proposed.cover_media_id,category_id=proposed.category_id,tags=proposed.tags,seo=proposed.seo,metadata=proposed.metadata,published_at=proposed.published_at,fanzine_pages=proposed.fanzine_pages
   where id=p_id and version=p_expected_version returning*into saved;
  if not found then raise exception 'Entry write forbidden' using errcode='42501';end if;
 end if;
 if p_editorial_notes is not null then
  insert into public.cms_entry_notes(entry_id,body)values(saved.id,p_editorial_notes)on conflict(entry_id)do update set body=excluded.body;
 end if;
 return to_jsonb(saved)||jsonb_build_object('editorial_notes',coalesce((select body from public.cms_entry_notes where entry_id=saved.id),''));
end $$;
revoke all on function public.cms_save_entry(uuid,integer,jsonb,text)from public,anon;
grant execute on function public.cms_save_entry(uuid,integer,jsonb,text)to authenticated;

-- Dedicated-project setup continues in docs/cms-backend.md: activate first admin and analytics HMAC.
notify pgrst,'reload schema';
commit;
