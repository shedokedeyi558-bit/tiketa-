import { supabase } from '../utils/supabaseClient.js';

/**
 * Log audit event
 * CRITICAL: All financial transactions must be logged
 */
export const logAudit = async (auditData) => {
  try {
    const {
      action,
      entity_type,
      entity_id,
      user_id,
      changes,
      ip_address,
      user_agent,
    } = auditData;

    const { error } = await supabase
      .from('audit_logs')
      .insert([
        {
          action,
          entity_type,
          entity_id,
          user_id,
          changes: changes || {},
          ip_address,
          user_agent,
        },
      ]);

    if (error) {
      console.error('Audit logging error:', error);
      // Don't throw - audit logging should not block operations
    }
  } catch (error) {
    console.error('Audit service error:', error);
    // Don't throw - audit logging should not block operations
  }
};

/**
 * Get audit logs for entity
 */
export const getAuditLogs = async (entityType, entityId) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get audit logs error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Audit retrieval error:', error);
    return [];
  }
};

/**
 * Get audit logs for user
 */
export const getUserAuditLogs = async (userId, limit = 100) => {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get user audit logs error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('User audit retrieval error:', error);
    return [];
  }
};

/**
 * Detect suspicious activity
 */
export const detectSuspiciousActivity = async (criteria) => {
  try {
    const {
      action,
      entity_type,
      ip_address,
      user_id,
      timeWindow = 3600000, // 1 hour
    } = criteria;

    const timeAgo = new Date(Date.now() - timeWindow).toISOString();

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', action)
      .eq('entity_type', entity_type)
      .eq('ip_address', ip_address)
      .gte('created_at', timeAgo);

    if (error) {
      console.error('Suspicious activity detection error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Activity detection error:', error);
    return [];
  }
};
