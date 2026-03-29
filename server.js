const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {}; 

io.on('connection', (socket) => {
    socket.on('login', (username) => {
        users[socket.id] = username;
        io.emit('updateUserList', users);
        console.log(`${username} вошел в сеть`);
    });

    socket.on('message', (data) => {
        io.emit('message', data);
    });

    socket.on('call-user', (data) => {
        socket.to(data.to).emit('call-made', {
            offer: data.offer,
            socket: socket.id,
            from: users[socket.id]
        });
    });

    socket.on('make-answer', (data) => {
        socket.to(data.to).emit('answer-made', {
            socket: socket.id,
            answer: data.answer
        });
    });

    socket.on('reject-call', (data) => {
        socket.to(data.to).emit('call-rejected');
    });

    socket.on('hangup', (data) => {
        socket.to(data.to).emit('hangup-received');
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('updateUserList', users);
    });
});

server.listen(3000, () => console.log('🚀 PELMEN-SERVER LIVE ON PORT 3000'));