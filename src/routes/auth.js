// src/routes/auth.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, plan = 'FREE' } = req.body;

  // Validiere Email
  if (!email) {
    return res.status(400).json({
      error: 'Validation Error',
      field: 'email',
      message: 'Email address is required',
      details: 'Please provide a valid email address',
    });
  }

  // Validiere Email-Format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: 'Validation Error',
      field: 'email',
      message: 'Invalid email format',
      details: 'Please provide a valid email address format (e.g., user@example.com)',
    });
  }

  // Validiere Passwort
  if (!password) {
    return res.status(400).json({
      error: 'Validation Error',
      field: 'password',
      message: 'Password is required',
      details: 'Please provide a password',
    });
  }

  // Validiere Passwort-Komplexität
  if (password.length < 8) {
    return res.status(400).json({
      error: 'Validation Error',
      field: 'password',
      message: 'Password too short',
      details: 'Password must be at least 8 characters long',
    });
  }

  // Validiere Plan
  const validPlans = ['FREE', 'BASIC', 'PRO'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({
      error: 'Validation Error',
      field: 'plan',
      message: 'Invalid plan selected',
      details: `Plan must be one of: ${validPlans.join(', ')}`,
    });
  }

  try {
    if (!req.db) {
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'Database connection not available',
        details: 'The server is not properly configured. Please contact support.',
      });
    }

    // Prüfe ob User existiert
    const existingUser = await req.db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({
        error: 'Account Error',
        field: 'email',
        message: 'Account already exists',
        details:
          'An account with this email address already exists. Please login or use a different email.',
      });
    }

    // Generiere API Key und Hash das Passwort
    const apiKey = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();

    // Erstelle User
    await req.db.run(
      `
      INSERT INTO users (
        id, email, password_hash, api_key, plan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [userId, email, passwordHash, apiKey, plan, now, now]
    );

    res.status(201).json({
      message: 'Registration successful',
      email,
      api_key: apiKey,
      plan,
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Detaillierte Fehlermeldung basierend auf dem Fehlertyp
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({
        error: 'Database Constraint Error',
        message: 'Could not create account',
        details:
          'There was a conflict with existing data. This might be due to a duplicate email address.',
      });
    }

    if (error.code === 'SQLITE_ERROR') {
      return res.status(500).json({
        error: 'Database Error',
        message: 'Could not create account',
        details: 'There was an error accessing the database. Please try again later.',
      });
    }

    res.status(500).json({
      error: 'Server Error',
      message: 'Registration failed',
      details: 'An unexpected error occurred during registration. Please try again later.',
      errorId: `ERR_${Date.now()}`,
    });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required',
    });
  }

  try {
    const user = await req.db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    res.json({
      message: 'Login successful',
      email: user.email,
      api_key: user.api_key,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
    });
  }
});

module.exports = router;
