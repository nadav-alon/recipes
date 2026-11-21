import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { FirebaseError } from 'firebase/app'
import { Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { core } from 'data-platform'
import { firestoreItemsPort } from './firestore-items-port.ts'
import type { WatchedItem } from './items-port.ts'

const { HOUSEHOLD_DOC_PATH, ITEMS_COLLECTION, itemId, memberDocPath, uid } = core

/** Whether Firestore's rules denied the operation, as opposed to a network or programming error. */
const isRulesRefusal = (error: unknown) => error instanceof FirebaseError && error.code === 'permission-denied'

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

/** The port over `uid`'s emulator connection; the emulator's compat Firestore is the modular one at runtime, only typed apart. */
const portAs = (uid: string) => firestoreItemsPort(env.authenticatedContext(uid).firestore() as never)

describe('watchItems', () => {
  it('delivers live and soft-deleted Items with their State, marking the soft-deleted', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    await seedItem('salt', { name: 'Salt', state: 'out', deletedAt: Timestamp.now() })
    const port = portAs(alice)

    const items = await new Promise<readonly WatchedItem[]>((resolve, reject) => {
      stops.push(port.watchItems(resolve, reject))
    })

    expect([...items].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: flour, name: 'Flour', state: 'enough', deleted: false },
      { id: salt, name: 'Salt', state: 'out', deleted: true },
    ])
  })

  it('delivers a later change, including a soft delete, in a further snapshot', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const port = portAs(alice)
    const snapshots: Array<readonly WatchedItem[]> = []
    const second = new Promise<readonly WatchedItem[]>((resolve, reject) => {
      stops.push(
        port.watchItems((items) => {
          snapshots.push(items)
          if (snapshots.length === 2) resolve(items)
        }, reject),
      )
    })

    await vi.waitFor(() => expect(snapshots).toHaveLength(1))
    await seedItem('flour', { name: 'Flour', state: 'out', deletedAt: Timestamp.now() })

    expect(await second).toEqual([{ id: flour, name: 'Flour', state: 'out', deleted: true }])
  })

  it('reports a malformed Item through onError and delivers nothing', async () => {
    await seedItem('flour', { name: 'Flour', state: 'bogus' })
    const port = portAs(alice)
    const onItems = vi.fn()

    const error = await new Promise<unknown>((resolve) => {
      stops.push(port.watchItems(onItems, resolve))
    })

    expect(error).toBeDefined()
    expect(onItems).not.toHaveBeenCalled()
  })
})

describe('setItemState', () => {
  it('writes the new State and appends a State history entry stamped with the server time', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const db = env.authenticatedContext(alice).firestore()
    const port = portAs(alice)

    await port.setItemState(flour, 'out')

    const item = await db.doc(`${ITEMS_COLLECTION}/flour`).get()
    expect(item.data()).toMatchObject({ name: 'Flour', state: 'out' })
    const history = await db.collection(core.stateHistoryCollectionPath(flour)).get()
    expect(history.docs.map((entry) => entry.data())).toEqual([{ state: 'out', at: expect.any(Timestamp) }])
  })
})

describe('setItemState to the State the Item already has', () => {
  it('writes nothing', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const db = env.authenticatedContext(alice).firestore()
    const port = portAs(alice)

    const before = await db.doc(`${ITEMS_COLLECTION}/flour`).get()

    await port.setItemState(flour, 'enough')

    const after = await db.doc(`${ITEMS_COLLECTION}/flour`).get()
    expect(after.data()).toEqual(before.data())
    const history = await db.collection(core.stateHistoryCollectionPath(flour)).get()
    expect(history.empty).toBe(true)
  })
})

describe('a rules refusal', () => {
  it('surfaces from setItemState as an error', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const port = portAs('mallory')

    await expect(port.setItemState(flour, 'out')).rejects.toSatisfy(isRulesRefusal)
  })

  it('surfaces from setItemState when the read is allowed and the commit is denied', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const port = portAs(alice)

    await expect(port.setItemState(flour, 'bogus' as core.State)).rejects.toSatisfy(isRulesRefusal)
  })

  it('surfaces from watchItems through onError', async () => {
    const port = portAs('mallory')

    const error = await new Promise<unknown>((resolve) => {
      stops.push(port.watchItems(() => {}, resolve))
    })

    expect(isRulesRefusal(error)).toBe(true)
  })
})
