import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { FirebaseError } from 'firebase/app'
import { disableNetwork, enableNetwork, waitForPendingWrites, Timestamp, type Firestore } from 'firebase/firestore'
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

/** A port over `uid`'s connection that has already received the Catalogue's Items, as the app's watch does. */
async function watchingPortAs(
  uid: string,
  { db, onItems = () => {} }: { db?: Firestore; onItems?: (items: readonly WatchedItem[]) => void } = {},
) {
  const port = db ? firestoreItemsPort(db) : portAs(uid)
  await new Promise<void>((resolve, reject) => {
    stops.push(
      port.watchItems((items) => {
        onItems(items)
        resolve()
      }, reject),
    )
  })
  return port
}

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
    const port = await watchingPortAs(alice, { db: db as never })

    await port.setItemState(flour, 'out')
    await waitForPendingWrites(db as never)

    const item = await db.doc(`${ITEMS_COLLECTION}/flour`).get()
    expect(item.data()).toMatchObject({ name: 'Flour', state: 'out' })
    const history = await db.collection(core.stateHistoryCollectionPath(flour)).get()
    expect(history.docs.map((entry) => entry.data())).toEqual([{ state: 'out', at: expect.any(Timestamp) }])
  })
})

describe('setItemState offline', () => {
  it('resolves with the network disabled, shows the write in the watch at once and sends it once back online', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const db = env.authenticatedContext(alice).firestore()
    const snapshots: Array<readonly WatchedItem[]> = []
    const port = await watchingPortAs(alice, { db: db as never, onItems: (items) => snapshots.push(items) })
    await disableNetwork(db as never)

    await port.setItemState(flour, 'out')
    await vi.waitFor(() => expect(snapshots.at(-1)).toEqual([{ id: flour, name: 'Flour', state: 'out', deleted: false }]))
    await port.setItemState(flour, 'enough')
    await vi.waitFor(() => expect(snapshots.at(-1)).toEqual([{ id: flour, name: 'Flour', state: 'enough', deleted: false }]))

    await enableNetwork(db as never)
    await waitForPendingWrites(db as never)
    const server = env.authenticatedContext(alice).firestore()
    const item = await server.doc(`${ITEMS_COLLECTION}/flour`).get()
    expect(item.data()).toMatchObject({ state: 'enough' })
    const history = await server.collection(core.stateHistoryCollectionPath(flour)).get()
    expect(history.docs.map((entry) => entry.data().state).sort()).toEqual(['enough', 'out'])
    expect(history.docs.every((entry) => entry.data().at instanceof Timestamp)).toBe(true)
  })
})

describe('setItemState to the State the Item already has', () => {
  it('writes nothing', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const db = env.authenticatedContext(alice).firestore()
    const port = await watchingPortAs(alice)

    const before = await db.doc(`${ITEMS_COLLECTION}/flour`).get()

    await port.setItemState(flour, 'enough')

    const after = await db.doc(`${ITEMS_COLLECTION}/flour`).get()
    expect(after.data()).toEqual(before.data())
    const history = await db.collection(core.stateHistoryCollectionPath(flour)).get()
    expect(history.empty).toBe(true)
  })
})

describe('setItemState for an Item that is not among the watched Items', () => {
  it('rejects', async () => {
    const port = portAs(alice)

    await expect(port.setItemState(flour, 'out')).rejects.toThrow('No Item flour')
  })
})

describe('a rules refusal', () => {
  it('reaches the watch through onError when the queued write is denied, the Member having been removed', async () => {
    await seedItem('flour', { name: 'Flour', state: 'enough' })
    const port = portAs(alice)
    const errors: unknown[] = []
    await new Promise<void>((resolve) => {
      stops.push(port.watchItems(() => resolve(), (error) => errors.push(error)))
    })

    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(memberDocPath(alice)).delete()
    })

    await port.setItemState(flour, 'out')

    await vi.waitFor(() => expect(errors.some(isRulesRefusal)).toBe(true))
  })

  it('surfaces from watchItems through onError', async () => {
    const port = portAs('mallory')

    const error = await new Promise<unknown>((resolve) => {
      stops.push(port.watchItems(() => {}, resolve))
    })

    expect(isRulesRefusal(error)).toBe(true)
  })
})
