import express from 'express';
import { signUpOrganizerOrAdmin, loginOrganizerOrAdmin } from '../controllers/authController.js';

const router = express.Router();

router.post('/signup', signUpOrganizerOrAdmin);
router.post('/login', loginOrganizerOrAdmin);

export default router;
