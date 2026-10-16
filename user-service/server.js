require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const MONGO_URI = process.env.MONGO_URI;

app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true }
});

const User = mongoose.model('User', userSchema);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const user = await User.create({ name, email });
    return res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create user:', error);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

app.get('/users/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return res.status(500).json({ error: 'Failed to fetch user.' });
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

  await mongoose.connect(MONGO_URI);
  console.log('User DB Connected Successfully');
  app.listen(PORT, () => console.log(`User Service running on port ${PORT}`));
}

start().catch((error) => {
  console.error('Unable to start User Service:', error.message);
  process.exitCode = 1;
});
