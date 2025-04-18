const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔐 Secure key file — use Render path or local
const serviceAccount = require('/etc/secrets/serviceAccountKey.json'); // or './serviceAccountKey.json'

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
const ADMIN_SECRET = "pizza123";

io.on('connection', (socket) => {
  const rawIP = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;
  const ip = rawIP.split(',')[0].trim();

  socket.on("admin login", (token) => {
    if (token === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      socket.emit("admin confirmed");
    }
  });

  socket.on('chat message', (msg) => {
    if (typeof msg !== 'string' || !msg.trim()) return;

    const fullMessage = {
      text: msg,
      ip,
      timestamp: Date.now()
    };

    io.emit('chat message', fullMessage);
    db.ref('messages').push(fullMessage);
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
