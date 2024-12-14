// src/middleware/auth.js
const basicAuth = require('express-basic-auth');

const authMiddleware = basicAuth({
  authorizer: (username, password) => {
    const userMatches = basicAuth.safeCompare(username, process.env.API_USER);
    const passwordMatches = basicAuth.safeCompare(password, process.env.API_KEY);
    return userMatches && passwordMatches;
  },
  challenge: true,
  realm: 'Image Service API',
  unauthorizedResponse: {
    error: 'Unauthorized',
    statusCode: 401,
    message: 'Invalid API credentials'
  }
});

module.exports = authMiddleware;
