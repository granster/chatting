const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Use this on Render, or './serviceAccountKey.json' locally
const serviceAccount = require('/etc/secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://chatting-f4972-default-rtdb.firebaseio.com'
});
const db = admin.database();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const adminSockets = new Set();
const ADMIN_SECRET = "pizza123"; // Change to your preferred secret

io.on('connection', (socket) => {
  // 🔒 Get first IP (Cloudflare + Render may give a list)
  const rawIP = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;
  const ip = rawIP.split(',')[0].trim();

  // 🔐 Handle admin login
  socket.on("admin login", (token) => {
    if (token === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      socket.emit("admin confirmed");
    }
  });

  // 💬 Message handling
  socket.on('chat message', (msg) => {
    if (typeof msg !== 'string' || !msg.trim()) return;

    const messageWithIP = { text: msg, ip };

    io.sockets.sockets.forEach((s) => {
      const isAdmin = adminSockets.has(s.id);
      s.emit('chat message', isAdmin ? messageWithIP : { text: msg });
    });

    // 💾 Store full message (including IP)
    db.ref('messages').push(messageWithIP);
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
