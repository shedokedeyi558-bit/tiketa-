-- ✅ Improve auth user trigger to handle role and name from metadata
-- This ensures every authenticated user is stored in users table with correct role

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function to handle new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $
DECLARE
  user_role VARCHAR(50);
  user_name VARCHAR(255);
  name_prefix VARCHAR(50);
BEGIN
  -- Extract role from metadata, default to 'organizer' if not provided
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'organizer');
  
  -- Extract full_name from metadata
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  -- If name is empty, use email prefix as fallback
  IF user_name = '' OR user_name IS NULL THEN
    name_prefix := SPLIT_PART(NEW.email, '@', 1);
    user_name := name_prefix;
  END IF;
  
  -- Validate role is one of the allowed values
  IF user_role NOT IN ('admin', 'organizer', 'user') THEN
    user_role := 'organizer';
  END IF;
  
  -- Insert new user record
  INSERT INTO public.users (id, email, role, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_role,
    user_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  
  RAISE NOTICE 'User created: id=%, email=%, role=%, name=%', NEW.id, NEW.email, user_role, user_name;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ✅ Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ✅ Verify existing users
DO $$
DECLARE
  missing_count INT;
  null_name_count INT;
BEGIN
  -- Count users in auth.users but not in public.users
  SELECT COUNT(*) INTO missing_count FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);
  
  -- Count organizers with null or empty names
  SELECT COUNT(*) INTO null_name_count FROM public.users
  WHERE role = 'organizer' AND (full_name IS NULL OR full_name = '');
  
  RAISE NOTICE 'Auth users missing from public.users: %', missing_count;
  RAISE NOTICE 'Organizers with null/empty names: %', null_name_count;
END $$;
