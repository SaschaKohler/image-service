// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const generateImage = require('./imageGenerator');
const authMiddleware = require('./middleware/auth');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Prüfe ob notwendige Umgebungsvariablen gesetzt sind
const requiredEnvVars = ['API_USER', 'API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Error: Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Konfiguration
const CONFIG = {
  DB_PATH: path.join(__dirname, 'templates.db'),
  TEMPLATE_LIMITS: {
    FREE: 1,
    BASIC: 10,
    PRO: 1000,
  },
};

// Datenbankinitialisierung
async function initializeDb() {
  const db = await open({
    filename: CONFIG.DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      version INTEGER,
      html TEXT,
      css TEXT,
      name TEXT,
      description TEXT,
      google_fonts TEXT,
      viewport_width INTEGER,
      viewport_height INTEGER,
      device_scale REAL,
      created_at TEXT,
      updated_at TEXT,
      user_id TEXT,
      plan TEXT DEFAULT 'FREE'
    );
  `);

  return db;
}

let db;

// Template-Limit prüfen
async function checkTemplateLimit(userId, plan) {
  const count = await db.get('SELECT COUNT(*) as count FROM templates WHERE user_id = ?', userId);
  const limit = CONFIG.TEMPLATE_LIMITS[plan];
  return count.count < limit;
}

// Health-Check-Route ohne Auth
app.get('/health', async (_, res) => {
  try {
    if (!db) {
      throw new Error('Database connection not initialized');
    }
    await db.get('SELECT 1');
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Alle /v1 Routen mit Auth schützen
app.use('/v1', authMiddleware);

// Template erstellen
app.post('/v1/template', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'demo-user';
    const userPlan = req.headers['x-user-plan'] || 'FREE';

    // Limit prüfen
    const canCreate = await checkTemplateLimit(userId, userPlan);
    if (!canCreate) {
      return res.status(429).json({
        error: 'Plan limit exceeded',
        statusCode: 429,
        message: `The ${userPlan} plan is limited to ${CONFIG.TEMPLATE_LIMITS[userPlan]} templates`,
      });
    }

    const {
      html,
      css = '',
      name = '',
      description = '',
      google_fonts,
      viewport_width,
      viewport_height,
      device_scale,
    } = req.body;

    if (!html) {
      return res.status(400).json({
        error: 'Bad Request',
        statusCode: 400,
        message: 'HTML is Required',
      });
    }

    const templateId = `t-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const templateVersion = Date.now();

    await db.run(
      `INSERT INTO templates (
        id, version, html, css, name, description, google_fonts,
        viewport_width, viewport_height, device_scale, created_at,
        updated_at, user_id, plan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        templateVersion,
        html,
        css,
        name,
        description,
        google_fonts,
        viewport_width,
        viewport_height,
        device_scale,
        new Date().toISOString(),
        new Date().toISOString(),
        userId,
        userPlan,
      ]
    );

    res.status(201).json({
      template_id: templateId,
      template_version: templateVersion,
    });
  } catch (error) {
    console.error('Template creation failed:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Templates auflisten
app.get('/v1/template', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'demo-user';
    const templates = await db.all(
      'SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC',
      userId
    );

    res.json({
      data: templates,
      pagination: {
        next_page_start: null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// Bild aus Template generieren
app.post('/v1/image/from-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const templateData = req.body;
    
    const template = await db.get('SELECT * FROM templates WHERE id = ?', [templateId]);
    if (!template) {
      return res.status(404).json({
        error: 'Not Found',
        statusCode: 404,
        message: 'Template not found'
      });
    }

    const image = await generateImage({
      html: template.html,
      css: template.css,
      googleFonts: template.google_fonts,
      viewportWidth: template.viewport_width,
      viewportHeight: template.viewport_height,
      deviceScale: template.device_scale,
      templateData
    });

    const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    if (!global.imageStore) global.imageStore = new Map();
    global.imageStore.set(imageId, image);

    res.status(201).json({
      url: `/v1/image/${imageId}`
    });
  } catch (error) {
    console.error('Image generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate image',
      statusCode: 500,
      message: error.message
    });
  }
});

// Bild direkt aus HTML generieren
app.post('/v1/image', async (req, res) => {
  try {
    const {
      html,
      css,
      google_fonts,
      selector,
      ms_delay,
      device_scale,
      render_when_ready,
      full_screen,
      viewport_width,
      viewport_height,
    } = req.body;

    if (!html) {
      return res.status(400).json({
        error: 'Bad Request',
        statusCode: 400,
        message: 'HTML is Required',
      });
    }

    const image = await generateImage({
      html,
      css,
      googleFonts: google_fonts,
      selector,
      msDelay: ms_delay,
      deviceScale: device_scale,
      renderWhenReady: render_when_ready,
      fullScreen: full_screen,
      viewportWidth: viewport_width,
      viewportHeight: viewport_height,
    });

    const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    if (!global.imageStore) global.imageStore = new Map();
    global.imageStore.set(imageId, image);

    res.status(201).json({
      url: `/v1/image/${imageId}`
    });
  } catch (error) {
    console.error('Image generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate image',
      statusCode: 500,
      message: error.message
    });
  }
});

// Bild abrufen
app.get('/v1/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const format = req.query.format || 'png';

    if (!global.imageStore || !global.imageStore.has(imageId)) {
      return res.status(404).json({
        error: 'Not Found',
        statusCode: 404,
        message: 'Image not found'
      });
    }

    const image = global.imageStore.get(imageId);

    const contentTypes = {
      png: 'image/png',
      jpg: 'image/jpeg',
      webp: 'image/webp'
    };
    res.setHeader('Content-Type', contentTypes[format] || contentTypes.png);

    if (req.query.dl === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="image.${format}"`);
    }

    res.send(image);
  } catch (error) {
    console.error('Image retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve image',
      statusCode: 500,
      message: error.message
    });
  }
});

// Bild löschen
app.delete('/v1/image/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    if (!global.imageStore || !global.imageStore.has(imageId)) {
      return res.status(404).json({
        error: 'Not Found',
        statusCode: 404,
        message: 'Image not found'
      });
    }

    global.imageStore.delete(imageId);
    res.status(202).send();
  } catch (error) {
    console.error('Image deletion failed:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      statusCode: 500,
      message: error.message
    });
  }
});

// Server starten
(async () => {
  try {
    db = await initializeDb();
    console.log('Database initialized');

    const PORT = process.env.NODE_ENV === 'test' ? 3001 : 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
    
    // Exportiere den Server für Tests
    if (process.env.NODE_ENV === 'test') {
      global.testServer = server;
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Exportiere die db Variable für Tests
module.exports = {
  app,
  db: () => db,
  setDb: newDb => {
    db = newDb;
  },
};
