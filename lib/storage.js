const { randomUUID } = require("crypto");

const ROOM_TTL_SECONDS = 60 * 60 * 24 * 7;
const memoryStore = globalThis.__DAIFUGO_ROOM_STORE__ || new Map();
globalThis.__DAIFUGO_ROOM_STORE__ = memoryStore;

class StorageConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "StorageConfigError";
    this.statusCode = 503;
  }
}

function getRedisConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_REST_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function isHostedVercelEnvironment() {
  if (process.env.VERCEL_URL) {
    return true;
  }

  return process.env.VERCEL === "1" && ["preview", "production"].includes(process.env.VERCEL_ENV || "");
}

function requireDurableStorage(config) {
  if (config || !isHostedVercelEnvironment()) {
    return;
  }

  throw new StorageConfigError(
    "Persistent Redis storage is required on Vercel preview/production deployments. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
  );
}

async function redisCommand(args) {
  const config = getRedisConfig();
  if (!config) {
    throw new StorageConfigError("Redis storage is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || "Redis request failed.");
  }

  return data.result;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

async function getRoom(roomId) {
  const config = getRedisConfig();
  requireDurableStorage(config);

  if (!config) {
    const record = memoryStore.get(roomId);
    if (!record) {
      return null;
    }

    if (record.expiresAt < Date.now()) {
      memoryStore.delete(roomId);
      return null;
    }

    return clone(record.room);
  }

  const raw = await redisCommand(["GET", `room:${roomId}`]);
  return raw ? JSON.parse(raw) : null;
}

async function saveRoom(room) {
  const prepared = clone(room);
  prepared.updatedAt = new Date().toISOString();
  const config = getRedisConfig();
  requireDurableStorage(config);

  if (!config) {
    memoryStore.set(room.id, {
      room: prepared,
      expiresAt: Date.now() + ROOM_TTL_SECONDS * 1000
    });
    return prepared;
  }

  await redisCommand([
    "SETEX",
    `room:${room.id}`,
    ROOM_TTL_SECONDS,
    JSON.stringify(prepared)
  ]);
  return prepared;
}

async function createRoomId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const config = getRedisConfig();
  requireDurableStorage(config);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let roomId = "";
    for (let index = 0; index < 6; index += 1) {
      roomId += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    const exists = config ? await getRoom(roomId) : memoryStore.has(roomId);
    if (!exists) {
      return roomId;
    }
  }

  return randomUUID().slice(0, 6).toUpperCase();
}

module.exports = {
  ROOM_TTL_SECONDS,
  StorageConfigError,
  createRoomId,
  getRoom,
  saveRoom
};
