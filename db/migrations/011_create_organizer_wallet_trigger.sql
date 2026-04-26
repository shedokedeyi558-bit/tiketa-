-- ✅ Create trigger to automatically create wallet when user role is set to 'organizer'
-- This ensures every organizer has a wallet for earnings tracking

-- Create function to handle organizer wallet creation
CREATE OR REPLACE FUNCTION public.handle_organizer_wallet_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is changed to 'organizer', create wallet if it doesn't exist
  IF NEW.role = 'organizer' AND (OLD.role IS NULL OR OLD.role != 'organizer') THEN
    INSERT INTO public.wallets (organizer_id, available_balance, pending_balance, total_earned, total_withdrawn, created_at, updated_at)
    VALUES (
      NEW.id,
      0.00,
      0.00,
      0.00,
      0.00,
      NOW(),
      NOW()
    )
    ON CONFLICT (organizer_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on users table for role changes
DROP TRIGGER IF EXISTS on_user_role_changed ON users;
CREATE TRIGGER on_user_role_changed
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.handle_organizer_wallet_creation();

-- ✅ Create function to ensure wallet exists for organizers
-- This is called during signup to create wallet immediately
CREATE OR REPLACE FUNCTION public.ensure_organizer_wallet(organizer_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  wallet_exists BOOLEAN;
BEGIN
  -- Check if wallet exists
  SELECT EXISTS(SELECT 1 FROM wallets WHERE organizer_id = $1) INTO wallet_exists;
  
  -- If wallet doesn't exist, create it
  IF NOT wallet_exists THEN
    INSERT INTO wallets (organizer_id, available_balance, pending_balance, total_earned, total_withdrawn, created_at, updated_at)
    VALUES (
      organizer_id,
      0.00,
      0.00,
      0.00,
      0.00,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail
  RAISE WARNING 'Failed to ensure wallet for organizer %: %', organizer_id, SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_organizer_wallet_creation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_organizer_wallet(UUID) TO authenticated;
