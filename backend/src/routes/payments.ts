import { Router } from 'express';
import { createPaymentIntent, confirmPayment, getPaymentStatus, createInvoice } from '../controllers/paymentController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.post('/create-intent', verifyToken, createPaymentIntent);
router.post('/confirm', verifyToken, confirmPayment);
router.get('/:orderId', verifyToken, getPaymentStatus);
router.post('/invoice', verifyToken, createInvoice);

export default router;
