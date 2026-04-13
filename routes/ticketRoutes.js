import express from 'express';
import {
  createTicket,
  getTicketByReference,
  updateTicketPaymentStatus,
} from '../controllers/ticketController.js';

const router = express.Router();

// Anonymous ticket purchase (no auth required)
router.post('/create', createTicket);
router.get('/:reference', getTicketByReference);
router.put('/payment-status', updateTicketPaymentStatus);

export default router;
