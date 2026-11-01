import { useEffect, useState } from 'react'
import { useStore } from '../../app/store'

/** Object URL of a photo's display copy; revoked when no longer used. */
export function usePhotoUrl(id: string | undefined): string | undefined {
  const photoFiles = useStore((s) => s.photoFiles)
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!id) return
    let alive = true
    let made: string | undefined
    void photoFiles(id).then((f) => {
      if (!alive || !f) return
      made = URL.createObjectURL(f.display)
      setUrl(made)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
      setUrl(undefined)
    }
  }, [id, photoFiles])
  return url
}
