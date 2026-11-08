import { spawnSync } from 'node:child_process';
import net from 'node:net';

try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional; defaults below keep local development zero-config.
}

const composeFile = 'infra/docker-compose.yml';
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://studylog:studylog@localhost:5432/studylog';
const containerName = process.env.POSTGRES_CONTAINER ?? 'studylog-db';
const port = Number(new URL(databaseUrl).port || 5432);
const user = process.env.POSTGRES_USER ?? 'studylog';
const password = process.env.POSTGRES_PASSWORD ?? 'studylog';
const database = process.env.POSTGRES_DB ?? 'studylog';

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit' });
}

function canRun(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForDatabase(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

if (await isPortOpen()) {
  process.exit(0);
}

if (canRun('docker', ['compose', 'version'])) {
  const result = run('docker', ['compose', '-f', composeFile, 'up', '-d', 'db']);
  if (result.status !== 0) process.exit(result.status ?? 1);
} else if (canRun('podman', ['--version'])) {
  const running = spawnSync('podman', ['inspect', '-f', '{{.State.Running}}', containerName], {
    encoding: 'utf8',
  });

  if (running.status !== 0) {
    const result = run('podman', [
      'run',
      '-d',
      '--name',
      containerName,
      '-e',
      `POSTGRES_USER=${user}`,
      '-e',
      `POSTGRES_PASSWORD=${password}`,
      '-e',
      `POSTGRES_DB=${database}`,
      '-p',
      `${port}:5432`,
      'postgres:16-alpine',
    ]);
    if (result.status !== 0) process.exit(result.status ?? 1);
  } else if (running.stdout.trim() !== 'true') {
    const result = run('podman', ['start', containerName]);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} else {
  console.warn(
    '[dev] No se encontró Docker ni Podman. Arranca Postgres manualmente y define DATABASE_URL.',
  );
  process.exit(0);
}

if (!(await waitForDatabase())) {
  console.error('[dev] Postgres no respondió en 30 s. Revisa el contenedor y DATABASE_URL.');
  process.exit(1);
}
