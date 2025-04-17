const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Replace this if using Render secret path
const serviceAccount = require('/etc/secrets/serviceAccountKey.json'); // <-- or './serviceAccountKey.json' locally

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
const ADMIN_SECRET = "pizza123"; // change this if needed

io.on('connection', (socket) => {
  // ✅ Clean first IP only
  const rawIP = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;
  const ip = rawIP.split(',')[0].trim();

  // 🔐 Admin login handler
  socket.on("admin login", (token) => {
    if (token === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      socket.emit("admin confirmed");
    }
  });

  // 💬 Message handler
  socket.on('chat message', (msg) => {
    if (typeof msg !== 'string' || !msg.trim()) return;

    const publicMsg = { text: msg };
    const msgWithIP = { text: msg, ip };

    // 🔄 Emit correct version to each socket
    io.sockets.sockets.forEach((s) => {
      const isAdmin = adminSockets.has(s.id);
      const outgoing = isAdmin ? msgWithIP : publicMsg;
      s.emit('chat message', outgoing);
    });

    // 💾 Save public-safe version to Firebase
    db.ref('messages').push(publicMsg);
  });

  // 🧹 Cleanup on disconnect
  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
