import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

// Verify critical environment variables
const requiredEnvVars = ['SQUADCO_API_KEY', 'SQUADCO_PUBLIC_KEY', 'SUPABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ CRITICAL: Missing environment variables:', missingEnvVars);
}

// Import routes
import authRoutes from '../routes/authRoutes.js';
import eventRoutes from '../routes/eventRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import ticketRoutes from '../routes/ticketRoutes.js';
import ticketValidationRoutes from '../routes/ticketValidationRoutes.js';
import paymentRoutes from '../routes/paymentRoutes.js';
import squadPaymentRoutes from '../routes/squadPaymentRoutes.js';
import walletRoutes from '../routes/walletRoutes.js';
import withdrawalRoutes from '../routes/withdrawalRoutes.js';
import orderRoutes from '../routes/orderRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';

// Initialize express app
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://ticketa-topaz.vercel.app',
  'https://tiketa-alpha.vercel.app'
];

console.log('🔐 CORS Configuration (Vercel):');
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
const apiVersion = process.env.API_VERSION || 'v1';
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/events`, eventRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/tickets`, ticketRoutes);
app.use(`/api/${apiVersion}/tickets/validate`, ticketValidationRoutes);
app.use(`/api/${apiVersion}/payments`, paymentRoutes);
app.use(`/api/${apiVersion}/payments/squad`, squadPaymentRoutes);
app.use(`/api/${apiVersion}/wallet`, walletRoutes);
app.use(`/api/${apiVersion}/withdrawals`, withdrawalRoutes);
app.use(`/api/${apiVersion}/orders`, orderRoutes);
app.use(`/api/${apiVersion}/admin`, adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Ticketa Backend API',
    version: apiVersion,
    status: 'running'
  });
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
      public_key_loaded: !!process.env.SQUADCO_PUBLIC_KEY,
      api_url: process.env.SQUADCO_API_URL,
    },
    supabase: {
      url_loaded: !!process.env.SUPABASE_URL,
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    status: err.status || 500,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Export for Vercel
export default app;
