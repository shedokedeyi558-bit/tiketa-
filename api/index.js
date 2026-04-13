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
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1 && !origin.includes('localhost')) {
      return callback(new Error('CORS policy violation'), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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
  res.status(200).json({ status: 'Server is running', timestamp: new Date().toISOString() });
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
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    status: err.status || 500,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
