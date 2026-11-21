import { useEffect, useState } from 'preact/hooks'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { core } from 'data-platform'

/** The platform's own setup guide, deployed and versioned with it. */
export const HOUSEHOLD_SETUP_DOC_URL =
  'https://github.com/nadav-alon/data-platform/blob/main/docs/household-setup.md'

/** The Household's deployed platform version, or `undefined` if none is deployed or it does not parse. */
async function readDeployedPlatformVersion(db: Firestore): Promise<core.Semver | undefined> {
  const snapshot = await getDoc(doc(db, core.PLATFORM_DOC_PATH))
  const result = core.platformMetaSchema.safeParse(snapshot.data())
  return result.success ? result.data.version : undefined
}

/**
 * Compares the Household's deployed platform with the version this build is pinned to, and shows a
 * banner when it is outdated or missing. Renders nothing while the check is pending or when it passes.
 */
export function PlatformGuard({ db }: { db: Firestore }) {
  const [check, setCheck] = useState<core.PlatformCheck | null>(null)

  useEffect(() => {
    let cancelled = false
    setCheck(null)
    readDeployedPlatformVersion(db)
      .then((deployed) => {
        if (!cancelled) setCheck(core.checkPlatform(deployed))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [db])

  if (check === null || check === 'ok') return null
  return (
    <div role="alert">
      <p>
        You need to update your platform deploy. Follow the{' '}
        <a href={HOUSEHOLD_SETUP_DOC_URL}>household setup guide</a>.
      </p>
    </div>
  )
}
