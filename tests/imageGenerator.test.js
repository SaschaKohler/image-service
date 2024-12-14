// tests/imageGenerator.test.js
const request = require('supertest');
const { app, setDb } = require('../src/server');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

describe('Image Generation API', () => {
  let testDb;
  const auth = {
    username: process.env.API_USER || 'test',
    password: process.env.API_KEY || 'test'
  };

  beforeAll(async () => {
    testDb = await open({
      filename: ':memory:',
      driver: sqlite3.Database,
    });

    await testDb.exec(`
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
      const response = await request(app)
        .post('/v1/image')
        .send({
          html: '<div>Test</div>'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should reject requests with invalid credentials', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth('wrong', 'credentials')
        .send({
          html: '<div>Test</div>'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should accept requests with valid credentials', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(auth.username, auth.password)
        .send({
          html: '<div>Test</div>'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
    });
  });

  describe('Direct HTML to Image', () => {
    test('POST /v1/image requires HTML', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(auth.username, auth.password)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'HTML is Required');
    });

    test('POST /v1/image generates image successfully', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(auth.username, auth.password)
        .send({
          html: '<div>Test Image</div>',
          css: 'div { color: blue; }',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^\/v1\/image\/img-/);
    });
  });

  describe('Template-based Image Generation', () => {
    let templateId;

    beforeEach(async () => {
      // Template direkt in der Datenbank erstellen
      templateId = `t-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const now = new Date().toISOString();

      await testDb.run(`
        INSERT INTO templates (
          id, version, html, css, name, description, created_at, updated_at, user_id, plan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        templateId,
        Date.now(),
        '<div>{{message}}</div>',
        'div { color: red; }',
        'Test Template',
        'Test Description',
        now,
        now,
        'test-user',
        'FREE'
      ]);

      // Verifiziere, dass das Template erstellt wurde
      const template = await testDb.get('SELECT * FROM templates WHERE id = ?', templateId);
      if (!template) {
        throw new Error('Template was not created successfully');
      }
    });

    test('POST /v1/image/from-template/:templateId generates image from template', async () => {
      const response = await request(app)
        .post(`/v1/image/from-template/${templateId}`)
        .auth(auth.username, auth.password)
        .send({
          message: 'Hello from template!'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^\/v1\/image\/img-/);
    });

    test('POST /v1/image/from-template/:templateId returns 404 for non-existent template', async () => {
      const response = await request(app)
        .post('/v1/image/from-template/non-existent')
        .auth(auth.username, auth.password)
        .send({
          message: 'Hello'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Template not found');
    });
  });

  describe('Image Operations', () => {
    let imageUrl;

    beforeEach(async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth(auth.username, auth.password)
        .send({
          html: '<div>Test Image</div>'
        });

      imageUrl = response.body.url;
    });

    test('GET /v1/image/:imageId retrieves image', async () => {
      const response = await request(app)
        .get(imageUrl)
        .auth(auth.username, auth.password);

      expect(response.status).toBe(200);
      expect(response.type).toBe('image/png');
    });

    test('GET /v1/image/:imageId with format parameter', async () => {
      const response = await request(app)
        .get(`${imageUrl}?format=jpg`)
        .auth(auth.username, auth.password);

      expect(response.status).toBe(200);
      expect(response.type).toBe('image/jpeg');
    });

    test('GET /v1/image/:imageId with download flag', async () => {
      const response = await request(app)
        .get(`${imageUrl}?dl=1`)
        .auth(auth.username, auth.password);

      expect(response.status).toBe(200);
      expect(response.header['content-disposition']).toContain('attachment');
    });

    test('DELETE /v1/image/:imageId removes image', async () => {
      const imageId = imageUrl.split('/').pop();
      
      const deleteResponse = await request(app)
        .delete(`/v1/image/${imageId}`)
        .auth(auth.username, auth.password);
      expect(deleteResponse.status).toBe(202);

      const getResponse = await request(app)
        .get(imageUrl)
        .auth(auth.username, auth.password);
      expect(getResponse.status).toBe(404);
    });
  });
});
