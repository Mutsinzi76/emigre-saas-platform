import { Request, Response } from 'express';
import { query } from '../config/database';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, currency = 'USD' } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ error: 'Order ID and amount required' });
    }

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: {
        orderId,
        userId: (req as any).user?.userId
      }
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { orderId, paymentIntentId, paymentMethod = 'stripe' } = req.body;

    if (!orderId || !paymentIntentId) {
      return res.status(400).json({ error: 'Order ID and payment intent required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not succeeded' });
    }

    const paymentId = uuidv4();
    await query(
      `INSERT INTO payments (id, order_id, amount, currency, payment_method, stripe_payment_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [paymentId, orderId, paymentIntent.amount / 100, paymentIntent.currency, paymentMethod, paymentIntentId, 'completed']
    );

    await query(
      `UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: { paymentId, orderId }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const result = await query('SELECT * FROM payments WHERE order_id = $1', [orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { orderId, dueDate } = req.body;

    const orderResult = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const invoiceId = uuidv4();
    const invoiceNumber = `INV-${Date.now()}`;
    const order = orderResult.rows[0];

    await query(
      `INSERT INTO invoices (id, invoice_number, order_id, amount, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [invoiceId, invoiceNumber, orderId, order.total_amount, dueDate, 'sent']
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created',
      data: { invoiceId, invoiceNumber }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
