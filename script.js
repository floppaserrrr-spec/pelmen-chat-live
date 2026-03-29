const socket = io('https://pelmen-chat-xxxx.onrender.com');
const nick = prompt("Ваш ник:");
let pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
let currentCallWith = null;
let myStream = null;

socket.emit('login', nick);

socket.on('updateUserList', (users) => {
    const list = document.getElementById('user-list');
    list.innerHTML = '';
    for (const [id, name] of Object.entries(users)) {
        if (id !== socket.id) {
            list.innerHTML += `<div class="user-item"><span>${name}</span><button class="call-btn" onclick="callUser('${id}')">📞</button></div>`;
        }
    }
});

function send() {
    const inp = document.getElementById('inp');
    if (inp.value.trim()) {
        socket.emit('message', { user: nick, text: inp.value });
        inp.value = "";
    }
}

socket.on('message', (data) => {
    const chat = document.getElementById('chat');
    const div = document.createElement('div');
    div.className = `msg ${data.user === nick ? 'sent' : 'recv'}`;
    div.innerHTML = `<b>${data.user}:</b> ${data.text}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
});

// ЗВОНКИ
async function callUser(id) {
    currentCallWith = id;
    myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    myStream.getTracks().forEach(track => pc.addTrack(track, myStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call-user', { offer, to: id });
    document.getElementById('status').innerText = "Звоним...";
}

socket.on('call-made', async (data) => {
    currentCallWith = data.socket;
    document.getElementById('caller-name').innerText = data.from;
    document.getElementById('call-screen').style.display = 'flex';
    incomingCallOffer = data.offer;
});

async function acceptCall() {
    document.getElementById('call-screen').style.display = 'none';
    myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    myStream.getTracks().forEach(track => pc.addTrack(track, myStream));

    await pc.setRemoteDescription(incomingCallOffer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('make-answer', { answer, to: currentCallWith });
    showHangup();
}

socket.on('answer-made', async (data) => {
    await pc.setRemoteDescription(data.answer);
    showHangup();
});

function showHangup() {
    document.getElementById('status').innerText = "📞 В ЭФИРЕ";
    document.getElementById('hangup-btn').style.display = 'block';
}

function hangUp() {
    socket.emit('hangup', { to: currentCallWith });
    stopCall();
}

socket.on('hangup-received', () => {
    stopCall();
    alert("Собеседник завершил звонок");
});

function stopCall() {
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    pc.close();
    location.reload(); // Перезагрузка — самый надежный способ очистить P2P
}

function closeCallScreen() {
    document.getElementById('call-screen').style.display = 'none';
    socket.emit('reject-call', { to: currentCallWith });
}

pc.ontrack = (event) => {
    document.getElementById('remote-audio').srcObject = event.streams[0];
};

document.getElementById('inp').onkeydown = (e) => { if(e.key === 'Enter') send(); };