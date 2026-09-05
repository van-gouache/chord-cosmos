import { useCallback, useEffect, useRef, useState } from 'react'

import { Logo } from './Logo'

const HOLD_MS = 10_000

/** Brief load-in identity screen. Click or press a key to skip. */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const finished = useRef(false)

  const dismiss = useCallback(() => {
    setLeaving(true)
  }, [])

  useEffect(() => {
    const hold = window.setTimeout(dismiss, HOLD_MS)
    const skip = () => dismiss()
    window.addEventListener('keydown', skip)
    return () => {
      window.clearTimeout(hold)
      window.removeEventListener('keydown', skip)
    }
  }, [dismiss])

  return (
    <div
      role="dialog"
      aria-label="Chord Cosmos"
      aria-modal="true"
      onClick={dismiss}
      onTransitionEnd={(event) => {
        if (event.propertyName !== 'opacity' || !leaving || finished.current) {
          return
        }
        finished.current = true
        onDone()
      }}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-cosmos-950 transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-[18%] left-[20%] h-56 w-56 rounded-full bg-nebula-500/25 blur-3xl" />
        <div className="absolute right-[18%] bottom-[22%] h-48 w-48 rounded-full bg-star-400/15 blur-3xl" />
      </div>

      <div className="splash-rise relative flex flex-col items-center px-6 text-center">
        <Logo className="h-20 w-20 shadow-[0_0_48px_rgba(139,92,246,0.35)]" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Chord{' '}
          <span className="bg-gradient-to-r from-nebula-400 to-star-400 bg-clip-text text-transparent">
            Cosmos
          </span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-cosmos-300 sm:text-base">
          Sequence guitar voicings quickly — inspired by Ted Greene&apos;s
          V-System and Chord Chemistry.
        </p>
      </div>

      <p className="absolute inset-x-0 bottom-10 text-center text-[11px] tracking-[0.18em] text-cosmos-500 uppercase">
        Click to enter
      </p>
    </div>
  )
}
