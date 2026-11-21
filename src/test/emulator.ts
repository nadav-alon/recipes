import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const PROJECT_ID = 'demo-recipes'
const RULES_PATH = 'node_modules/data-platform/firestore.rules'

let counter = 0

/**
 * The Firestore emulator running data-platform's own rules, started by `npm test`. Each signed-in
 * client gets its own app so a test can act as a Member, or as nobody.
 */
export interface Emulator {
  /** Wipes every document, and seeds `memberUids` as Members of the Household. */
  reset(memberUids: readonly string[]): Promise<void>
  /** A Firestore signed in as `uid`, or signed out when omitted. */
  client(uid?: string): Firestore
  /** Writes a document directly, bypassing the rules. */
  seed(path: string, data: Record<string, unknown>): Promise<void>
  close(): Promise<void>
}

export async function startEmulator(): Promise<Emulator> {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':')
  if (!host || !port) throw new Error('FIRESTORE_EMULATOR_HOST is not set; run the tests through `npm test`')
  const env: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(port) },
  })
  const apps: FirebaseApp[] = []

  return {
    async reset(memberUids) {
      await env.clearFirestore()
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore()
        await db.doc('meta/household').set({ owner: memberUids[0] ?? 'nobody' })
        for (const uid of memberUids) {
          await db.doc(`members/${uid}`).set({ email: `${uid}@example.com`, addedAt: { seconds: 1_700_000_000, nanoseconds: 0 } })
        }
      })
    },
    async seed(path, data) {
      await env.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(path).set(data)
      })
    },
    client(uid) {
      const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake' }, `client-${counter++}`)
      apps.push(app)
      const db = getFirestore(app)
      connectFirestoreEmulator(db, host, Number(port), uid ? { mockUserToken: { sub: uid } } : {})
      return db
    },
    async close() {
      await Promise.all(apps.map((app) => deleteApp(app)))
      await env.cleanup()
    },
  }
}
