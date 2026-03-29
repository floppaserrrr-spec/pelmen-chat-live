const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

// Хранилище пользователей: { socketId: nickname }
let users = {};

io.on('connection', (socket) => {
    console.log('Подключился: ' + socket.id);

    // 1. РЕГИСТРАЦИЯ НИКА
    socket.on('set nickname', (name) => {
        users[socket.id] = name;
        // Отправляем всем обновленный список имен
        io.emit('user list', users);
    });

    // 2. ЧАТ (Текст, Фото, ГС)
    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });

    // 3. ЗВОНКИ (WebRTC Signaling)
    
    // Кто-то нажал "Позвонить"
    socket.on('call user', (data) => {
        if (data.to) {
            io.to(data.to).emit('incoming call', { 
                from: socket.id, 
                offer: data.offer, 
                fromName: data.fromName 
            });
        }
    });

    // Кто-то нажал "Ответить"
    socket.on('accept call', (data) => {
        if (data.to) {
            io.to(data.to).emit('call accepted', { 
                answer: data.answer 
            });
        }
    });

    // Кто-то нажал "Сбросить" или "Завершить"
    socket.on('end call', (data) => {
        if (data.to) {
            io.to(data.to).emit('call ended');
        }
    });

    // 4. ОТКЛЮЧЕНИЕ
    socket.on('disconnect', () => {
        console.log('Отключился: ' + socket.id);
        delete users[socket.id];
        io.emit('user list', users);
    });
});

// Порт для Render
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log('Сервер Pelmen Connect запущен на порту ' + PORT);
});