const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname)); 

let users = {}; 

io.on('connection', (socket) => {
    socket.on('join room', (data) => {
        const { roomId, name } = data;
        socket.join(roomId);
        users[socket.id] = { name: name || "Аноним", room: roomId };
        updateUserList(roomId);
    });

    socket.on('chat message', (data) => {
        const user = users[socket.id];
        if (!user) return;
        if (data.to) {
            io.to(data.to).emit('chat message', { ...data, from: socket.id, isPrivate: true });
            socket.emit('chat message', { ...data, from: socket.id, isPrivate: true });
        } else {
            io.to(user.room).emit('chat message', data);
        }
    });

    socket.on('call user', (data) => io.to(data.to).emit('incoming call', { from: socket.id, offer: data.offer, fromName: data.fromName }));
    socket.on('accept call', (data) => io.to(data.to).emit('call accepted', { answer: data.answer }));
    socket.on('ice-candidate', (data) => { if (data.to) io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.id }); });
    socket.on('end call', (data) => { if (data.to) io.to(data.to).emit('call ended'); });

    function updateUserList(roomId) {
        const roomUsers = {};
        for (const id in users) {
            if (users[id].room === roomId) roomUsers[id] = users[id].name;
        }
        io.to(roomId).emit('user list', roomUsers);
    }

    socket.on('disconnect', () => {
        const roomId = users[socket.id]?.room;
        delete users[socket.id];
        if (roomId) updateUserList(roomId);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Pelmen Server Live'));