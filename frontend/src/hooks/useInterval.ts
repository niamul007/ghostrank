import { useEffect, useRef } from "react"

/**
 * Runs `callback` every `delayMs`. Pass `null` to pause — used by scan
 * polling to stop once a scan reaches a terminal status (COMPLETED/FAILED)
 * instead of tearing down and rebuilding the effect each time.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delayMs === null) return
    const id = setInterval(() => savedCallback.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs])
}
