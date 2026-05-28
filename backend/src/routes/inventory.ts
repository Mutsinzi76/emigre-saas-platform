import { Router } from 'express';
import { getInventory, updateInventory, getLowStockProducts } from '../controllers/inventoryController';
import { verifyToken, verifyAdmin } from '../middleware/auth';

const router = Router();

router.get('/:productId', getInventory);
router.put('/:productId', verifyToken, updateInventory);
router.get('/low-stock', verifyAdmin, getLowStockProducts);

export default router;
