"use client"
import { useEffect, useRef, useState } from "react"

export function useOrderSound(
  ids: string[] | undefined,
  connected: boolean,
  freshBaseline: () => Promise<string[]>
) {
  const audio = useRef<AudioContext | null>(null)
  const baseline = useRef<Set<string> | null>(null)
  const generation = useRef(0)
  const [enabled, setEnabled] = useState(false)
  const [failed, setFailed] = useState(false)
  const [wasConnected, setWasConnected] = useState(connected)
  // Losing connection requires another explicit opt-in, with a fresh server baseline.
  if (wasConnected !== connected) {
    setWasConnected(connected)
    if (!connected) setEnabled(false)
  }
  useEffect(() => {
    if (!connected || !ids) {
      baseline.current = null
      generation.current += 1
      return
    }
    const next = new Set(ids)
    const hasNew =
      baseline.current && ids.some((id) => !baseline.current!.has(id))
    baseline.current = next
    if (enabled && hasNew && audio.current?.state === "running") {
      const oscillator = audio.current.createOscillator()
      const gain = audio.current.createGain()
      oscillator.connect(gain)
      gain.connect(audio.current.destination)
      oscillator.frequency.value = 740
      gain.gain.value = 0.08
      oscillator.start()
      oscillator.stop(audio.current.currentTime + 0.25)
    }
  }, [ids, connected, enabled])
  useEffect(
    () => () => {
      void audio.current?.close()
    },
    []
  )
  async function toggle() {
    if (enabled) {
      setEnabled(false)
      return
    }
    if (!connected || !ids) return
    const currentGeneration = generation.current
    try {
      audio.current ??= new AudioContext()
      await audio.current.resume()
      if (audio.current.state !== "running")
        throw new Error("Audio unavailable")
      const freshIds = await freshBaseline()
      if (currentGeneration !== generation.current) return
      baseline.current = new Set(freshIds)
      setFailed(false)
      setEnabled(true)
    } catch {
      setFailed(true)
    }
  }
  return { enabled, failed, toggle }
}
