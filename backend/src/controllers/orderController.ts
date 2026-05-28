import { Request, Response } from 'express';
import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.userId;
    const { items, deliveryAddress, deliveryCountry, shippingMethod, sellerId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain items' });
    }

    let totalAmount = 0;
    let productDetails = [];

    for (const item of items) {
      const result = await query('SELECT price FROM products WHERE id = $1', [item.productId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }
      const productPrice = result.rows[0].price;
      const itemTotal = productPrice * item.quantity;
      totalAmount += itemTotal;
      productDetails.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: productPrice
      });
    }

    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    const orderResult = await query(
      `INSERT INTO orders (id, order_number, customer_id, seller_id, total_amount, currency, delivery_address, delivery_country, shipping_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orderId, orderNumber, customerId, sellerId || customerId, totalAmount, 'USD', deliveryAddress, deliveryCountry, shippingMethod]
    );

    for (const detail of productDetails) {
      await query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, detail.productId, detail.quantity, detail.unitPrice, detail.unitPrice * detail.quantity]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: orderResult.rows[0],
        items: productDetails,
        totalAmount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const { page = 1, limit = 20, status } = req.query;
    const offset = ((Number(page) - 1) * Number(limit));

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (userRole !== 'admin') {
      sql += ' AND (customer_id = $1 OR seller_id = $1)';
      params.push(userId);
    }

    if (status) {
      params.push(String(status));
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: {
        orders: result.rows,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const orderResult = await query(
      `SELECT o.*, json_agg(json_build_object('productId', oi.product_id, 'quantity', oi.quantity, 'unitPrice', oi.unit_price)) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, data: orderResult.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
