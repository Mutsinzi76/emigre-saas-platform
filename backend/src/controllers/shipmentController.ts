import { Request, Response } from 'express';
import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export const createShipment = async (req: Request, res: Response) => {
  try {
    const { orderId, carrier, estimatedDeliveryDate, originLocation, destinationLocation } = req.body;

    if (!orderId || !carrier) {
      return res.status(400).json({ error: 'Order ID and carrier required' });
    }

    const shipmentId = uuidv4();
    const trackingNumber = `TRK-${Date.now()}`;

    const result = await query(
      `INSERT INTO shipments (id, order_id, tracking_number, carrier, origin_location, destination_location, estimated_delivery_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [shipmentId, orderId, trackingNumber, carrier, originLocation, destinationLocation, estimatedDeliveryDate, 'pending']
    );

    res.status(201).json({
      success: true,
      message: 'Shipment created',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getShipmentByTracking = async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;

    const result = await query(
      `SELECT s.*, o.customer_id FROM shipments s
       JOIN orders o ON s.order_id = o.id
       WHERE s.tracking_number = $1`,
      [trackingNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getOrderShipment = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const result = await query(
      'SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateShipmentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'picked', 'in_transit', 'out_for_delivery', 'delivered', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      `UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json({ success: true, message: 'Shipment updated', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
