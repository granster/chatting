const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔐 Firebase Admin Setup (path depends on Render or local)
const serviceAccount = require('/etc/secrets/serviceAccountKey.json'); // change to './serviceAccountKey.json' locally

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://chatting-f4972-default-rtdb.firebaseio.com'
});

const db = admin.database();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  const ip =
    socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
    socket.conn.remoteAddress;

  console.log('📡 New connection:', ip);

  // Send last 100 messages for default channel (text) on connect
  db.ref('messages/text')
    .limitToLast(100)
    .once('value', (snapshot) => {
      const messages = [];
      snapshot.forEach((child) => messages.push(child.val()));
      socket.emit('history', messages);
    });

  socket.on('chat message', (data) => {
    const { text, channel } = data;
    if (typeof text !== 'string' || !text.trim()) return;

    const msg = {
      text: text.trim(),
      ip,
      timestamp: Date.now(),
    };

    const path = channel || 'text';
    db.ref(`messages/${path}`).push(msg);
    io.emit('chat message', msg);
  });

  socket.on('admin login', (token) => {
    if (token === 'pizza123') {
      socket.emit('admin confirmed');
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', ip);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
