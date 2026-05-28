import { Router } from 'express';
import { createShipment, getShipmentByTracking, getOrderShipment, updateShipmentStatus } from '../controllers/shipmentController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.post('/', verifyToken, createShipment);
router.get('/tracking/:trackingNumber', getShipmentByTracking);
router.get('/order/:orderId', verifyToken, getOrderShipment);
router.put('/:id/status', verifyToken, updateShipmentStatus);

export default router;
