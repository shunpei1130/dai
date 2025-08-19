# チンチロアプリ (Chinchiro Game)

This repository contains a simple web-based dice game written in HTML and JavaScript with a Node.js backend. The game simulates "チンチロ" (Chinchirorin) where a player rolls three dice and the combination determines the outcome.

## Features

- **Front‑end**: `public/index.html` implements the game board in the browser and uses `public/chinchiro.js` for dice rolling and evaluation.
- **Back‑end**: `server.js` uses Express to deliver the client files.
- **Test**: `test/basic.test.js` includes example tests for the dice evaluation logic using the Node.js `test` module.

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Launch the server

   ```bash
   node server.js
   ```

   The server listens on port `3000` by default. Access `http://localhost:3000/` in your browser to play.

3. Run tests

   ```bash
   npm test
   ```

## Files

- `public/index.html` – front‑end implementation of the Chinchiro game
- `public/chinchiro.js` – dice roll and evaluation logic
- `server.js` – Express server for serving the game
- `package.json` – Node.js project metadata and dependencies
- `test/basic.test.js` – unit tests for game logic

