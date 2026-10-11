"use client"
import { useEffect, useRef, useState } from "react"

type Tracker = { seen: Set<string>; unread: string[]; signal: number }
export function useOrderSound(
  ids: string[] | undefined,
  connected: boolean,
  freshBaseline: () => Promise<string[]>
) {
  const audio = useRef<AudioContext | null>(null)
  const generation = useRef(0)
  const played = useRef(0)
  const busy = useRef(false)
  const [tracker, setTracker] = useState<Tracker | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [wasConnected, setWasConnected] = useState(connected)
  if (wasConnected !== connected) {
    setWasConnected(connected)
    if (!connected) {
      setEnabled(false)
      setTracker(null)
    }
  }
  // Store notification identities only. The queue and every bill still render directly from Convex.
  if (connected && ids && tracker) {
    const fresh = ids.filter((id) => !tracker.seen.has(id))
    const unread = tracker.unread.filter((id) => ids.includes(id))
    if (fresh.length || unread.length !== tracker.unread.length) {
      setTracker({
        seen: new Set([...tracker.seen, ...fresh]),
        unread: [...unread, ...fresh],
        signal: tracker.signal + (fresh.length ? 1 : 0),
      })
    }
  }
  useEffect(() => {
    const current = ++generation.current
    if (connected) {
      // Reconnect may briefly expose cached query IDs. A server response establishes the new baseline.
      void freshBaseline()
        .then((fresh) => {
          if (generation.current !== current) return
          setTracker(
            (value) => value ?? { seen: new Set(fresh), unread: [], signal: 0 }
          )
        })
        .catch(() => {
          if (generation.current === current) setFailed(true)
        })
    }
    return () => {
      // This counter invalidates async work; it is not a rendered DOM node ref.
      generation.current = current + 1
    }
  }, [connected, freshBaseline])
  useEffect(() => {
    const signal = tracker?.signal ?? 0
    const hasNew = signal > played.current
    played.current = signal
    if (!connected || !enabled || !hasNew || audio.current?.state !== "running")
      return
    const current = generation.current
    void Promise.resolve()
      .then(() => {
        if (
          current !== generation.current ||
          audio.current?.state !== "running"
        )
          return
        const oscillator = audio.current.createOscillator()
        const gain = audio.current.createGain()
        oscillator.connect(gain)
        gain.connect(audio.current.destination)
        oscillator.frequency.value = 740
        gain.gain.value = 0.08
        oscillator.addEventListener(
          "ended",
          () => {
            oscillator.disconnect()
            gain.disconnect()
          },
          { once: true }
        )
        oscillator.start()
        oscillator.stop(audio.current.currentTime + 0.25)
      })
      .catch(() => setFailed(true))
  }, [tracker?.signal, connected, enabled])
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
    if (busy.current || !connected || !ids) return
    busy.current = true
    setPending(true)
    const current = generation.current
    try {
      audio.current ??= new AudioContext()
      await audio.current.resume()
      if (audio.current.state !== "running")
        throw new Error("Audio unavailable")
      const fresh = await freshBaseline()
      if (current !== generation.current) return
      played.current = 0
      setTracker((value) => ({
        seen: new Set([...(value?.seen ?? []), ...fresh]),
        unread: value?.unread ?? [],
        signal: 0,
      }))
      setFailed(false)
      setEnabled(true)
    } catch {
      if (current === generation.current) setFailed(true)
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  function acknowledge() {
    setTracker((value) => (value ? { ...value, unread: [] } : null))
  }
  return {
    enabled,
    failed,
    pending,
    toggle,
    newIds: connected ? (tracker?.unread ?? []) : [],
    acknowledge,
  }
}
