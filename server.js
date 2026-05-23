import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Verify critical environment variables
const requiredEnvVars = ['SQUADCO_API_KEY', 'SQUADCO_PUBLIC_KEY', 'SUPABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL: Missing environment variables:', missingEnvVars);
  console.error('Please check your backend/.env file');
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log('   - SQUADCO_API_KEY:', process.env.SQUADCO_API_KEY?.substring(0, 20) + '...');
console.log('   - SQUADCO_PUBLIC_KEY:', process.env.SQUADCO_PUBLIC_KEY?.substring(0, 10) + '...');
console.log('   - SQUADCO_API_URL:', process.env.SQUADCO_API_URL || 'https://api.squadco.com (default)');
console.log('   - SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 20) + '...');

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import organizerRoutes from './routes/organizerRoutes.js';
import userRoutes from './routes/userRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import ticketValidationRoutes from './routes/ticketValidationRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import squadPaymentRoutes from './routes/squadPaymentRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { updateExpiredEvents } from './services/eventExpiryService.js';
import { adminAuth } from './middlewares/adminMiddleware.js';
import { createClient } from '@supabase/supabase-js';

// Create admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize express app
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://ticketa-topaz.vercel.app',
  'https://tiketa-alpha.vercel.app'
];

console.log('🔐 CORS Configuration:');
console.log('   Allowed Origins:', allowedOrigins);

