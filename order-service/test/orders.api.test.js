const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createTestMongoUri, dropTestDatabase, getAvailablePort, startService, stopService } = require('../support.cjs');

const userMongoUri = createTestMongoUri('users_test');
const orderMongoUri = createTestMongoUri('orders_test');
let userService;
let orderService;

before(async () => {
  const userPort = await getAvailablePort();
  const orderPort = await getAvailablePort();
  userService = await startService(path.resolve(__dirname, '..', '..', 'user-service'), {
    MONGO_URI: userMongoUri,
    PORT: String(userPort)
  });
  orderService = await startService(path.resolve(__dirname, '..'), {
    MONGO_URI: orderMongoUri,
    USER_SERVICE_URL: userService.baseUrl,
    PORT: String(orderPort)
  });
});

after(async () => {
  await stopService(orderService);
  await stopService(userService);
  await dropTestDatabase(orderMongoUri);
  await dropTestDatabase(userMongoUri);
});

test('validates users before creating and retrieving persisted orders', async () => {
  const healthResponse = await fetch(`${orderService.baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).database, 'connected');

  const userResponse = await fetch(`${userService.baseUrl}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Order Test User', email: `order-${randomUUID()}@example.com` })
  });
  assert.equal(userResponse.status, 201);
  const user = await userResponse.json();

  const orderResponse = await fetch(`${orderService.baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: user._id, productName: 'Keyboard', price: 120 })
  });
  assert.equal(orderResponse.status, 201);
  const order = await orderResponse.json();
  assert.equal(order.userId, user._id);
  assert.equal(order.productName, 'Keyboard');
  assert.equal(order.price, 120);

  const listResponse = await fetch(`${orderService.baseUrl}/orders/user/${user._id}`);
  assert.equal(listResponse.status, 200);
  const savedOrders = await listResponse.json();
  assert.equal(savedOrders.length, 1);
  assert.equal(savedOrders[0]._id, order._id);

  const missingUserId = randomBytes(12).toString('hex');
  const missingUserResponse = await fetch(`${orderService.baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: missingUserId, productName: 'Mouse', price: 60 })
  });
  assert.equal(missingUserResponse.status, 400);
  assert.equal((await missingUserResponse.json()).error, 'Cannot create order: User does not exist.');

  const invalidPriceResponse = await fetch(`${orderService.baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: user._id, productName: 'Mouse', price: -1 })
  });
  assert.equal(invalidPriceResponse.status, 400);

  const invalidUserIdResponse = await fetch(`${orderService.baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'not-an-id', productName: 'Mouse', price: 60 })
  });
  assert.equal(invalidUserIdResponse.status, 400);

  const malformedJsonResponse = await fetch(`${orderService.baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"userId":'
  });
  assert.equal(malformedJsonResponse.status, 400);
  assert.deepEqual(await malformedJsonResponse.json(), { error: 'Invalid JSON request body.' });
});
