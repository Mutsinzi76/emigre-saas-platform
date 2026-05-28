import { Request, Response } from 'express';
import { query } from '../config/database';
import { setCache, getCache, deleteCache } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category, serviceType, page = 1, limit = 20, search } = req.query;
    const offset = ((Number(page) - 1) * Number(limit));
    const cacheKey = `products:${category}:${serviceType}:${page}:${search}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, source: 'cache' });
    }

    let sql = 'SELECT * FROM products WHERE is_available = true';
    const params: any[] = [];

    if (category) {
      params.push(String(category));
      sql += ` AND category = $${params.length}`;
    }

    if (serviceType) {
      params.push(String(serviceType));
      sql += ` AND service_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(sql, params);

    await setCache(cacheKey, result.rows, 3600);

    res.json({
      success: true,
      data: {
        products: result.rows,
        page: Number(page),
        limit: Number(limit),
        total: result.rows.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cacheKey = `product:${id}`;

    const cachedProduct = await getCache(cacheKey);
    if (cachedProduct) {
      return res.json({ success: true, data: cachedProduct, source: 'cache' });
    }

    const result = await query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    await setCache(cacheKey, result.rows[0], 3600);

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const sellerId = (req as any).user?.userId;
    const { name, description, category, serviceType, price, stockQuantity, sku, imageUrl } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price required' });
    }

    const productId = uuidv4();
    const result = await query(
      `INSERT INTO products (id, seller_id, name, description, category, service_type, price, stock_quantity, sku, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [productId, sellerId, name, description, category, serviceType, price, stockQuantity, sku, imageUrl]
    );

    await deleteCache(`products:*`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price, stockQuantity, imageUrl } = req.body;

    const result = await query(
      `UPDATE products SET name = COALESCE($1, name), description = COALESCE($2, description), 
       price = COALESCE($3, price), stock_quantity = COALESCE($4, stock_quantity),
       image_url = COALESCE($5, image_url), updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, description, price, stockQuantity, imageUrl, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await deleteCache(`product:${id}`);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await deleteCache(`product:${id}`);

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
