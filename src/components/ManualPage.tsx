import { useEffect, type ReactNode } from 'react'

const CONTENTS = [
  { id: 'layout', label: 'Layout' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'sections', label: 'Sections' },
  { id: 'groups', label: 'Groups' },
  { id: 'steps', label: 'Steps' },
  { id: 'progression', label: 'Next chord' },
  { id: 'v-system', label: 'V-System' },
  { id: 'triads', label: 'Triads' },
  { id: 'build', label: 'Build' },
  { id: 'settings', label: 'Settings' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'songs', label: 'Songs' },
] as const

export function ManualPage({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previous = document.title
    document.title = 'Manual · Chord Cosmos'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-cosmos-950 text-cosmos-200">
      <header className="flex shrink-0 items-center gap-3 border-b border-cosmos-800 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-cosmos-500 uppercase">
            Chord Cosmos
          </p>
          <h1 className="text-xl font-bold tracking-tight text-white">Manual</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 shrink-0 items-center rounded-lg bg-nebula-600 px-3.5 text-sm font-semibold text-white transition hover:bg-nebula-500"
        >
          Back to the sequence
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
          <nav
            aria-label="Manual contents"
            className="lg:sticky lg:top-8 lg:self-start"
          >
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-cosmos-500 uppercase">
              Contents
            </p>
            <ol className="space-y-1 text-sm">
              {CONTENTS.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => {
                      event.preventDefault()
                      document.getElementById(item.id)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }}
                    className="text-cosmos-300 transition hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="min-w-0 space-y-10 pb-16">
            <Section id="layout" title="Layout">
              <p>
                The sequence fills the main area. The voicing workshop sits
                beside it on a wide screen and below it on a narrow one. Hide
                closes the workshop; the vertical Voicing workshop tab opens
                it again.
              </p>
              <p>
                A splash screen covers the app until you click it. Songs,
                tempo, and the switches in Settings stay in this browser.
              </p>
            </Section>

            <Section id="sequences" title="Sequences">
              <p>
                The title is the sequence name. Edit it in place. Songs opens
                the library. Buy me a coffee opens a Ko-fi page in a new tab.
              </p>
              <ul>
                <li>
                  Play walks every filled step at the sequence tempo. Stop
                  cuts it off. Play is also on the collapsed toolbar and in
                  Notebook.
                </li>
                <li>
                  Undo and Redo step through edits. The shortcuts are ⌘Z and
                  ⇧⌘Z on a Mac, and Ctrl+Z and Ctrl+Y elsewhere.
                </li>
                <li>
                  Tempo runs from 40 to 220. The presets are 60, 80, 90, 120,
                  and 160. A new sequence starts at 90.
                </li>
                <li>Copy puts the sequence on the clipboard as text.</li>
                <li>
                  Shift-click selects a range of steps. Delete, on the toolbar
                  or the keyboard, clears those steps.
                </li>
                <li>Clear empties the whole sequence.</li>
                <li>
                  Notebook opens the paper view. Collapse hides the toolbar
                  down to the name, Manual, coffee, and Play.
                </li>
              </ul>
            </Section>

            <Section id="sections" title="Sections">
              <p>
                A sequence is a stack of sections. Add section starts another
                one. Each section has a name and a notes field.
              </p>
              <ul>
                <li>The arrow collapses the section.</li>
                <li>Play starts playback at that section.</li>
                <li>Copy duplicates the section.</li>
                <li>Remove deletes it.</li>
              </ul>
            </Section>

            <Section id="groups" title="Groups">
              <p>
                A group is one row of steps. A new group holds four chords.
                The Chords stepper changes that count. Drag a group onto
                another group to swap them. Collapse, play from, copy, and
                remove sit on the group header. Add group appends a row.
              </p>
              <p>
                Key and scale belong to the group. The scale is the mode:
                Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian,
                Locrian, harmonic minor, melodic minor, or harmonic major.
                With a key set, each chord shows a Roman numeral.
              </p>
              <p>
                Generate builds a new progression in that group. Choose how
                many chords (1 to 16), the key, and the chord choice: Plain,
                Mild, Medium, Spicy, or Wild. Plain stays inside the key.
                Higher choices bring in applied dominants, secondary
                dominants, tritone substitutes, backdoor chords, and borrowed
                color. The scale shown beside the key is the group’s mode, and
                generating writes that key and mode onto the group.
              </p>
              <p>
                V-system is a separate slider from 0 to 4. At 0 every grip is
                drop 2. Higher values make wide, tough grips more likely, and
                easy grips stay in the draw. Create progression fills an empty
                group. Replace progression overwrites a group that already has
                chords. One Undo puts the previous group back.
              </p>
            </Section>

            <Section id="steps" title="Steps">
              <p>
                A step holds a chord grip, a single-note line, or nothing.
                Click a step to select it. The workshop then aims the next
                grip at that step. Shift-click extends the selection. Drag a
                step onto another step to reorder, or onto another group to
                move it there. A selected block moves together.
              </p>
              <ul>
                <li>
                  Hear plays that step with its feel and strum pattern. The
                  dice picks another shape of the same chord. Duplicate copies
                  the step. The ✕ on the grip clears it and leaves the step.
                  The corner ✕ removes the step and pulls the later chords
                  back. Empty steps can be inserted before or after a chord.
                </li>
                <li>
                  Beats run from 1 to 32. A chord starts at 4. A line’s length
                  comes from the written rhythm.
                </li>
                <li>
                  Feel is Strum, Arp ↑, or Arp ↓. Strum patterns are Down,
                  D-U, D-U-D-U, D-D-U, D-D-U-U-D-U, downs on the beat, and
                  three strums then a rest.
                </li>
                <li>
                  The octave menu shifts the grip up or down the neck. The
                  fret window can grow past the grip when a shape sits near
                  the edge.
                </li>
                <li>
                  Click a dot on the diagram to outline that note. A note
                  field sits under the grip.
                </li>
                <li>
                  Stack looks for a chord to put on top. Change stack swaps
                  it. Clearing the stack leaves the lower chord. While a stack
                  is open, Add to sequence in the workshop places the upper
                  grip on that same step.
                </li>
                <li>
                  A line step shows the melody on a staff. Click it to edit
                  the notes on the fretboard.
                </li>
              </ul>
            </Section>

            <Section id="progression" title="Next chord">
              <p>
                With a key set, the Progression grid lists a next chord for
                each scale degree. The rows are Diatonic, Sixths, V7 of, II-7
                of, IIø7 of, subV7, Chromatic, Borrowed, and Passing. Click a
                cell and the workshop opens on a grip for that symbol. The
                grid can be collapsed.
              </p>
              <p>
                Key set to None offers key-center suggestions from the chords
                already in the group, instead of the grid.
              </p>
            </Section>

            <Section id="v-system" title="V-System">
              <p>
                The workshop’s V-System tab is Ted Greene’s fourteen four-note
                groups, V-1 through V-14. Each group is a chord-tone gap
                pattern, from four-way close to the wide drops. Click a group
                to open its inversions. Drag a group card onto the sequence to
                drop that shape on a step.
              </p>
              <p>
                Type a symbol, or build one with the quality chips and the
                interval picker. The voice ladder shows how the four voices
                sit. Inversions are root, 1st, 2nd, and 3rd. Position on the
                neck lists fingerings; Show big stretches reveals the wider
                ones. Cross-string lists grips that reach across a string.
              </p>
              <ul>
                <li>Hear plays the selected grip.</li>
                <li>
                  Add to sequence writes it onto the selected step, or appends
                  a step when nothing is selected.
                </li>
                <li>
                  All grips opens the full catalog for a four-note chord.
                  Choosing one loads it into the workshop; adding one also
                  puts it in the sequence.
                </li>
              </ul>
            </Section>

            <Section id="triads" title="Triads">
              <p>
                Triads uses the same hear, add, and drag flow for three-note
                grips. The groups are Close (packed voices), Spread (a tenth
                between the outer notes), and Wide (a close pair an octave
                above the bass). The symbol field expects a triad, such as
                E-. A chord with no third or suspended note and no fifth has
                nothing to voice here.
              </p>
            </Section>

            <Section id="build" title="Build">
              <p>
                Build draws a grip that is not one of the named groups.
              </p>
              <ul>
                <li>
                  Shape: pick a root, then click frets. Mute playback when
                  clicking frets keeps the clicks quiet. Add sends the shape
                  to the sequence.
                </li>
                <li>
                  Line: click frets to place melody notes. Lengths are whole,
                  half, quarter, eighth, sixteenth, and thirty-second.
                  Tuplets are 3, 5, 6, and 7. A rest takes a duration with no
                  pitch, and a note can carry extra stacked pitches. The staff
                  updates as you write. Add places the line on a step, where
                  it can be reopened on the fretboard. The neck pages in
                  twelve-fret windows, up to the 24th fret.
                </li>
              </ul>
            </Section>

            <Section id="settings" title="Settings">
              <p>
                Config holds the switches that change what you see on a grip.
                They are remembered in this browser.
              </p>
              <ul>
                <li>
                  New in next chord marks pitches that show up in the
                  following chord, on the diagram and in the workshop.
                </li>
                <li>
                  Chord tones near the grip draws a lick outline of chord
                  tones around the fingering.
                </li>
                <li>
                  Circle of fifths draws the circle on a group that has a key,
                  and in the workshop. The group key and the current chord are
                  marked. Clockwise is sharper.
                </li>
                <li>
                  Playback volume sets the level for every chord, line, and
                  sequence. Test plays an open G so you can hear it.
                </li>
                <li>
                  Notebook page chooses the paper: Cream, Legal, Staff, or
                  Night. The same switch sits in the Notebook header.
                </li>
              </ul>
            </Section>

            <Section id="notebook" title="Notebook">
              <p>
                Notebook replaces the workshop with a full-page reading of the
                sequence, and asks the browser to go fullscreen. Play still
                runs. The paper style can be changed without leaving the
                view. Exit, or Escape, returns to the sequence. Escape leaves
                the notebook alone while the browser is already fullscreen for
                another reason.
              </p>
            </Section>

            <Section id="songs" title="Songs">
              <p>
                Songs lists every sequence on this browser. Search filters the
                list. New starts an empty sequence. Open switches to one.
                Duplicate copies it. Delete asks first, then removes it. The
                list is paged.
              </p>
              <ul>
                <li>JSON downloads that one sequence.</li>
                <li>Backup all downloads the library.</li>
                <li>
                  Import reads a JSON file and adds those sequences beside the
                  ones already here.
                </li>
              </ul>
              <p>
                The library is stored in this browser. Clearing site data
                removes it, so a backup file is the copy that travels.
              </p>
            </Section>
          </article>
        </div>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  children: ReactNode
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-cosmos-300 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
