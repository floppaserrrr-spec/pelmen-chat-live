const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected 🥟');
    
    socket.on('chat message', (data) => {
        // Пересылаем всем (и ник, и сообщение)
        io.emit('chat message', data);
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});