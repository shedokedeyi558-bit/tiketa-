import { supabase, isAdmin } from '../utils/supabaseClient.js';

export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Admin Auth Check:', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) + '...',
      timestamp: new Date().toISOString(),
    });
    
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('❌ Token verification error:', {
        message: error.message,
        code: error.code,
        status: error.status,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: error.message,
      });
    }

    if (!data.user) {
      console.error('❌ No user data returned from token verification');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    console.log('✅ Token verified for user:', {
      userId: data.user.id,
      email: data.user.email,
    });

    // Check if user is admin
    const userIsAdmin = await isAdmin(data.user.id);
    
    console.log('🔍 Admin check result:', {
      userId: data.user.id,
      isAdmin: userIsAdmin,
    });
    
    if (!userIsAdmin) {
      console.warn('❌ User is not admin:', data.user.id);
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin privileges required',
      });
    }

    console.log('✅ Admin access granted for user:', data.user.id);

    // Attach user to request
    req.user = data.user;
    next();
  } catch (error) {
    console.error('❌ Admin auth error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};
