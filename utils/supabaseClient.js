import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
// Use service role key for backend operations (bypasses RLS)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isAdmin = async (userId) => {
  try {
    if (!userId) return false;
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) return false;
    return data?.role === 'admin';
  } catch (error) {
    return false;
  }
};

export const getCurrentUser = async (authHeader) => {
  try {
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return null;
    return data?.user;
  } catch (error) {
    return null;
  }
};
