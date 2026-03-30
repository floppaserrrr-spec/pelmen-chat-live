const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname)); 

let users = {};

io.on('connection', (socket) => {
    socket.emit('user list', users);

    socket.on('set nickname', (name) => {
        users[socket.id] = name || "Аноним";
        io.emit('user list', users);
    });

    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });

    // --- ЛОГИКА ЗВОНКОВ (ICE + WebRTC) ---
    socket.on('call user', (data) => {
        io.to(data.to).emit('incoming call', { 
            from: socket.id, 
            offer: data.offer, 
            fromName: data.fromName 
        });
    });

    socket.on('accept call', (data) => {
        io.to(data.to).emit('call accepted', { answer: data.answer });
    });

    socket.on('ice-candidate', (data) => {
        if (data.to) {
            io.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
        }
    });

    socket.on('end call', (data) => {
        if (data.to) io.to(data.to).emit('call ended');
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('user list', users);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server running on port ' + PORT));