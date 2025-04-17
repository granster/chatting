const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Load Firebase service key
const serviceAccount = require('/etc/secrets/serviceAccountKey.json'); // If local, use './serviceAccountKey.json'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://chatting-f4972-default-rtdb.firebaseio.com'
});

const db = admin.database();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Admin setup
const adminSockets = new Set();
const ADMIN_SECRET = 'pizza123'; // change this

io.on('connection', (socket) => {
  // ✅ Get real IP (cloud/load balancers may give a list)
  const rawIP = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;
  const ip = rawIP.split(',')[0].trim();

  // 🔐 Admin login
  socket.on('admin login', (token) => {
    if (token === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      socket.emit('admin confirmed');
    }
  });

  // 💬 Incoming chat message
  socket.on('chat message', (msg) => {
    if (typeof msg !== 'string' || !msg.trim()) return;

    const messageWithIP = { text: msg, ip };
    const messageWithoutIP = { text: msg };

    // Send to all clients — include IP for admins only
    io.sockets.sockets.forEach((s) => {
      const payload = adminSockets.has(s.id) ? messageWithIP : messageWithoutIP;
      s.emit('chat message', payload);
    });

    // ✅ Save full message to Firebase
    db.ref('messages').push(messageWithIP);
  });

  // 🔌 Handle disconnect
  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
