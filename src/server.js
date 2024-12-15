// src/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const generateImage = require('./imageGenerator');
const authMiddleware = require('./middleware/auth');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const authRoutes = require('./routes/auth');

const app = express();

// Basic Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Konfiguration
const CONFIG = {
  UPLOAD_DIR: path.join(__dirname, '..', 'uploads'),
  DB_PATH: path.join(__dirname, 'templates.db'),
  TEMPLATE_LIMITS: {
    FREE: 1,
    BASIC: 10,
    PRO: 1000,
  },
};

// Stelle sicher dass Upload-Verzeichnis existiert
if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}
// Für statische Dateien
app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));

// Datenbankinitialisierung
let db;

async function initializeDb() {
  const database = await open({
    filename: CONFIG.DB_PATH,
    driver: sqlite3.Database,
  });

  await require('./db/schema').initializeDb(database);
  return database;
}

// Öffentliche Routes
app.get('/test', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

app.get('/health', async (_, res) => {
  try {
    if (!db) {
      throw new Error('Database connection not initialized');
    }
    await db.get('SELECT 1');
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Server starten
(async () => {
  try {
    // 1. Initialisiere DB
    db = await initializeDb();
    console.log('Database initialized');

    // 2. Stelle DB über Middleware zur Verfügung
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // 3. Auth-Routes einbinden (ohne Auth-Middleware)
    app.use('/v1/auth', authRoutes);

    // 4. Auth-Middleware für geschützte Routes
    app.use('/v1', authMiddleware);

    // 5. Geschützte Routes
    // Template-Routes
    // Templates erstellen
    app.post('/v1/template', async (req, res) => {
      try {
        const userPlan = req.user.plan;
        const userId = req.user.id;

        // Limit prüfen
        const count = await db.get(
          'SELECT COUNT(*) as count FROM templates WHERE user_id = ?',
          userId
        );
        if (count.count >= CONFIG.TEMPLATE_LIMITS[userPlan]) {
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
          template_data = {}, // Änderung hier: template_data statt example_data
          example_data = template_data, // Für Abwärtskompatibilität
        } = req.body;

        if (!html) {
          return res.status(400).json({
            error: 'Bad Request',
            statusCode: 400,
            message: 'HTML is Required',
          });
        }

        // Validiere Template-Syntax und Template-Daten
        try {
          const handlebars = require('handlebars');
          const template = handlebars.compile(html);
          // Test mit template_data
          template(template_data);
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            statusCode: 400,
            message: `Invalid template syntax or data: ${error.message}`,
          });
        }

        const templateId = `t-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const templateVersion = Date.now();

        // Template in DB speichern
        await db.run(
          `INSERT INTO templates (
        id, version, html, css, name, description, google_fonts,
        viewport_width, viewport_height, device_scale, created_at,
        updated_at, user_id, plan, example_data, template_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            templateId,
            templateVersion,
            html,
            css,
            name,
            description,
            google_fonts || null,
            viewport_width ? parseInt(viewport_width) : null,
            viewport_height ? parseInt(viewport_height) : null,
            device_scale ? parseFloat(device_scale) : null,
            new Date().toISOString(),
            new Date().toISOString(),
            userId,
            userPlan,
            JSON.stringify(example_data),
            JSON.stringify(template_data), // Speichere template_data separat
          ]
        );

        res.status(201).json({
          template_id: templateId,
          template_version: templateVersion,
          template_data, // Gebe template_data in der Antwort zurück
        });
      } catch (error) {
        console.error('Template creation failed:', error);
        res.status(500).json({ error: 'Failed to create template' });
      }
    });

    // Bild aus Template generieren
    app.post('/v1/image/from-template/:templateId', async (req, res) => {
      try {
        const { templateId } = req.params;
        const templateData = req.body; // Die Variablen für das Template
        const userId = req.user.id;

        const template = await db.get('SELECT * FROM templates WHERE id = ? AND user_id = ?', [
          templateId,
          userId,
        ]);

        if (!template) {
          return res.status(404).json({
            error: 'Not Found',
            statusCode: 404,
            message: 'Template not found',
          });
        }

        // Validiere Template-Daten
        try {
          const compiledTemplate = Handlebars.compile(template.html);
          compiledTemplate(templateData);
        } catch (error) {
          return res.status(400).json({
            error: 'Bad Request',
            statusCode: 400,
            message: `Invalid template data: ${error.message}`,
          });
        }

        const image = await generateImage({
          html: template.html,
          css: template.css,
          googleFonts: template.google_fonts,
          viewportWidth: template.viewport_width,
          viewportHeight: template.viewport_height,
          deviceScale: template.device_scale,
          templateData,
        });

        const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const imagePath = path.join(CONFIG.UPLOAD_DIR, `${imageId}.png`);

        await fsPromises.writeFile(imagePath, image);

        if (!global.imageStore) global.imageStore = new Map();
        global.imageStore.set(imageId, image);

        res.status(201).json({
          url: `/uploads/${imageId}.png`,
          image_id: imageId,
        });
      } catch (error) {
        console.error('Image generation failed:', error);
        res.status(500).json({
          error: 'Failed to generate image',
          statusCode: 500,
          message: error.message,
        });
      }
    });

    // Template-Liste mit Beispieldaten
    app.get('/v1/template', async (req, res) => {
      try {
        const userId = req.user.id;
        const templates = await db.all(
          'SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC',
          userId
        );

        // Parse template_data und example_data für jedes Template
        const templatesWithData = templates.map(template => ({
          ...template,
          template_data: template.template_data ? JSON.parse(template.template_data) : {},
          example_data: template.example_data ? JSON.parse(template.example_data) : {},
        }));

        res.json({
          data: templatesWithData,
          pagination: {
            next_page_start: null,
          },
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to list templates' });
      }
    });

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
          template_data, // Änderung hier: template_data statt templateData
        } = req.body;

        console.log('Received request with template_data:', template_data); // Debug-Log

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
          template_data, // Änderung hier: Übergebe template_data
        });

        const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const imagePath = path.join(CONFIG.UPLOAD_DIR, `${imageId}.png`);

        await fsPromises.writeFile(imagePath, image);

        if (!global.imageStore) global.imageStore = new Map();
        global.imageStore.set(imageId, image);

        res.status(201).json({
          url: `/uploads/${imageId}.png`,
          image_id: imageId,
        });
      } catch (error) {
        console.error('Image generation failed:', error);
        res.status(500).json({
          error: 'Failed to generate image',
          statusCode: 500,
          message: error.message,
        });
      }
    });

    app.get('/v1/image/:imageId', async (req, res) => {
      try {
        const { imageId } = req.params;
        const format = req.query.format || 'png';

        let image = global.imageStore?.get(imageId);

        if (!image) {
          const imagePath = path.join(CONFIG.UPLOAD_DIR, `${imageId}.png`);
          try {
            image = await fsPromises.readFile(imagePath);
            if (!global.imageStore) global.imageStore = new Map();
            global.imageStore.set(imageId, image);
          } catch (err) {
            return res.status(404).json({
              error: 'Not Found',
              statusCode: 404,
              message: 'Image not found',
            });
          }
        }

        const contentTypes = {
          png: 'image/png',
          jpg: 'image/jpeg',
          webp: 'image/webp',
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
          message: error.message,
        });
      }
    });

    app.delete('/v1/image/:imageId', async (req, res) => {
      try {
        const { imageId } = req.params;
        const imagePath = path.join(CONFIG.UPLOAD_DIR, `${imageId}.png`);

        if (global.imageStore) {
          global.imageStore.delete(imageId);
        }

        try {
          await fs.unlink(imagePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
        }

        res.status(202).send();
      } catch (error) {
        console.error('Image deletion failed:', error);
        res.status(500).json({
          error: 'Failed to delete image',
          statusCode: 500,
          message: error.message,
        });
      }
    });

    // 6. Server starten
    const PORT = process.env.NODE_ENV === 'test' ? 3001 : 3000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    if (process.env.NODE_ENV === 'test') {
      global.testServer = server;
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

module.exports = {
  app,
  db: () => db,
  setDb: newDb => {
    db = newDb;
  },
};
