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
as $
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
$;
  
  return new_user_id;
exception
  when unique_violation then
    raise exception 'User with this email already exists';
end;
$$;

-- Function to update user password (only accessible by admins)
create or replace function admin_update_user_password(
  target_user_id uuid,
  new_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  check_role text;
begin
  -- Check if caller is admin
  select role into check_role from public.profiles where id = auth.uid();
  if check_role != 'admin' then
    raise exception 'Unauthorized: Only admins can update passwords';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;
end;
$$;

-- Function to update user email (only accessible by admins)
create or replace function admin_update_user_email(
  target_user_id uuid,
  new_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  check_role text;
begin
  -- Check if caller is admin
  select role into check_role from public.profiles where id = auth.uid();
  if check_role != 'admin' then
    raise exception 'Unauthorized: Only admins can update emails';
  end if;

  update auth.users
  set email = new_email,
      updated_at = now()
  where id = target_user_id;
  
  -- Profile email update is handled by trigger usually, but let's ensure consistency
  update public.profiles
  set email = new_email
  where id = target_user_id;
end;
$$;
