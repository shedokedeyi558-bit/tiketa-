import { supabase } from '../utils/supabaseClient.js';
import { createClient } from '@supabase/supabase-js';

// ✅ Create admin client with service role key for settings operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ✅ GET /api/v1/admin/settings
 * Fetch current platform settings
 * Public read access (settings are not sensitive)
 */
export const getPlatformSettings = async (req, res) => {
  try {
    console.log('📋 Fetching platform settings');

    // ✅ Fetch settings from database
    const { data: settings, error } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('❌ Error fetching settings:', error);
      
      // If table doesn't exist, return defaults
      if (error.code === 'PGRST116') {
        console.warn('⚠️ Settings table not found, returning defaults');
        return res.status(200).json({
          success: true,
          data: {
            id: 1,
            platform_name: 'Ticketa',
            support_email: 'support@ticketa.com',
            platform_fee: 3,
            minimum_withdrawal: 10000,
            updated_at: new Date().toISOString(),
          },
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch settings',
        error: error.message,
      });
    }

    if (!settings) {
      console.warn('⚠️ No settings found, returning defaults');
      return res.status(200).json({
        success: true,
        data: {
          id: 1,
          platform_name: 'Ticketa',
          support_email: 'support@ticketa.com',
          platform_fee: 3,
          minimum_withdrawal: 10000,
          updated_at: new Date().toISOString(),
        },
      });
    }

    console.log('✅ Settings fetched:', {
      platform_name: settings.platform_name,
      support_email: settings.support_email,
      platform_fee: settings.platform_fee,
      minimum_withdrawal: settings.minimum_withdrawal,
    });

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('❌ Error in getPlatformSettings:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ✅ PUT /api/v1/admin/settings
 * Update platform settings (admin only)
 * Uses service role key to bypass RLS
 */
export const updatePlatformSettings = async (req, res) => {
  try {
    const { platform_name, support_email, platform_fee, minimum_withdrawal } = req.body;

    console.log('📝 Updating platform settings:', {
      platform_name,
      support_email,
      platform_fee,
      minimum_withdrawal,
    });

    // ✅ Validate required fields
    if (!platform_name || !support_email || platform_fee === undefined || minimum_withdrawal === undefined) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: platform_name, support_email, platform_fee, minimum_withdrawal',
      });
    }

    // ✅ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(support_email)) {
      console.error('❌ Invalid email format:', support_email);
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // ✅ Validate numeric fields
    if (isNaN(platform_fee) || isNaN(minimum_withdrawal)) {
      console.error('❌ Invalid numeric values');
      return res.status(400).json({
        success: false,
        message: 'platform_fee and minimum_withdrawal must be numbers',
      });
    }

    if (platform_fee < 0 || minimum_withdrawal < 0) {
      console.error('❌ Negative values not allowed');
      return res.status(400).json({
        success: false,
        message: 'platform_fee and minimum_withdrawal must be positive',
      });
    }

    // ✅ Update settings using service role key
    const { data: updated, error } = await supabaseAdmin
      .from('platform_settings')
      .update({
        platform_name,
        support_email,
        platform_fee: Number(platform_fee),
        minimum_withdrawal: Number(minimum_withdrawal),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update settings',
        error: error.message,
      });
    }

    console.log('✅ Settings updated successfully:', {
      platform_name: updated.platform_name,
      support_email: updated.support_email,
      platform_fee: updated.platform_fee,
      minimum_withdrawal: updated.minimum_withdrawal,
      updated_at: updated.updated_at,
    });

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('❌ Error in updatePlatformSettings:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
