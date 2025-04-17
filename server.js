const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
const ADMIN_SECRET = "pizza123"; // your admin login token

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;

  socket.on("admin login", (token) => {
    if (token === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      socket.emit("admin confirmed");
    }
  });

  socket.on('chat message', (msg) => {
    if (typeof msg !== 'string' || !msg.trim()) return;

    const publicMsg = { text: msg };
    const msgWithIP = { text: msg, ip };

    io.sockets.sockets.forEach((s) => {
      if (adminSockets.has(s.id)) {
        s.emit('chat message', msgWithIP);
      } else {
        s.emit('chat message', publicMsg);
      }
    });

    db.ref('messages').push(publicMsg);
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
