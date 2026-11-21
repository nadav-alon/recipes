import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'vite'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { LOCAL_PROJECT_ID, seedFixtures, type ScenarioName } from 'data-platform/local'
import { EMULATOR_MODE } from '../../src/gate/emulator.ts'
import { parseScenario } from './args.ts'
import { uxFixtures } from './fixtures.ts'

// The three constants below restate data-platform v0.14.0's internals, which `data-platform/local`
// does not export (the ports, the ready line it logs, the layout of its `dist/`). Recheck them when
// bumping data-platform; exporting them from the kit is the durable fix.
/** The kit's Firestore emulator (`FIRESTORE_EMULATOR_PORT` in data-platform v0.14.0). */
const FIRESTORE_EMULATOR = '127.0.0.1:8090'
/** What the local kit prints once the scenario is seeded and its Auth users exist (data-platform v0.14.0). */
const SEEDED = /Seeded scenario/

/** The kit's launcher, `dist/local/bin.js` in data-platform v0.14.0. */
const KIT_BIN = createRequire(import.meta.url).resolve('data-platform/local').replace(/index\.js$/, 'bin.js')

/** Writes the ux fixtures into the local Firestore emulator, bypassing the rules as the kit does. */
async function writeFixtures(scenario: ScenarioName): Promise<void> {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR
  const app = initializeApp({ projectId: LOCAL_PROJECT_ID }, 'ux-fixtures')
  try {
    const db = getFirestore(app)
    await seedFixtures({ set: async (path, data) => void (await db.doc(path).set(data)) }, uxFixtures(scenario))
  } finally {
    await deleteApp(app)
  }
}

/**
 * Starts the data-platform local kit (Auth and Firestore emulators, the scenario seeded), adds the
 * Recipes app's own fixtures, then serves the app in `emulator` mode and prints its URL. Runs until interrupted.
 */
async function main(): Promise<void> {
  const scenario = parseScenario(process.argv.slice(2))
  const kit = spawn(process.execPath, [KIT_BIN, scenario], { stdio: ['inherit', 'pipe', 'inherit'] })
  const kitExited = new Promise<number>((resolve) => kit.once('exit', (code) => resolve(code ?? 1)))
  const seeded = new Promise<void>((resolve) => {
    kit.stdout.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk)
      if (SEEDED.test(chunk.toString())) resolve()
    })
  })
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(signal, () => kit.kill(signal))
  // Whatever else ends this process (a crash after the spawn, `process.exit`), the emulators go with it.
  process.on('exit', () => {
    kit.kill()
  })

  const ready = await Promise.race([seeded.then(() => true), kitExited.then(() => false)])
  if (!ready) throw new Error('The local emulators exited before the scenario was seeded')
  await writeFixtures(scenario)

  const server = await createServer({ mode: EMULATOR_MODE })
  await server.listen()
  const [url] = server.resolvedUrls?.local ?? []
  console.log(`\nRecipes is served at ${url ?? 'the address Vite printed above'} (scenario "${scenario}").`)

  process.exitCode = await kitExited
  await server.close()
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
