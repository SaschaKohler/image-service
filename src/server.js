// server.js
const express = require("express");
const nodeHtmlToImage = require("node-html-to-image");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const Handlebars = require("handlebars");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(cors());

// Konfiguration
const CONFIG = {
  UPLOAD_DIR: path.join(__dirname, "uploads"),
  TEMPLATES_DIR: path.join(__dirname, "templates"),
  DB_PATH: path.join(__dirname, "templates.db"),
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
  const count = await db.get(
    "SELECT COUNT(*) as count FROM templates WHERE user_id = ?",
    userId
  );

  const limit = CONFIG.TEMPLATE_LIMITS[plan];
  return count.count < limit;
}

// Template erstellen
app.post("/v1/template", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || "demo-user";
    const userPlan = req.headers["x-user-plan"] || "FREE";

    // Limit prüfen
    const canCreate = await checkTemplateLimit(userId, userPlan);
    if (!canCreate) {
      return res.status(429).json({
        error: "Plan limit exceeded",
        statusCode: 429,
        message: `The ${userPlan} plan is limited to ${CONFIG.TEMPLATE_LIMITS[userPlan]} templates`,
      });
    }

    const {
      html,
      css = "",
      name = "",
      description = "",
      google_fonts,
      viewport_width,
      viewport_height,
      device_scale,
    } = req.body;

    if (!html) {
      return res.status(400).json({
        error: "Bad Request",
        statusCode: 400,
        message: "HTML is Required",
      });
    }

    const templateId = `t-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}`;
    const templateVersion = Date.now();

    await db.run(
      `
      INSERT INTO templates (
        id, version, html, css, name, description, google_fonts,
        viewport_width, viewport_height, device_scale, created_at,
        updated_at, user_id, plan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
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
    console.error("Template creation failed:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Templates auflisten
app.get("/v1/template", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || "demo-user";

    const templates = await db.all(
      "SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC",
      userId
    );

    res.json({
      data: templates,
      pagination: {
        next_page_start: null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// Server starten
(async () => {
  try {
    db = await initializeDb();
    console.log("Database initialized");

    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();

module.exports = app; // Exportiere die app
