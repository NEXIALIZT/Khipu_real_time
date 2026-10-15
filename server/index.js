const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Khipubase is alive');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log(`[+] Usuario conectado: ${socket.id}`);

  // Unirse a una sala específica
  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`[INFO] Usuario ${socket.id} se unió a la sala: ${roomCode}`);
  });

  // Salir de una sala
  socket.on('leave-room', (roomCode) => {
    socket.leave(roomCode);
    console.log(`[INFO] Usuario ${socket.id} abandonó la sala: ${roomCode}`);
  });

  // Manejador genérico de broadcast para replicar Supabase Channels
  socket.on('broadcast', (data) => {
    const { roomCode, event, payload } = data;
    
    // Validar formato mínimo
    if (!roomCode || !event) return;

    // Supabase { broadcast: { self: false } } -> socket.to(room).emit() no envía al remitente
    socket.to(roomCode).emit('broadcast', { event, payload });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Usuario desconectado: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================`);
  console.log(`🚀 Khipubase Server is running!`);
  console.log(`📡 Listening on port: ${PORT}`);
  console.log(`===================================`);
});
