const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname)); 

let users = {}; 
let allMessages = []; // Наш Data Store

io.on('connection', (socket) => {
    socket.on('join room', (data) => {
        const { roomId, name } = data;
        socket.join(roomId);
        users[socket.id] = { name: name || "Аноним", room: roomId };

        // Отправляем историю этой комнаты при входе
        const roomHistory = allMessages
            .filter(m => m.room === roomId && !m.isPrivate)
            .slice(-50);
        socket.emit('load history', roomHistory);

        updateUserList(roomId);
    });

    socket.on('chat message', (data) => {
        const user = users[socket.id];
        if (!user) return;

        const msgData = { 
            ...data, 
            from: socket.id, 
            room: user.room, 
            isPrivate: !!data.to 
        };

        // Сохраняем в память, если это не личка
        if (!msgData.isPrivate) {
            allMessages.push(msgData);
            if (allMessages.length > 500) allMessages.shift();
        }

        if (data.to) {
            io.to(data.to).emit('chat message', msgData);
            socket.emit('chat message', msgData);
        } else {
            io.to(user.room).emit('chat message', data);
        }
    });

    // --- ЗВОНКИ ---
    socket.on('call user', (d) => io.to(d.to).emit('incoming call', { from: socket.id, offer: d.offer, fromName: d.fromName }));
    socket.on('accept call', (d) => io.to(d.to).emit('call accepted', { answer: d.answer }));
    socket.on('ice-candidate', (d) => { if (d.to) io.to(d.to).emit('ice-candidate', { candidate: d.candidate, from: socket.id }); });
    socket.on('end call', (d) => { if (d.to) io.to(d.to).emit('call ended'); });

    function updateUserList(roomId) {
        const roomUsers = {};
        for (const id in users) { if (users[id].room === roomId) roomUsers[id] = users[id].name; }
        io.to(roomId).emit('user list', roomUsers);
    }
    socket.on('disconnect', () => {
        const roomId = users[socket.id]?.room;
        delete users[socket.id];
        if (roomId) updateUserList(roomId);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Pelmen DataStore Live'));