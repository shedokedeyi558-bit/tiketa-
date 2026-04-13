import express from 'express';
import {
  createOrder,
  getAllOrders,
  getUserOrders,
  getOrderById,
  cancelOrder,
} from '../controllers/orderController.js';

const router = express.Router();

// Protected routes (TODO: Add authentication middleware)
router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/user', getUserOrders);
router.get('/:id', getOrderById);
router.delete('/:id', cancelOrder);

export default router;
