// src/routes/auth.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, plan = 'FREE' } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required'
    });
  }

  try {
    // Prüfe ob User existiert
    const existingUser = await req.db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User already exists'
      });
    }

    // Generiere API Key und Hash das Passwort
    const apiKey = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Erstelle User
    await req.db.run(`
            INSERT INTO users (
                id, email, password_hash, api_key, plan, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
      userId,
      email,
      passwordHash,
      apiKey,
      plan,
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    res.status(201).json({
      message: 'Registration successful',
      email,
      api_key: apiKey
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required'
    });
  }

  try {
    const user = await req.db.get('SELECT * FROM users WHERE email = ?', [email]);
        
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    res.json({
      message: 'Login successful',
      email: user.email,
      api_key: user.api_key
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
});

module.exports = router;
