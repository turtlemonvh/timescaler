# The fun bar

A written, checkable definition of "fun" for Timescaler.

Every line below is something a **7-year-old would notice**, and something an adult can **check by
eye in a two-minute play** — no instrumentation, no reading the code. If a line fails, the game is
not yet fun, however correct the maths is.

Lines are numbered `F1`..`F15` so pull requests can cite exactly which ones they move. The art
pipeline series (#91: #93 → #94 → #95 → #96 → #98 → #97) is scored against this list.

## Every answer

- **F1.** Something on screen reacts within a blink of the answer being submitted — before any words
  appear.
- **F2.** A correct answer moves the character **up by at least one body height**, and you can watch
  it travel rather than teleport.
- **F3.** A wrong answer never reads as punishment: there is a way to keep going, and nothing on
  screen says "game over".

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
- **F8.** The slip is visibly **smaller than a climb**: you can see in one glance that you lose less
  than you gain.
- **F9.** After a slip the character settles back into a ready pose within about a second; the game
  never stalls waiting on the player.

## Summit

- **F10.** Reaching the summit plays a **3-second dance with music**, not a static "you win" card.
- **F11.** The summit shows the peak just climbed with something on it that was not there before (a
  flag, a badge, a marker) — proof, not a message.

## Characters

- **F12.** Every animal is recognisable **by silhouette alone at 64 px**, with the colour removed.
- **F13.** Each character has at least four poses a child can name without labels: standing, moving,
  hurt, celebrating.

## Always-on motion

- **F14.** Something on screen is always moving during a climb, even while the player is thinking.
- **F15.** With `prefers-reduced-motion` set, every line above still communicates the same thing from
  a **static frame plus a label** — nothing becomes unreadable, and nothing keeps moving.
