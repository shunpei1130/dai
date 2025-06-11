# 大富豪アプリ (Daifugo Game)

This repository contains a simple web-based card game written in HTML and JavaScript with a Node.js backend. The game simulates "大富豪" (Daifugo or President) for up to four players and allows human and CPU players to play together.

## Features

- **Front‑end**: `index.html` implements the game board and logic entirely in the browser. The game supports human players and CPU-controlled opponents, turn management, and rules such as 8-cut and suit binding.
- **Back‑end**: `server.js` uses Express and Socket.IO to deliver the client files and relay basic game events between connected clients.
- **Test**: `test/basic.test.js` includes a small example test using the Node.js `test` module.

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

- `index.html` – front‑end implementation of the Daifugo game
- `server.js` – Express/Socket.IO server for serving the game and handling messages
- `package.json` – Node.js project metadata and dependencies
- `test/basic.test.js` – example unit test

## Notes

`server.js` serves static files from a directory named `public`. If you change the directory structure, ensure that `index.html` is available under that path or modify the Express configuration accordingly.

