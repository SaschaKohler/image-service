// tests/server.test.js
const request = require('supertest');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { app, setDb } = require('../src/server');

describe('Template Service API', () => {
  let testDb;
  const auth = {
    username: process.env.API_USER || 'test',
    password: process.env.API_KEY || 'test',
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
        plan TEXT DEFAULT 'FREE',
        example_data TEXT,
        template_data TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        api_key TEXT UNIQUE,
        plan TEXT DEFAULT 'FREE',
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Create test user
    await testDb.run(
      `
      INSERT INTO users (id, email, api_key, plan, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        'test-user',
        'test@example.com',
        'test-api-key',
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
  });

  describe('Template Creation', () => {
    test('POST /v1/template creates template with template_data successfully', async () => {
      const templateData = {
        title: 'Test Title',
        message: 'Test Message',
      };

      const response = await request(app)
        .post('/v1/template')
        .auth('test@example.com', 'test-api-key')
        .send({
          html: '<div>{{title}} - {{message}}</div>',
          name: 'Test Template',
          template_data: templateData,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('template_id');
      expect(response.body).toHaveProperty('template_version');
      expect(response.body.template_data).toEqual(templateData);

      // Verify template was stored correctly
      const template = await testDb.get('SELECT * FROM templates WHERE id = ?', [
        response.body.template_id,
      ]);
      expect(JSON.parse(template.template_data)).toEqual(templateData);
    });

    test('POST /v1/template validates template syntax with template_data', async () => {
      const response = await request(app)
        .post('/v1/template')
        .auth('test@example.com', 'test-api-key')
        .send({
          html: '<div>{{invalidSyntax</div>',
          template_data: { title: 'Test' },
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Invalid template syntax/);
    });
  });

  describe('Image Generation', () => {
    let templateId;
    const templateData = {
      title: 'Dynamic Title',
      message: 'Dynamic Message',
    };

    beforeEach(async () => {
      // Create a test template
      const response = await request(app)
        .post('/v1/template')
        .auth('test@example.com', 'test-api-key')
        .send({
          html: '<div>{{title}} - {{message}}</div>',
          template_data: templateData,
        });

      templateId = response.body.template_id;
    });

    test('POST /v1/image handles template_data correctly', async () => {
      const response = await request(app)
        .post('/v1/image')
        .auth('test@example.com', 'test-api-key')
        .send({
          html: '<div>{{title}} - {{message}}</div>',
          template_data: templateData,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^\/uploads\/img-/);
    });

    test('POST /v1/image/from-template/:templateId uses template_data', async () => {
      const customData = {
        title: 'Custom Title',
        message: 'Custom Message',
      };

      const response = await request(app)
        .post(`/v1/image/from-template/${templateId}`)
        .auth('test@example.com', 'test-api-key')
        .send(customData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toMatch(/^\/uploads\/img-/);
    });

    test('POST /v1/image/from-template/:templateId falls back to template_data if no data provided', async () => {
      const response = await request(app)
        .post(`/v1/image/from-template/${templateId}`)
        .auth('test@example.com', 'test-api-key')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
    });

    test('POST /v1/image/from-template/:templateId validates provided data', async () => {
      const response = await request(app)
        .post(`/v1/image/from-template/${templateId}`)
        .auth('test@example.com', 'test-api-key')
        .send({
          invalidKey: 'This should still work but not be used',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('url');
    });
  });

  describe('Template Listing', () => {
    test('GET /v1/template includes template_data in response', async () => {
      const templateData = {
        title: 'Test Title',
        message: 'Test Message',
      };

      // Create a template first
      await request(app).post('/v1/template').auth('test@example.com', 'test-api-key').send({
        html: '<div>{{title}} - {{message}}</div>',
        template_data: templateData,
      });

      const response = await request(app)
        .get('/v1/template')
        .auth('test@example.com', 'test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0].template_data).toEqual(templateData);
      expect(response.body.data[0].example_data).toEqual(templateData); // For backwards compatibility
    });
  });
});