// CORS middleware with detailed logging
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ CORS: No origin (mobile/curl)');
      return callback(null, true);
    }

    // Log incoming origin
    console.log(`🔍 CORS: Incoming origin: ${origin}`);

    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Exact match
      if (allowedOrigin === origin) return true;
      // Wildcard match for localhost
      if (allowedOrigin.includes('localhost') && origin.includes('localhost')) return true;
      return false;
    }) || /\.vercel\.app$/.test(origin); // Allow all Vercel deployments

    if (isAllowed) {
      console.log(`✅ CORS: Origin allowed: ${origin}`);
      return callback(null, true);
    } else {
      console.warn(`❌ CORS: Origin rejected: ${origin}`);
      return callback(new Error('CORS policy violation'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Body parser middleware - MUST be before routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Debug middleware - log all incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  console.log(`   Origin: ${req.headers.origin || 'none'}`);
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'none'}`);
  next();
});

// API Routes
app.use(`/api/${process.env.API_VERSION}/auth`, authRoutes);
app.use(`/api/${process.env.API_VERSION}/events`, eventRoutes);
app.use(`/api/${process.env.API_VERSION}/organizer`, organizerRoutes);
app.use(`/api/${process.env.API_VERSION}/users`, userRoutes);
app.use(`/api/${process.env.API_VERSION}/tickets`, ticketRoutes);
app.use(`/api/${process.env.API_VERSION}/tickets/validate`, ticketValidationRoutes);
app.use(`/api/${process.env.API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${process.env.API_VERSION}/payments/squad`, squadPaymentRoutes);
app.use(`/api/${process.env.API_VERSION}/wallet`, walletRoutes);
app.use(`/api/${process.env.API_VERSION}/withdrawals`, withdrawalRoutes);
app.use(`/api/${process.env.API_VERSION}/orders`, orderRoutes);
app.use(`/api/${process.env.API_VERSION}/admin`, adminRoutes);

// ✅ Admin Activity Feed Endpoint
app.get('/api/admin/activity', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Fetch recent events (submissions, approvals, rejections, cancellations)
    const { data: recentEvents } = await supabaseAdmin
      .from('events')
      .select('id, title, status, created_at, updated_at, organizer_id')
      .order('updated_at', { ascending: false })
      .limit(10);

    // Fetch recent organizer signups
    const { data: recentProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('role', 'organizer')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent transactions
    const { data: recentTransactions } = await supabaseAdmin
      .from('transactions')
      .select('id, created_at, total_amount, ticket_price, event_id, organizer_id, status')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent withdrawals
    const { data: recentWithdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('id, created_at, amount, status, organizer_id')
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch event titles for transactions
    const eventIds = [...new Set((recentTransactions || []).map(t => t.event_id))];
    let eventTitles = {};
    if (eventIds.length > 0) {
      const { data: eventData } = await supabaseAdmin
        .from('events')
        .select('id, title')
        .in('id', eventIds);
      (eventData || []).forEach(e => { eventTitles[e.id] = e.title; });
    }

    // Fetch organizer names for withdrawals
    const withdrawalOrgIds = [...new Set((recentWithdrawals || []).map(w => w.organizer_id))];
    let orgNames = {};
    if (withdrawalOrgIds.length > 0) {
      const { data: orgData } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', withdrawalOrgIds);
      (orgData || []).forEach(o => { orgNames[o.id] = o.full_name; });
    }

    // Build unified activity list
    const activities = [];

    // Event activities
    (recentEvents || []).forEach(event => {
      const statusMap = {
        pending: { label: 'submitted event for review', icon: '🎟️', time: event.created_at },
        active: { label: 'event was approved', icon: '✅', time: event.updated_at },
        rejected: { label: 'event was rejected', icon: '❌', time: event.updated_at },
        cancelled: { label: 'event expired without review', icon: '⏰', time: event.updated_at },
        ended: { label: 'event ended', icon: '🏁', time: event.updated_at },
      };
      const mapped = statusMap[event.status];
      if (mapped) {
        activities.push({
          id: `event-${event.id}-${event.status}`,
          type: 'event',
          icon: mapped.icon,
          message: `*${event.title}* ${mapped.label}`,
          timestamp: mapped.time,
          link: `/admin/events/${event.id}`,
        });
      }
    });

    // Organizer signup activities
    (recentProfiles || []).forEach(profile => {
      activities.push({
        id: `profile-${profile.id}`,
        type: 'signup',
        icon: '👤',
        message: `*${profile.full_name || profile.email}* joined as organizer`,
        timestamp: profile.created_at,
        link: `/admin/organizers`,
      });
    });

    // Transaction activities
    (recentTransactions || []).forEach(transaction => {
      const eventTitle = eventTitles[transaction.event_id] || 'an event';
      activities.push({
        id: `transaction-${transaction.id}`,
        type: 'transaction',
        icon: '💰',
        message: `Ticket sold for *${eventTitle}* — ₦${parseFloat(transaction.total_amount).toLocaleString('en-NG')}`,
        timestamp: transaction.created_at,
        link: `/admin/sales`,
      });
    });

    // Withdrawal activities
    (recentWithdrawals || []).forEach(withdrawal => {
      const orgName = orgNames[withdrawal.organizer_id] || 'An organizer';
      const statusLabel = withdrawal.status === 'pending' ? 'requested a withdrawal' : `withdrawal ${withdrawal.status}`;
      activities.push({
        id: `withdrawal-${withdrawal.id}`,
        type: 'withdrawal',
        icon: '💳',
        message: `*${orgName}* ${statusLabel} — ₦${parseFloat(withdrawal.amount).toLocaleString('en-NG')}`,
        timestamp: withdrawal.created_at,
        link: `/admin/payouts`,
      });
    });

    // Sort by timestamp descending and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limited = activities.slice(0, limit);

    res.json({ activities: limited, total: activities.length });
  } catch (err) {
    console.error('Activity feed error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DEBUG: Log all registered routes
console.log('🔍 REGISTERED ROUTES:');
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(`   ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
  } else if (r.name === 'router') {
    const basePath = r.regexp.source.replace(/\\\//g, '/').replace(/\$.*/, '').replace(/^\^/, '');
    console.log(`   ROUTER: ${basePath}`);
    if (r.handle && r.handle.stack) {
      r.handle.stack.forEach(function(nestedRoute){
        if (nestedRoute.route){
          const method = nestedRoute.route.stack[0].method.toUpperCase();
          const path = nestedRoute.route.path;
          console.log(`     ${method} ${basePath}${path}`);
        }
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

// ✅ Event expiry check endpoint - manually trigger expiry check
app.get('/api/expire-check', async (req, res) => {
  try {
    console.log('🔍 Manual expiry check triggered');
    
    const result = await updateExpiredEvents();
    
    if (result.success) {
      console.log(`✅ Expiry check completed: ${result.expired} events expired`);
      return res.status(200).json({
        success: true,
        message: `Expiry check completed: ${result.expired} events cancelled`,
        expired: result.expired,
      });
    } else {
      console.error('❌ Expiry check failed:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Expiry check failed',
        error: result.error,
      });
    }
  } catch (err) {
    console.error('❌ Error in expire-check endpoint:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Debug endpoint - check environment variables (development only)
app.get('/debug/env', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  res.json({
    status: 'Environment variables loaded',
    squadco: {
      api_key_loaded: !!process.env.SQUADCO_API_KEY,
      api_key_prefix: process.env.SQUADCO_API_KEY?.substring(0, 10) + '...',
      public_key_loaded: !!process.env.SQUADCO_PUBLIC_KEY,
      public_key_prefix: process.env.SQUADCO_PUBLIC_KEY?.substring(0, 10) + '...',
      api_url: process.env.SQUADCO_API_URL,
    },
    supabase: {
      url_loaded: !!process.env.SUPABASE_URL,
      url_prefix: process.env.SUPABASE_URL?.substring(0, 20) + '...',
    },
    cors: {
      origin: process.env.CORS_ORIGIN,
    },
  });
});

// Debug: Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Catch-all 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    status: err.status || 500,
  });
});

// Start server
const PORT = process.env.PORT || 5001; // Changed default to 5001 to match user config
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api/v1`);
});

// Global error handlers to catch the "crash"
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  // process.exit(1); // Don't exit immediately so we can see the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

export default app;
