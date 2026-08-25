# Whack-A-Dictator

A reaction game for the Elgato Stream Deck. Stylised portraits of world leaders keep
surfacing from a mountain of gold coins; hit the right ones before they duck back under.

## Credit where it is due

The idea of playing whack-a-mole on a Stream Deck comes from
[theca11/whack-a-mole](https://github.com/theca11/whack-a-mole) by theca11, and this
project owes that one the format, the difficulty ladder and the endless mode.

This is **not a fork**. It shares no code and no artwork with that project, and it is not
a derivative of it -- deliberately so, because its artwork is CC BY-NC-ND 4.0, which does
not permit derivatives. The game logic here is written from scratch against the Node.js
Stream Deck SDK v2, and the artwork is either drawn by `scripts/art.mjs` or built from the
portraits in `portraits/`. If you want the original, go and get it: it is on the Elgato
Marketplace and is the more polished plugin.

## About the portraits

Seven of the eight figures are pixel-art portraits of identifiable, living public
figures. The eighth, `A`, is an invented character -- a generic security-detail man in
shades -- and is not meant to be anybody.

All of them were produced with a generative image model to a brief. They were not drawn
by hand and not taken from anyone's existing artwork.

They are stylised rather than exaggerated -- these are recognisable likenesses, not
cartoon caricatures, so the wide latitude that political cartooning enjoys is not
something this project leans on. The game is offered as political satire and asserts
nothing factual about anyone depicted. The title's "dictator" is a joke about the genre,
not a description of every person in the roster.

If that is not a line you want to be on, the build does not need these files: see
[Swapping the figures](#swapping-the-figures).

## The game

Eight figures surface, and telling them apart in the half-second they are up is the game.

| Figure | Worth | Odds |
| --- | --- | --- |
| `X` | +1 | 5 in 30 |
| `F` | +1 | 5 in 30 |
| `D` | +1 | 5 in 30 |
| `R` | +1 | 5 in 30 |
| `D2028` -- the red "2028" campaign cap | +3 | 4 in 30 |
| `A` -- dark suit and shades | -5 | 3 in 30 |
| `J` | -10 | 2 in 30 |
| `B` | -20 | 1 in 30 |

Four hits in five are worth points and one in five costs them; the more a figure costs, the
rarer it is. Scores can go negative, but a high score cannot -- a negative round simply
does not beat the standing best.

In **endless** mode the figures pay out in seconds on the clock instead of points, and the
round runs until the clock reaches zero. The values are the same numbers, so against a
10-second clock the -20 figure ends the round on the spot. Change the table in
`src/config.ts` if that is too sharp.

The values and the odds live in one table, `FIGURES` in
[src/config.ts](src/config.ts) -- edit it there and the artwork and the previews follow.
The settings panel shows the same list as a legend, with each figure's tile beside what it
is worth, so eight faces can be learned before a round rather than during one.

Four difficulties set how long a figure stays up before it ducks back under:

| Difficulty | Time up |
| --- | --- |
| Easy | 1000-1500 ms |
| Normal | 650-950 ms |
| Hard | 450-800 ms |
| Custom | Whatever you set, 200-5000 ms |

A high score is kept for every difficulty and round-length combination.

## Controls

Place the **Whack-A-Dictator** action on any key. Pressing it switches the device to the
game board.

On the board:

| Key | Press | Hold |
| --- | --- | --- |
| Start | Start a round | Cancel the round, or leave the board when idle |
| Difficulty / Timer | Next round length | Next difficulty |
| Score | Toggle between the last score and the high score | -- |
| Tiles | Whack | -- |

Difficulty, round length, the custom timing range and a high-score reset are also
available in the Difficulty / Timer key's settings panel.

## Supported devices

Game boards ship for Stream Deck (15 keys), Mini, XL, + and Neo. On any other device the
launcher key reports that the device is not supported; the actions themselves still work
if you lay out a board by hand.

## Installing

You do not need to build anything to play.

1. Download `com.goldenbunker.whackadictator.streamDeckPlugin` from the
   [Releases](../../releases) page.
2. Double-click it. Stream Deck asks whether to install; confirm.
3. Drag the **Whack-A-Dictator** action onto any key, then press that key. The device
   switches to the game board.

Stream Deck warns that the plugin is not from the Marketplace, because it is not: it is
installed directly and is not verified by Elgato. Say yes only if that is fine with you.

Needs the Stream Deck application 6.5 or newer, on Windows 10+ or macOS 12+.

The board is a profile the plugin installs on first use. To get back to your own layout,
hold the **Start** key while the board is idle.

## Building

Requirements:

- Node.js 20 or newer -- the version is only used to run the build; Stream Deck supplies
  its own Node 20 runtime to the plugin.
- The Stream Deck application 6.5 or newer, for `deploy`, `validate`, `pack` and `doctor`.
  `build`, `preview` and `face` run anywhere Node does.
- Windows 10+ or macOS 12+. Stream Deck itself runs nowhere else, and `deploy` refuses to.

```
npm install
npm run build      # artwork, profiles, then the plugin bundle
npm run typecheck  # TypeScript, no emit
npm run validate   # check the plugin against Elgato's rules
npm run deploy     # install into the local Stream Deck
npm run doctor     # report what is installed, logged and imported
npm run pack       # produce a .streamDeckPlugin file
```

`npm run watch` re-bundles `src/` on every change and then runs `npm run deploy`. Changes
to `scripts/art.mjs`, to the portraits or to the profile layouts are not covered by the
bundler's watch -- run `npm run build && npm run deploy` for those.

`npm run deploy` stops just this plugin through Stream Deck's own CLI, replaces the files
and starts it again; the application and every other plugin keep running, and the reload
picks up a changed manifest and changed profiles. It does not try to close Stream Deck --
the application is often installed to run elevated, in which case a `taskkill` from an
ordinary shell is refused silently and the copy then fails on a locked folder.

### How the build fits together

| Step | What it does |
| --- | --- |
| `npm run assets` | Renders `scripts/art.mjs` and the `portraits/` files into key images, icons and the plugin icon. |
| `npm run profiles` | Writes the five `.streamDeckProfile` game boards. |
| `rollup -c` | Bundles `src/` into `bin/plugin.js`. |

Both generators are deterministic: the coin scatter uses a seeded PRNG and profile
identifiers are hashes of their names, so rebuilding produces identical files.

`scripts/roster.mjs` reads the `FIGURES` table back out of `src/config.ts`, so the build
names the tile images and orders them from the same list the game scores from. Two files
are hand-written and cannot follow automatically -- the manifest's tile states and the
settings panel's scoring legend -- so `npm run assets` compares both against the roster and
fails rather than ship artwork that shows the wrong face or a legend that quotes the wrong
number.

### Swapping the figures

The roster is data, not code. To add, drop or replace a figure:

1. Edit the `FIGURES` table in `src/config.ts` -- id, points, weight.
2. Put a square `<id>.png` in `portraits/`. Draw it on a flat blue field: the cut-out
   flood-fills inwards from the border, so anything blue that touches an edge is removed
   and anything the figure encloses survives. Frame it like the existing ones, head near
   the top and shoulders running off the bottom edge.
3. Add or remove the matching `imgs/tiles/<id>` state on the tile action in
   `manifest.json`, its row in the legend in `ui/timer.html`, and -- if the figure count
   changed -- the `repeat(8, 1fr)` column count in `ui/pi.css`.
4. Run `npm run assets`. It compares the manifest and the legend rows against the roster
   and names whatever you missed rather than shipping a board that shows the wrong face.
   The `pi.css` column count is the one place it does not check, because a legend with
   the wrong number of columns is ugly rather than wrong.

Replacing all eight is a supported thing to do -- put your own portraits in and the game
is yours. `npm run preview` renders a contact sheet to check how they read at key size.

Everything under `com.goldenbunker.whackadictator.sdPlugin/` except `manifest.json`,
`ui/` and `THIRD-PARTY-NOTICES.md` is generated -- edit the sources in `src/` and
`scripts/`, not the output.

## Layout

```
portraits/               the eight source portraits, one <id>.png per figure
src/                     plugin sources (TypeScript)
  plugin.ts              entry point
  game.ts                board state, round clock, scoring
  config.ts              game constants, the FIGURES table, the settings shape
  press.ts               short-press / long-press handling
  actions/               one file per Stream Deck action
scripts/
  art.mjs                every vector drawing in the plugin
  assets.mjs             the list of artwork files, and which figure fronts the plugin
  roster.mjs             the FIGURES table, read back out of src/config.ts
  figures.mjs            cuts a portrait out of its blue backing field
  tiles.mjs              composites a portrait into the coin hoard
  build-assets.mjs       art + portraits -> SVG/PNG, and the roster drift checks
  build-profiles.mjs     game board profiles
  build-notices.mjs      THIRD-PARTY-NOTICES.md, derived from package-lock.json
  zip.mjs                minimal ZIP writer for the profiles
  deploy.mjs             install into the local Stream Deck
  doctor.mjs             report what is installed, logged and imported
  preview.mjs            contact sheet of every tile
  preview-face.mjs       the same figures cropped to the head, for checking framing
com.goldenbunker.whackadictator.sdPlugin/
  manifest.json          plugin definition
  ui/                    settings panel
  THIRD-PARTY-NOTICES.md licences of the code bundled into bin/plugin.js
  bin/ imgs/ profiles/   generated
```

## Notes

- The plugin makes no network requests. Game settings and high scores go to Stream Deck's
  own settings store; the only other thing it writes is a rolling log inside its own
  plugin folder, which records the names of the connected devices when it starts.
- The settings panel talks to Stream Deck directly rather than loading a component library
  from a CDN, so it works with no internet connection.
- Not distributed through the Elgato Marketplace. Install from the Releases page.

## License

MIT -- see [LICENSE](LICENSE) -- for the code and for the artwork `scripts/art.mjs`
draws: the coin hoard, the HUD backdrops and the action icons. Help yourself: play it,
fork it, take pieces into your own projects, sell whatever you build.

The eight portraits in `portraits/` sit outside that grant, along with everything the
build composites from them (`imgs/tiles/*.png`, `imgs/keys/launcher*.png`,
`imgs/plugin/icon*.png`). They came out of a generative image model, and it is doubtful
that copyright subsists in AI output at all in most jurisdictions -- so no copyright
is asserted in them and none is granted. In practice, do as you like; we just will not
license what we may not own.

Two things that are easy to miss, and are spelled out in [LICENSE](LICENSE): the
composited tiles contain the drawn hoard as well as a portrait, and that half is
MIT-licensed regardless. And the portraits are recognisable likenesses of living public
figures -- personality rights are a separate body of law from copyright, and no licence
here grants you anything with respect to the people depicted. If that matters for your
use, swapping the figures is a supported operation.

Third-party code bundled into `bin/plugin.js` is also MIT; notices in
[THIRD-PARTY-NOTICES.md](com.goldenbunker.whackadictator.sdPlugin/THIRD-PARTY-NOTICES.md).
