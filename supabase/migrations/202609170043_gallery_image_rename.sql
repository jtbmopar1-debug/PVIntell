-- Gallery images belong to the signed-in user. Renaming changes only the
-- display name used across Gallery and Wattson, so owners also need update
-- access alongside the existing read, add and delete policies.
create policy "gallery owners update"
  on public.user_gallery_images
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
