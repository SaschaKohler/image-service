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
  });

  describe('Health Endpoint', () => {
    test('GET /health returns healthy status when DB is connected', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        database: 'connected',
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Template Creation', () => {
    test('POST /v1/template requires HTML', async () => {
      const response = await request(app)
        .post('/v1/template')
        .auth(auth.username, auth.password)
        .set('x-user-id', `html-test-user-${Date.now()}`)
        .set('x-user-plan', 'FREE')
        .send({
          name: 'Test Template',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'HTML is Required');
    });

    test('POST /v1/template creates template successfully', async () => {
      const uniqueUserId = `create-test-user-${Date.now()}`;

      const response = await request(app)
        .post('/v1/template')
        .auth(auth.username, auth.password)
        .set('x-user-id', uniqueUserId)
        .set('x-user-plan', 'FREE')
        .send({
          html: '<div>Test Template</div>',
          name: 'Test Template',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('template_id');
      expect(response.body).toHaveProperty('template_version');
    });

    test('POST /v1/template enforces plan limits', async () => {
      const userId = 'limit-test-user';
      
      // Ersten Template erstellen
      await request(app)
        .post('/v1/template')
        .auth(auth.username, auth.password)
        .set('x-user-id', userId)
        .set('x-user-plan', 'FREE')
        .send({
          html: '<div>Template 1</div>',
        });

      // Zweiter Template sollte fehlschlagen
      const response = await request(app)
        .post('/v1/template')
        .auth(auth.username, auth.password)
        .set('x-user-id', userId)
        .set('x-user-plan', 'FREE')
        .send({
          html: '<div>Template 2</div>',
        });

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Plan limit exceeded');
    });
  });

  describe('Template Listing', () => {
    test('GET /v1/template lists user templates', async () => {
      const userId = 'list-test-user';
      
      await request(app)
        .post('/v1/template')
        .auth(auth.username, auth.password)
        .set('x-user-id', userId)
        .set('x-user-plan', 'FREE')
        .send({
          html: '<div>Test Template</div>',
        });

      const response = await request(app)
        .get('/v1/template')
        .auth(auth.username, auth.password)
        .set('x-user-id', userId);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].html).toBe('<div>Test Template</div>');
    });
  });
});
