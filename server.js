// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Initialize Firebase Admin SDK (assume service account and config are set up)
// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json')),
//   databaseURL: "https://<your-project-id>.firebaseio.com"
// });
const db = admin.database();  // reference to Firebase Realtime Database

app.use(express.static('public'));  // Serve static files from the "public" directory

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Retrieve the last 100 messages from Firebase and send to the connected client
  db.ref('messages').limitToLast(100).once('value', (snapshot) => {
    const messages = [];
    snapshot.forEach(childSnap => {
      messages.push(childSnap.val());
    });
    // Send the history array to the client that just connected
    socket.emit('history', messages);
  });

  // Listen for new chat messages from this client
  socket.on('chat message', (text) => {
    const ipAddr = socket.handshake.address || "unknown";  // get client IP&#8203;:contentReference[oaicite:3]{index=3}
    const msgObject = {
      text: text,
      ip: ipAddr,
      timestamp: Date.now()
    };
    // Save the new message to Firebase (adds under 'messages' node with a unique key)
    db.ref('messages').push(msgObject);  // push generates a new child key in 'messages'
    // Broadcast the new message to all connected clients in real-time
    io.emit('chat message', msgObject);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
