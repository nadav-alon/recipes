import { useEffect } from 'preact/hooks'
import { dropGuard, guardLeaving } from '../routes.ts'

/**
 * While `active`, catches the browser's Back and calls `onCaught`; the guard is armed again before that, so a
 * second Back while the caller is still asking is caught too. Takes the guard off when `active` ends or the screen unmounts.
 */
export function useLeaveGuard(active: boolean, onCaught: () => void): void {
  useEffect(() => {
    if (!active) return
    const armGuard = () => guardLeaving(() => {
      armGuard()
      onCaught()
    })
    armGuard()
    return () => dropGuard()
  }, [active])
}
