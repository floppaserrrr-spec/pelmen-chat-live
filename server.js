const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});
const path = require('path');

const PORT = process.env.PORT || 3000;

// Разрешаем серверу показывать все файлы в папке (картинки, стили, скрипты)
app.use(express.static(__dirname));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('Пользователь зашел в чат! 🥟');

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg); // Рассылаем всем
  });

  socket.on('disconnect', () => {
    console.log('Кто-то ушел кушать пельмени... 💨');
  });
});

http.listen(PORT, () => {
  console.log(`🚀 СЕРВЕР ПЕЛЬМЕНЕЙ ЗАПУЩЕН НА ПОРТУ ${PORT}`);
});