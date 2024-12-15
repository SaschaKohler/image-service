// tests/imageGenerator.test.js
const request = require('supertest');
const { app, setDb } = require('../src/server');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');

describe('Image Generation API', () => {
  let testDb;
  let testUser;

  beforeAll(async () => {
    // Setup in-memory test database
    testDb = await open({
      filename: ':memory:',
      driver: sqlite3.Database,
    });

    // Create required tables
    await testDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        api_key TEXT UNIQUE,
        plan TEXT DEFAULT 'FREE',
        created_at TEXT,
        updated_at TEXT
      );

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
        plan TEXT DEFAULT 'FREE',
        example_data TEXT,
        template_data TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Create test user
    testUser = {
      id: 'test-user',
      email: 'test@example.com',
      password: 'test-password',
      api_key: 'test-api-key',
    };

    const passwordHash = await bcrypt.hash(testUser.password, 10);
    await testDb.run(
      `
      INSERT INTO users (id, email, password_hash, api_key, plan, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        testUser.id,
        testUser.email,
        passwordHash,
        testUser.api_key,
        'FREE',
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    setDb(testDb);
  });

  afterAll(async () => {
    await testDb?.close();
    if (global.testServer) {
      await new Promise(resolve => global.testServer.close(resolve));
    }
  });

  beforeEach(async () => {
    await testDb.exec('DELETE FROM templates');
    global.imageStore = new Map();
  });

  describe('Authentication', () => {
    test('should reject requests without authentication', async () => {
      const response = await request(app).post('/v1/image').send({
        html: '<div>Test</div>',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should reject requests with invalid credentials', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth('wrong@example.com', 'wrong-key')
        .send({
          html: '<div>Test</div>',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should accept requests with valid credentials', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(testUser.email, testUser.api_key)
        .send({
          html: '<div>Test</div>',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
    });
  });

  describe('Direct HTML to Image', () => {
    test('POST /v1/image requires HTML', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(testUser.email, testUser.api_key)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'HTML is Required');
    });

    test('POST /v1/image generates image successfully', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(testUser.email, testUser.api_key)
        .send({
          html: '<div>Test Image</div>',
          css: 'div { color: blue; }',
          template_data: {
            message: 'Test Message',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^\/uploads\/img-/);
    });
  });

  describe('Template-based Image Generation', () => {
    let templateId;
    const templateData = {
      message: 'Hello from template!',
    };

    beforeEach(async () => {
      // Create a test template directly in the database
      templateId = `t-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      await testDb.run(
        `
        INSERT INTO templates (
          id, version, html, css, name, description, user_id, 
          created_at, updated_at, template_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          templateId,
          Date.now(),
          '<div>{{message}}</div>',
          'div { color: red; }',
          'Test Template',
          'Test Description',
          testUser.id,
          new Date().toISOString(),
          new Date().toISOString(),
          JSON.stringify(templateData),
        ]
      );
    });

    test('POST /v1/image/from-template/:templateId generates image from template', async () => {
      const response = await request(app)
        .post(`/v1/image/from-template/${templateId}`)
        .auth(testUser.email, testUser.api_key)
        .send(templateData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^\/uploads\//);
    });

    test('POST /v1/image/from-template/:templateId returns 404 for non-existent template', async () => {
      const response = await request(app)
        .post('/v1/image/from-template/non-existent')
        .auth(testUser.email, testUser.api_key)
        .send(templateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Template not found');
    });
  });

  describe('Image Operations', () => {
    let imageId;
    let baseUrl;

    beforeEach(async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(testUser.email, testUser.api_key)
        .send({
          html: '<div>Test Image</div>',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      // Extrahiere die ID aus der URL
      imageId = response.body.url.split('/').pop().replace('.png', '');
      baseUrl = `/v1/image/${imageId}`;
    });

    test('GET /v1/image/:imageId retrieves image', async () => {
      const response = await request(app).get(baseUrl).auth(testUser.email, testUser.api_key);

      expect(response.status).toBe(200);
      expect(response.type).toBe('image/png');
    });

    test('GET /v1/image/:imageId with format parameter', async () => {
      const response = await request(app)
        .get(`${baseUrl}?format=jpg`)
        .auth(testUser.email, testUser.api_key);

      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('image/jpeg');
    });

    test('GET /v1/image/:imageId with download flag', async () => {
      const response = await request(app)
        .get(`${baseUrl}?dl=1`)
        .auth(testUser.email, testUser.api_key);

      expect(response.status).toBe(200);
      expect(response.get('Content-Disposition')).toContain('attachment');
    });

    test('DELETE /v1/image/:imageId removes image', async () => {
      // Erst löschen
      const deleteResponse = await request(app)
        .delete(baseUrl)
        .auth(testUser.email, testUser.api_key);

      expect(deleteResponse.status).toBe(202);

      // Dann versuchen das Bild abzurufen
      const getResponse = await request(app).get(baseUrl).auth(testUser.email, testUser.api_key);

      expect(getResponse.status).toBe(404);
    });
  });
});
