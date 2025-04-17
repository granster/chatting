const adminSockets = new Set();
const ADMIN_SECRET = "pizza123"; // change this to your secret

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;

  // Admin login
  socket.on("admin login", (token) => {
    if (token === ADMIN_SECRET) {
      adminSockets.add(socket.id);
      socket.emit("admin confirmed");
    }
  });

  // Handle incoming messages
  socket.on('chat message', (msg) => {
    const messageForEveryone = { text: msg };
    const messageWithIP = { text: msg, ip: ip };

    // Send message with IP to admins only
    adminSockets.forEach(id => {
      const adminSocket = io.sockets.sockets.get(id);
      if (adminSocket) {
        adminSocket.emit('chat message', messageWithIP);
      }
    });

    // Send message without IP to everyone else
    io.sockets.sockets.forEach((s) => {
      if (!adminSockets.has(s.id)) {
        s.emit('chat message', messageForEveryone);
      }
    });

    // Save message (only plain version) to Firebase
    db.ref('messages').push(messageForEveryone);
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
  });
});
