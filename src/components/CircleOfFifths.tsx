import {
  circleCaption,
  circleNameForPc,
  fifthsDegreeAtSlot,
  fifthsFromC,
  fifthsFromKey,
  parseRootPc,
} from '../theory/circleOfFifths'

interface Props {
  keyRoot: string
  chordRootName?: string
}

const SIZE = 248
const CX = SIZE / 2
const CY = SIZE / 2
const R_NOTE = 92
const R_DEGREE = 66

function polar(index: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 12
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle),
  }
}

export function CircleOfFifths({ keyRoot, chordRootName }: Props) {
  const keyPc = parseRootPc(keyRoot)
  if (keyPc === null) return null
  const chordPc = chordRootName ? parseRootPc(chordRootName) : null
  const steps = chordPc === null ? 0 : fifthsFromKey(keyPc, chordPc)
  const keyIndex = fifthsFromC(keyPc)
  const chordIndex = chordPc === null ? null : fifthsFromC(chordPc)
  const same = chordIndex === keyIndex
  const caption =
    chordRootName && chordPc !== null
      ? circleCaption(keyRoot, circleNameForPc(chordPc), steps)
      : `C at the top · ${keyRoot} marked as I · fifths clockwise`

  return (
    <figure className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="max-w-full text-cosmos-400"
        role="img"
        aria-label={caption}
      >
        <circle
          cx={CX}
          cy={CY}
          r={R_NOTE}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          className="text-cosmos-700"
        />
        {Array.from({ length: 12 }, (_, i) => {
          const note = polar(i, R_NOTE)
          const degree = polar(i, R_DEGREE)
          const isKey = i === keyIndex
          const isChord = chordIndex !== null && i === chordIndex
          return (
            <g key={i}>
              <text
                x={degree.x}
                y={degree.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`fill-current ${
                  isKey || isChord ? 'text-cosmos-300' : 'text-cosmos-600'
                }`}
                fontSize={11}
                fontWeight={isKey || isChord ? 700 : 500}
              >
                {fifthsDegreeAtSlot(keyPc, i)}
              </text>
              <circle
                cx={note.x}
                cy={note.y}
                r={isKey || isChord ? 14 : 12}
                className={
                  isChord && !same
                    ? 'fill-star-400/20 stroke-star-400'
                    : isKey
                      ? 'fill-nebula-600/30 stroke-nebula-400'
                      : 'fill-cosmos-900 stroke-cosmos-600'
                }
                strokeWidth={isKey || isChord ? 1.8 : 1.1}
              />
              <text
                x={note.x}
                y={note.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`fill-current ${
                  isChord && !same
                    ? 'text-star-300'
                    : isKey
                      ? 'text-white'
                      : 'text-cosmos-300'
                }`}
                fontSize={12}
                fontWeight={700}
              >
                {circleNameForPc(i * 7)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="max-w-[18rem] text-center text-[11px] leading-snug text-cosmos-400">
        {caption}
      </figcaption>
    </figure>
  )
}
