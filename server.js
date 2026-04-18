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
console.log('   - SQUADCO_API_KEY:', process.env.SQUADCO_API_KEY?.substring(0, 10) + '...');
console.log('   - SQUADCO_PUBLIC_KEY:', process.env.SQUADCO_PUBLIC_KEY?.substring(0, 10) + '...');
console.log('   - SQUADCO_API_URL:', process.env.SQUADCO_API_URL || 'https://api.squadco.com (default)');
console.log('   - SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 20) + '...');

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/authRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import userRoutes from './routes/userRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import ticketValidationRoutes from './routes/ticketValidationRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import squadPaymentRoutes from './routes/squadPaymentRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

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
app.use(`/api/${process.env.API_VERSION}/users`, userRoutes);
app.use(`/api/${process.env.API_VERSION}/tickets`, ticketRoutes);
app.use(`/api/${process.env.API_VERSION}/tickets/validate`, ticketValidationRoutes);
app.use(`/api/${process.env.API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${process.env.API_VERSION}/payments/squad`, squadPaymentRoutes);
app.use(`/api/${process.env.API_VERSION}/wallet`, walletRoutes);
app.use(`/api/${process.env.API_VERSION}/withdrawals`, withdrawalRoutes);
app.use(`/api/${process.env.API_VERSION}/orders`, orderRoutes);
app.use(`/api/${process.env.API_VERSION}/admin`, adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
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

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ message: 'Route not found' });
    }
  });
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
