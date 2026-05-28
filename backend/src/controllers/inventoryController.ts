import { Request, Response } from 'express';
import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export const getInventory = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const result = await query(
      `SELECT i.*, p.name, p.price FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE i.product_id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateInventory = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantityAdjustment, reason } = req.body;
    const userId = (req as any).user?.userId;

    if (!quantityAdjustment || !reason) {
      return res.status(400).json({ error: 'Quantity adjustment and reason required' });
    }

    const currentResult = await query(
      'SELECT quantity_on_hand FROM inventory WHERE product_id = $1',
      [productId]
    );

    if (currentResult.rows.length === 0) {
      const inventoryId = uuidv4();
      await query(
        `INSERT INTO inventory (id, product_id, quantity_on_hand, quantity_available, updated_by)
         VALUES ($1, $2, $3, $3, $4)`,
        [inventoryId, productId, quantityAdjustment, userId]
      );
    } else {
      const newQuantity = currentResult.rows[0].quantity_on_hand + quantityAdjustment;

      if (newQuantity < 0) {
        return res.status(400).json({ error: 'Insufficient inventory' });
      }

      await query(
        `UPDATE inventory SET quantity_on_hand = $1, quantity_available = $1, updated_by = $2, last_updated = NOW()
         WHERE product_id = $3`,
        [newQuantity, userId, productId]
      );
    }

    res.json({
      success: true,
      message: 'Inventory updated successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getLowStockProducts = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.price, i.quantity_on_hand, i.reorder_level
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE i.quantity_on_hand <= i.reorder_level`,
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
