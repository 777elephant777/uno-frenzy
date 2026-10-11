# 🃏 UNO FRENZY

A chaotic, arcade-style UNO variant — **100% static website**. No servers, no build step, no dependencies.

> Every card is YELLOW. Match by number, throw action cards, charge the Chaos Frenzy Meter, mash through Sudden Card Battles — and empty your hand first.

## 🎮 Play

- **VS CPU** — you vs a bot: `EASY` / `CHAOTIC` / `INSANE`
- **LOCAL PVP** — 2–4 players on one device (hot-seat). The screen hides your hand between turns: **pass the device** when the gate shows up. Mix in CPU seats if you're short on friends.

Career stats (wins, losses, streaks, battles won) are saved in your browser's localStorage for every player name.

## 📦 Files

| File | What it is |
|---|---|
| `index.html` | The whole app markup |
| `style.css` | Neo-brutalist styling (yellow / black / hard shadows) |
| `script.js` | Game engine — deck, rules, AI, chaos events, battle mini-game, sounds (Web Audio), stats |

## 🚀 Deploy to GitHub Pages

1. Create a new repository on GitHub.
2. Copy **`index.html`, `style.css`, `script.js`** (and this README) into it.
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
4. Your game is live at `https://<username>.github.io/<repo>/` in about a minute.

No Node, no install, no build — the site also works if you just double-click `index.html`.

## 📖 Rules in 20 seconds

- Number on number → **same number**. Action cards are **always playable**.
- `SKIP`, `REVERSE` (2-player: you go again), `+2`, `MEGA +4`, `SWAP` hands, `WILDFIRE` (everyone draws 1), `SHIELD` (blocks your next forced draw, then breaks), `BATTLE` (3-second tap war — loser draws 4).
- Every card played charges the **Chaos Frenzy Meter** (+8%). At 100% a random chaos event hits everyone.
- First to empty their hand wins. Zero mercy.
