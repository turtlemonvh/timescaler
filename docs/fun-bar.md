# The fun bar

A written, checkable definition of "fun" for Timescaler.

Every line below is something a **7-year-old would notice**, and something an adult can **check by
eye in a two-minute play** — no instrumentation, no reading the code. If a line fails, the game is
not yet fun, however correct the maths is.

Lines are numbered so pull requests can cite exactly which ones they move. The numbers are stable
identifiers, not an ordering — a new line is added to whichever section it belongs in and takes the
next free number there, so `F16` and `F17` sit under **Falling** and **Always-on motion** rather than
at the end, and every citation in an earlier pull request stays valid. The art pipeline series (#91:
#93 → #94 → #95 → #96 → #98 → #97) is scored against this list.

## Every answer

- **F1.** Something on screen reacts within a blink of the answer being submitted — before any words
  appear.
- **F2.** A correct answer moves the character **up by at least one body height**, and you can watch
  it travel rather than teleport.
- **F3.** A *single* wrong answer never reads as punishment: you slip one step, the next question
  comes straight away, and nothing on screen scolds.

## Climbing

- **F4.** The climber's arms and legs change position between frames — you can tell which limb is
  reaching next.
- **F5.** The mountain behind the climber visibly moves as height is gained, so progress is felt,
  not just read off a number.
- **F6.** The character and the height readout always agree — the character is never parked while
  the number climbs.

## Slipping

- **F7.** A miss shows a **slip** — the character slides back down — with a distinct sound, within
  300 ms of the answer.
- **F8.** A regular climb and a regular slip are the same size — one position each — so a miss costs
  exactly what a correct answer earns. Getting ahead comes from the **boost**: with the boost meter
  full a correct answer moves two instead of one, and a miss empties the meter.
- **F9.** After a slip the character settles back into a ready pose within about a second; the game
  never stalls waiting on the player.

## Falling

- **F16.** Falling is a real outcome, and a child can see it coming: each miss visibly fills the
  fall-risk meter, so a fall reads as earned rather than random. After a fall you can start the peak
  again without leaving the screen.

## Summit

- **F10.** Reaching the summit plays a **3-second dance with music**, not a static "you win" card.
- **F11.** The summit shows the peak just climbed with something on it that was not there before (a
  flag, a badge, a marker) — proof, not a message.

## Characters

- **F12.** Every animal is recognisable **by silhouette alone at 64 px**, with the colour removed.
- **F13.** Each character has at least four poses a child can name without labels: standing, moving,
  hurt, celebrating.

## Always-on motion

- **F14.** Something on screen is always moving during a climb, even while the player is thinking —
  wind in the grass, a drifting cloud, a bird crossing the sky.
- **F15.** With `prefers-reduced-motion` set, every line above still communicates the same thing from
  a **static frame plus a label** — nothing becomes unreadable, and nothing keeps moving.
- **F17.** The mountain feels inhabited: in a two-minute climb you see at least one creature that
  isn't your character — a bird, lizard, goat, or snake — and it behaves like it lives there
  (crossing, basking, scattering) rather than looping in place as decoration.
