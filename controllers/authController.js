import { supabase } from '../utils/supabaseClient.js';
import { createOrganizerWallet } from '../services/walletService.js';

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
      return res.status(400).json({ error: authError.message });
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
      return res.status(400).json({ error: profileError.message });
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

    res.json({
      success: true,
      message: 'Signup successful',
      user: authData.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      return res.status(400).json({ error: error.message });
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      user: data.user,
      role: userData?.role,
      session: data.session,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
