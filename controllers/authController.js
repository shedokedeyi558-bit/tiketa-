import { supabase } from '../utils/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';
import { createOrganizerWallet } from '../services/walletService.js';
import { successResponse, errorResponse, createdResponse } from '../utils/responseFormatter.js';

// ✅ Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const signUpOrganizerOrAdmin = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    // ✅ Validate role
    if (!['admin', 'organizer'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role',
        message: 'Role must be either "admin" or "organizer"'
      });
    }

    // ✅ Validate fullName is provided and not empty
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid name',
        message: 'Full name is required and cannot be empty'
      });
    }

    console.log('📝 Starting signup for:', { email, role, fullName });

    // ✅ Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        }
      }
    });

    if (authError) {
      console.error('❌ Auth signup failed:', authError);
      return errorResponse(res, authError, 'Signup failed', 400);
    }

    console.log('✅ Auth user created:', authData.user.id);

    // ✅ CRITICAL: Write to profiles table using service role
    console.log('📝 Creating profile record...');
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        name: fullName || '',
        role,
      }, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile creation failed:', {
        error: profileError.message,
        code: profileError.code,
      });
      return errorResponse(res, profileError, 'Failed to create profile', 400);
    }

    console.log('✅ Profile record created:', profileData.id);

    // ✅ CRITICAL: Also write to users table using service role
    // This ensures all backend queries that use the users table will find the data
    console.log('📝 Creating user record...');
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        email,
        full_name: fullName || '',
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (userError) {
      console.error('❌ User record creation failed:', {
        error: userError.message,
        code: userError.code,
      });
      return errorResponse(res, userError, 'Failed to create user record', 400);
    }

    console.log('✅ User record created:', userProfile.id);

    // ✅ Auto-create wallet for organizers
    if (role === 'organizer') {
      console.log(`⏳ Creating wallet for new organizer: ${authData.user.id}`);
      
      try {
        const walletResult = await createOrganizerWallet(authData.user.id);
        
        if (!walletResult.success) {
          console.error('⚠️ Failed to create organizer wallet:', walletResult.error);
          // Don't fail signup if wallet creation fails - it can be created later
        } else {
          console.log(`✅ Wallet created for organizer: ${authData.user.id}`);
        }
      } catch (walletError) {
        console.error('⚠️ Wallet creation error:', walletError);
        // Don't fail signup if wallet creation fails
      }
    }

    console.log('✅ Signup completed successfully');

    return createdResponse(res, {
      user: authData.user,
      role: role,
    }, 'Signup successful');
  } catch (error) {
    console.error('❌ Signup error:', error);
    return errorResponse(res, error, 'Signup failed', 500);
  }
};

export const loginOrganizerOrAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return errorResponse(res, error, 'Login failed', 400);
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    return successResponse(res, {
      user: data.user,
      role: userData?.role,
      session: data.session,
    }, 'Login successful');
  } catch (error) {
    return errorResponse(res, error, 'Login failed', 500);
  }
};
