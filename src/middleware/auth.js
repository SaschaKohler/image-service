// src/middleware/auth.js
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
        
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.log('Missing or invalid auth header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authentication'
      });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, apiKey] = credentials.split(':');

    console.log('Auth attempt:', { email }); // Log for debugging

    if (!email || !apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credential format'
      });
    }

    // Verify credentials against database
    const user = await req.db.get(
      'SELECT * FROM users WHERE email = ? AND api_key = ?',
      [email, apiKey]
    );

    if (!user) {
      console.log('User not found or invalid API key');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

module.exports = authMiddleware;
