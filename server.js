const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔐 Firebase Admin Setup using Render Secret File
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

io.on('connection', (socket) => {
  const ip =
    socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() ||
    socket.conn.remoteAddress;

  console.log('📡 New connection:', ip);

  // Send last 100 messages from Firebase
  db.ref('messages')
    .limitToLast(100)
    .once('value', (snapshot) => {
      const messages = [];
      snapshot.forEach((child) => messages.push(child.val()));
      socket.emit('history', messages);
    });

  // Handle new message
  socket.on('chat message', (text) => {
    if (typeof text !== 'string' || !text.trim()) return;

    const msg = {
      text: text.trim(),
      ip,
      timestamp: Date.now(),
    };

    db.ref('messages').push(msg); // store in Firebase
    io.emit('chat message', msg); // send to all clients
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', ip);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
