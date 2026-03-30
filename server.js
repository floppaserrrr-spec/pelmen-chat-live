const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname)); 

let users = {}; 
let allMessages = []; // Наш временный Data Store в памяти

io.on('connection', (socket) => {
    socket.on('join room', (data) => {
        const { roomId, name } = data;
        socket.join(roomId);
        users[socket.id] = { name: name || "Аноним", room: roomId };

        // При входе выдаем последние 50 сообщений ИМЕННО ЭТОЙ комнаты
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

        // Сохраняем в память сервера, если это не личка
        if (!msgData.isPrivate) {
            allMessages.push(msgData);
            if (allMessages.length > 500) allMessages.shift(); // Чтобы сервер не лопнул
        }

        if (data.to) {
            io.to(data.to).emit('chat message', msgData);
            socket.emit('chat message', msgData);
        } else {
            io.to(user.room).emit('chat message', msgData);
        }
    });

    // Код звонков (без изменений)
    socket.on('call user', (data) => io.to(data.to).emit('incoming call', { from: socket.id, offer: data.offer, fromName: data.fromName }));
    socket.on('accept call', (data) => io.to(data.to).emit('call accepted', { answer: data.answer }));
    socket.on('ice-candidate', (data) => { if (data.to) io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.id }); });
    socket.on('end call', (data) => { if (data.to) io.to(data.to).emit('call ended'); });

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
http.listen(PORT, () => console.log('DataStore Server Live'));