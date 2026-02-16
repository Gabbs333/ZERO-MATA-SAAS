-- Diagnostic Script: Check Serveuse Profile
-- Returns the profile details for 'serveuse@snackbar.cm' (if email is not in profiles, we search by role)

-- 1. Check if we can find the profile by some metadata or just list serveuses
SELECT * FROM public.profiles WHERE role = 'serveuse';

-- 2. List establishments to pick one if needed
SELECT * FROM public.etablissements;
