import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './RoomManager';
import { SocketHandler } from './SocketHandler';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
    },
});

const roomManager = new RoomManager();
new SocketHandler(io, roomManager);

// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get room info endpoint
app.get('/api/room/:code', (req, res) => {
    const room = roomManager.getRoom(req.params.code);
    if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
    }
    res.json({ room: { code: room.code, playerCount: room.players.length, maxPlayers: room.maxPlayers, status: room.status } });
});

httpServer.listen(PORT, () => {
    console.log(`🃏 Daifugo Server running on port ${PORT}`);
});
