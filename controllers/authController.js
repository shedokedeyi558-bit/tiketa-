import { supabase } from '../utils/supabaseClient.js';
import { createOrganizerWallet } from '../services/walletService.js';
import { successResponse, errorResponse, createdResponse } from '../utils/responseFormatter.js';

export const signUpOrganizerOrAdmin = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    // Validate role
    if (!['admin', 'organizer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return errorResponse(res, authError, 'Signup failed', 400);
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          role,
          full_name: fullName,
        },
      ]);

    if (profileError) {
      return errorResponse(res, profileError, 'Failed to create user profile', 400);
    }

    // 🔑 Auto-create wallet for organizers
    if (role === 'organizer') {
      console.log(`⏳ Creating wallet for new organizer: ${authData.user.id}`);
      const walletResult = await createOrganizerWallet(authData.user.id);
      
      if (!walletResult.success) {
        console.error('⚠️ Failed to create organizer wallet:', walletResult.error);
        // Don't fail signup if wallet creation fails - it can be created later
      } else {
        console.log(`✅ Wallet created for organizer: ${authData.user.id}`);
      }
    }

    return createdResponse(res, {
      user: authData.user,
    }, 'Signup successful');
  } catch (error) {
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
