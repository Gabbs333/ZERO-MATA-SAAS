-- Function to create a user (only accessible by admins)
-- Uses Supabase auth.admin API instead of direct auth.users insert
create or replace function admin_create_user(
  p_email text,
  p_password text,
  p_role text,
  p_etablissement_id uuid,
  p_nom text,
  p_prenom text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_user_id uuid;
  check_role text;
begin
  -- Check if caller is admin
  select role into check_role from public.profiles where id = auth.uid();
  if check_role != 'admin' then
    raise exception 'Unauthorized: Only admins can create users';
  end if;

  -- Use Supabase auth.admin to create user
  -- This is the recommended approach that handles password hashing properly
  new_user_id := (auth.admin.create_user(
    p_email => p_email,
    p_password => p_password,
    p_email_confirm => true,
    p_raw_user_meta_data => jsonb_build_object(
      'role', p_role,
      'nom', p_nom,
      'prenom', p_prenom,
      'etablissement_id', p_etablissement_id
    )
  )).id;

  -- Update profile with correct etablissement_id
  update public.profiles
  set etablissement_id = p_etablissement_id
  where id = new_user_id;
  
  return new_user_id;
exception
  when duplicate_object then
    raise exception 'User with this email already exists';
end;
$$;

-- Create function for admin to manage establishment users
-- This is used by admin dashboard to create users in specific establishments
create or replace function admin_invite_establishment_user(
  p_email text,
  p_password text,
  p_role text,
  p_etablissement_id uuid,
  p_nom text,
  p_prenom text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_user_id uuid;
  caller_role text;
begin
  -- Check if caller is admin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role != 'admin' then
    raise exception 'Unauthorized: Only admins can create users';
  end if;

  -- Verify establishment exists
  if not exists (select 1 from etablissements where id = p_etablissement_id) then
    raise exception 'Establishment not found';
  end if;

  -- Use admin_create_user
  new_user_id := public.admin_create_user(
    p_email,
    p_password,
    p_role,
    p_etablissement_id,
    p_nom,
    p_prenom
  );
  
  return new_user_id;
end;
$$;

comment on function admin_create_user is 'Creates a new user with hashed password using Supabase auth.admin API';
comment on function admin_invite_establishment_user is 'Allows admin to invite users to a specific establishment';
