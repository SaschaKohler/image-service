// jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};

// tests/server.test.js
const request = require("supertest");
const app = require("../src/server");

describe("Image Service API", () => {
  test("Health check returns 200", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
  });

  test("Basic auth is required for protected endpoints", async () => {
    const response = await request(app).post("/v1/image");
    expect(response.status).toBe(401);
  });
});
