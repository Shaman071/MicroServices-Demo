const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createTestMongoUri, dropTestDatabase, getAvailablePort, startService, stopService } = require('../support.cjs');

const mongoUri = createTestMongoUri('orders_unavailable_test');
let service;

before(async () => {
  const port = await getAvailablePort();
  service = await startService(path.resolve(__dirname, '..'), {
    MONGO_URI: mongoUri,
    USER_SERVICE_URL: 'http://127.0.0.1:1',
    PORT: String(port)
  });
});

after(async () => {
  await stopService(service);
  await dropTestDatabase(mongoUri);
});

test('returns a service-unavailable response when user validation cannot reach its dependency', async () => {
  const response = await fetch(`${service.baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId: '661f1c24e83f0b2f1837abcd',
      productName: 'Keyboard',
      price: 120
    })
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'Failed to communicate with User Service.');
});
