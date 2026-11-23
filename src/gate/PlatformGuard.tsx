import { useEffect, useState } from 'preact/hooks'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { AlertBanner } from 'household-ui/ui/AlertBanner.tsx'
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
 * banner when it is outdated or missing, and a different one when the read itself fails (offline,
 * permission denied), since the version is then unknown. Renders nothing while the check is pending
 * or when it passes.
 */
export function PlatformGuard({ db }: { db: Firestore }) {
  const [check, setCheck] = useState<core.PlatformCheck | 'failed' | null>(null)

  useEffect(() => {
    let cancelled = false
    setCheck(null)
    readDeployedPlatformVersion(db)
      .then((deployed) => {
        if (!cancelled) setCheck(core.checkPlatform(deployed))
      })
      .catch(() => {
        if (!cancelled) setCheck('failed')
      })
    return () => {
      cancelled = true
    }
  }, [db])

  if (check === null || check === 'ok') return null
  if (check === 'failed') {
    return <AlertBanner message="Couldn't check your platform version. Check your connection and reload." />
  }
  return (
    <AlertBanner
      message="You need to update your platform deploy."
      action={{ label: 'Open the household setup guide', onAction: () => window.location.assign(HOUSEHOLD_SETUP_DOC_URL) }}
    />
  )
}
