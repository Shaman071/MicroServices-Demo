const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createTestMongoUri, dropTestDatabase, getAvailablePort, startService, stopService } = require('../support.cjs');

const databaseName = `users_test_${randomUUID().replaceAll('-', '')}`;
const mongoUri = createTestMongoUri(databaseName);
let service;

before(async () => {
  const port = await getAvailablePort();
  service = await startService(path.join(__dirname, '..'), {
    MONGO_URI: mongoUri,
    PORT: String(port)
  });
});

after(async () => {
  await stopService(service);
  await dropTestDatabase(mongoUri);
});

test('creates, reads back, and validates users', async () => {
  const healthResponse = await fetch(`${service.baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).database, 'connected');

  const email = `user-${randomUUID()}@example.com`;
  const createResponse = await fetch(`${service.baseUrl}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: ' Test User ', email })
  });
  assert.equal(createResponse.status, 201);
  const createdUser = await createResponse.json();
  assert.equal(createdUser.name, 'Test User');
  assert.equal(createdUser.email, email);

  const readResponse = await fetch(`${service.baseUrl}/users/${createdUser._id}`);
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json())._id, createdUser._id);

  const duplicateResponse = await fetch(`${service.baseUrl}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate', email })
  });
  assert.equal(duplicateResponse.status, 409);

  const invalidResponse = await fetch(`${service.baseUrl}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '  ', email })
  });
  assert.equal(invalidResponse.status, 400);

  const missingResponse = await fetch(`${service.baseUrl}/users/661f1c24e83f0b2f1837abcd`);
  assert.equal(missingResponse.status, 404);

  const invalidIdResponse = await fetch(`${service.baseUrl}/users/not-an-id`);
  assert.equal(invalidIdResponse.status, 400);

  const malformedJsonResponse = await fetch(`${service.baseUrl}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"name":'
  });
  assert.equal(malformedJsonResponse.status, 400);
  assert.deepEqual(await malformedJsonResponse.json(), { error: 'Invalid JSON request body.' });
});
