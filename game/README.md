# Acorn Quest 🦊🌰

A cozy little 2D top-down adventure — a friendly Zelda-style game made to play
together. You're a small fox helping the woodland animals find their lost
acorns. There's no fighting and no way to lose: just explore, collect, and solve
gentle puzzles.

## How to play

- **Arrow keys** or **WASD** — walk
- **SPACE** (or **Enter** / **E**) — talk to animals, read signs, push crates,
  and open doors

## The adventure (v1)

Four little areas to explore:

1. **Sunny Meadow** — meet the rabbit, read a sign, gather acorns.
2. **Whispering Forest** — push the crate onto the round button to open the way.
3. **Cozy Cave** — find the key, then unlock the golden door.
4. **Hidden Hollow** — a friendly owl says thank you!

Your progress saves automatically in your browser. Pick **Continue** on the
title screen to keep going.

## Running it

Because the game uses JavaScript modules, it needs to be served over `http://`
rather than opened as a `file://`. From the repository root:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/game/game.html> in a browser.

## Make it your own

The whole point is to add to it together. Rooms are drawn like ASCII art in
plain text files — see **[AUTHORING.md](AUTHORING.md)** for a kid-friendly guide
to building a new room.

## Notes

- Pure vanilla HTML/CSS/JavaScript — no build step, no installs, no dependencies.
- Saves to your browser only, under the key `animalAdventure_v1`. It never
  touches the finance app in this repo.
