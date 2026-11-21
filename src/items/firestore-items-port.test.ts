import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { core } from 'data-platform'
import { firestoreItemsPort } from './firestore-items-port.ts'
import type { WatchedItem } from './items-port.ts'

const { HOUSEHOLD_DOC_PATH, ITEMS_COLLECTION, itemId, memberDocPath, uid } = core

const alice = uid('alice')
const flour = itemId('flour')
const salt = itemId('salt')

let env: RulesTestEnvironment
const stops: Array<() => void> = []

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-recipes',
    firestore: { rules: readFileSync('node_modules/data-platform/firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  stops.forEach((stop) => stop())
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await db.doc(HOUSEHOLD_DOC_PATH).set({ owner: alice })
    await db.doc(memberDocPath(alice)).set({ email: 'alice@example.com', addedAt: Timestamp.now() })
  })
})

async function seedItem(id: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`${ITEMS_COLLECTION}/${id}`).set(data)
  })
}

describe('watchItems', () => {
  it('delivers live and soft-deleted Items with their State, marking the soft-deleted', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    await seedItem('salt', { name: 'Salt', state: 'out', deletedAt: Timestamp.now() })
    const port = firestoreItemsPort(env.authenticatedContext(alice).firestore() as never)

    const items = await new Promise<readonly WatchedItem[]>((resolve, reject) => {
      stops.push(port.watchItems(resolve, reject))
    })

    expect([...items].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: flour, name: 'Flour', state: 'enough', deleted: false },
      { id: salt, name: 'Salt', state: 'out', deleted: true },
    ])
  })
})
