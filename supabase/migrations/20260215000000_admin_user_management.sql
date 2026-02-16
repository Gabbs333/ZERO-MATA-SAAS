-- Enable pgcrypto for password hashing if not already enabled
create extension if not exists "pgcrypto";

-- Function to create a user (only accessible by admins)
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
  v_encrypted_pw text;
begin
  -- Check if caller is admin
  select role into check_role from public.profiles where id = auth.uid();
  if check_role != 'admin' then
    raise exception 'Unauthorized: Only admins can create users';
  end if;

  -- Generate encrypted password
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- Create user in auth.users
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'role', p_role,
      'nom', p_nom,
      'prenom', p_prenom,
      'etablissement_id', p_etablissement_id
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  returning id into new_user_id;

  -- The trigger on auth.users will create the profile in public.profiles
  -- But we need to ensure the profile has the correct etablissement_id
  -- We update it explicitly to be safe
  update public.profiles
  set etablissement_id = p_etablissement_id
  where id = new_user_id;
  
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
