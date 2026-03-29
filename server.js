const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// Раздаем файлы (index, styles, script) из текущей папки
app.use(express.static(__dirname)); 

let users = {};

io.on('connection', (socket) => {
    // Регистрация ника
    socket.on('set nickname', (name) => {
        users[socket.id] = name || "Аноним";
        io.emit('user list', users);
    });

    // Пересылка сообщений (текст, фото, видео, ГС, кружочки)
    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });

    // Логика звонков
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

    socket.on('end call', (data) => {
        if (data.to) io.to(data.to).emit('call ended');
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('user list', users);
    });
});

// Порт для Render
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Pelmen Server Live on port ' + PORT));