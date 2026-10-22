import { useEffect, useState } from "react"

/** False on first paint, true one frame later — lets CSS transitions run on load. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return mounted
}
