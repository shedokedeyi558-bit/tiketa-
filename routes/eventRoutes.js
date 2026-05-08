import express from 'express';
import {
  getOrganizerEvents,
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  deleteOrganizerEvent,
  getEventStats,
} from '../controllers/eventController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protected routes (must come BEFORE generic /:id route)
router.get('/organizer', verifyToken, getOrganizerEvents);
router.get('/:id/stats', verifyToken, getEventStats);
router.delete('/organizer/:id', verifyToken, deleteOrganizerEvent); // ✅ Delete organizer event

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEventById);

// Other routes
router.post('/', createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

export default router;
