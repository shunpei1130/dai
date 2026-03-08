# dai

Room-based Daifugo web app for Vercel.

## Local development

Run the Vercel local dev server:

```bash
npx vercel dev
```

Open `http://localhost:3000` in your browser.

## Environment variables

Redis is optional for local testing. If these are not set, the app falls back to in-memory room storage.

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Vercel preview and production deployments require Redis. Without it, room state is not shared across function invocations, so multiplayer rooms will disappear between requests.

## Project structure

- `index.html`, `styles.css`, `app.js`: frontend
- `api/*.js`: Vercel Functions
- `lib/game.js`: game logic
- `data/rules-config.json`: rules configuration
