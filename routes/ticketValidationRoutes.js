import express from 'express';
import { adminAuth } from '../middlewares/adminMiddleware.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  validateTicketAtEvent,
  getTicket,
  getEventTickets,
  getTicketStats,
} from '../controllers/ticketValidationController.js';

const router = express.Router();

// Public routes
router.get('/:ticketNumber', getTicket);

// Protected routes (organizer/admin)
router.post('/validate', verifyToken, validateTicketAtEvent);
router.get('/event/:eventId', verifyToken, getEventTickets);
router.get('/event/:eventId/stats', verifyToken, getTicketStats);

export default router;
