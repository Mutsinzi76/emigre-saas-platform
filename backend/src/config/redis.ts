import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export const initializeRedis = async () => {
  try {
    await client.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Redis connection failed:', error);
    throw error;
  }
};

export const setCache = async (key: string, value: any, expirationSeconds: number = 3600) => {
  try {
    await client.setEx(key, expirationSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

export const getCache = async (key: string) => {
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const deleteCache = async (key: string) => {
  try {
    await client.del(key);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
};

export default client;
