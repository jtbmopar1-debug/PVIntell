create table public.user_gallery_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  source text not null default 'gallery' check (source in ('gallery', 'wattson')),
  created_at timestamptz not null default now()
);

create index user_gallery_images_owner_created_idx on public.user_gallery_images(owner_id, created_at desc);

alter table public.user_gallery_images enable row level security;
create policy "gallery owners select" on public.user_gallery_images for select using (owner_id = (select auth.uid()));
create policy "gallery owners insert" on public.user_gallery_images for insert with check (owner_id = (select auth.uid()));
create policy "gallery owners delete" on public.user_gallery_images for delete using (owner_id = (select auth.uid()));

create or replace function public.enforce_gallery_image_limit()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.user_gallery_images where owner_id = new.owner_id) >= 30 then
    raise exception 'Gallery limit reached (30 images). Delete an image before adding another.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger enforce_gallery_image_limit_before_insert
before insert on public.user_gallery_images
for each row execute function public.enforce_gallery_image_limit();

