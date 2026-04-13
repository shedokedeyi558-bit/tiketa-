import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
} from '../controllers/userController.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes (TODO: Add authentication middleware)
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

export default router;
