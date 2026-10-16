const { spawn } = require('node:child_process');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');

async function getAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function createTestMongoUri(defaultDatabaseName) {
  const uri = new URL(process.env.TEST_MONGO_URI || process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${defaultDatabaseName}`);
  uri.pathname = `/${defaultDatabaseName}_${randomUUID().replaceAll('-', '')}`;
  return uri.toString();
}

async function startService(directory, env) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: directory,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const baseUrl = `http://127.0.0.1:${env.PORT}`;
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Service exited before becoming ready.\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return { child, baseUrl, getOutput: () => output };
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  child.kill();
  throw new Error(`Service did not become ready within 20 seconds.\n${output}`);
}

async function stopService(service) {
  if (!service || service.child.exitCode !== null || service.child.signalCode !== null) return;
  const exited = new Promise((resolve) => service.child.once('exit', resolve));
  service.child.kill();
  let timeout;
  await Promise.race([exited, new Promise((resolve) => { timeout = setTimeout(resolve, 5000); })]);
  clearTimeout(timeout);
  if (service.child.exitCode === null && service.child.signalCode === null) {
    service.child.kill('SIGKILL');
    let forceTimeout;
    try {
      await Promise.race([
        new Promise((resolve) => service.child.once('exit', resolve)),
        new Promise((resolve, reject) => {
          forceTimeout = setTimeout(() => reject(new Error(`Service process ${service.child.pid} did not exit after termination.`)), 5000);
        })
      ]);
    } finally {
      clearTimeout(forceTimeout);
    }
  }
}

async function dropTestDatabase(uri) {
  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    await connection.dropDatabase();
  } finally {
    await connection.close();
  }
}

module.exports = { createTestMongoUri, dropTestDatabase, getAvailablePort, startService, stopService };
