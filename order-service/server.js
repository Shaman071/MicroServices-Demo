require('dotenv').config();

const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT) || 3002;
const MONGO_URI = process.env.MONGO_URI;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;

app.use(express.json());

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productName: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.post('/orders', async (req, res) => {
  const { userId, productName, price } = req.body;

  if (typeof userId !== 'string' || !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'A valid userId is required.' });
  }
  if (typeof productName !== 'string' || !productName.trim()) {
    return res.status(400).json({ error: 'A productName is required.' });
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number.' });
  }

  try {
    await axios.get(`${USER_SERVICE_URL}/users/${encodeURIComponent(userId)}`, { timeout: 5000 });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(400).json({ error: 'Cannot create order: User does not exist.' });
    }
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return res.status(400).json({ error: 'Cannot create order: User ID is invalid.' });
    }
    console.error('User Service request failed:', error.message);
    return res.status(503).json({ error: 'Failed to communicate with User Service.' });
  }

  try {
    const order = await Order.create({ userId, productName, price });
    return res.status(201).json(order);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create order:', error);
    return res.status(500).json({ error: 'Failed to create order.' });
  }
});

app.get('/orders/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId });
    return res.json(orders);
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }
  return next(error);
});

async function start() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is required. Copy .env.example to .env and configure it.');
  }
  if (!USER_SERVICE_URL) {
    throw new Error('USER_SERVICE_URL is required. Copy .env.example to .env and configure it.');
  }

  await mongoose.connect(MONGO_URI);
  console.log('Order DB Connected Successfully');
  app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
}

start().catch((error) => {
  console.error('Unable to start Order Service:', error.message);
  process.exitCode = 1;
});
