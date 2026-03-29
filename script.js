const socket = io('https://pelmen-chat.onrender.com');
const chat = document.getElementById('chat'), userList = document.getElementById('user-list');
const input = document.getElementById('inp'), nickInput = document.getElementById('nickname');
const remoteAudio = document.getElementById('remote-audio'), callScreen = document.getElementById('call-screen');
const recordBtn = document.getElementById('record-btn'), videoBtn = document.getElementById('video-note-btn');
const preview = document.getElementById('preview');

let localStream, peerConnection, targetUserId, mediaRecorder, chunks = [];
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

nickInput.onchange = () => socket.emit('set nickname', nickInput.value || "Zivo");

socket.on('user list', (users) => {
    userList.innerHTML = '';
    Object.keys(users).forEach(id => {
        if (id !== socket.id) {
            const el = document.createElement('div'); el.className = 'user-item';
            el.innerText = "👤 " + users[id];
            el.onclick = () => startCall(id, users[id]);
            userList.appendChild(el);
        }
    });
});

function send() {
    if (input.value.trim()) {
        socket.emit('chat message', { name: nickInput.value || "Zivo", type: 'text', msg: input.value });
        input.value = '';
    }
}

function sendFile() {
    const file = document.getElementById('file-input').files[0];
    if (!file) return;
    const reader = new FileReader();
    const type = file.type.startsWith('video/') ? 'video-file' : 'image';
    reader.onload = (e) => socket.emit('chat message', { name: nickInput.value || "Zivo", type: type, msg: e.target.result });
    reader.readAsDataURL(file);
}

async function startRec(type) {
    try {
        chunks = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video-note' });
        if (type === 'video-note') { preview.srcObject = stream; preview.style.display = 'block'; }
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: type === 'video-note' ? 'video/webm' : 'audio/ogg' });
            const reader = new FileReader();
            reader.onload = (e) => socket.emit('chat message', { name: nickInput.value || "Zivo", type: type, msg: e.target.result });
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop()); preview.style.display = 'none';
        };
        mediaRecorder.start();
    } catch (e) { alert("Ошибка оборудования"); }
}

recordBtn.onmousedown = () => { startRec('audio'); recordBtn.style.color = '#ff9900'; };
recordBtn.onmouseup = () => { if(mediaRecorder) mediaRecorder.stop(); recordBtn.style.color = 'white'; };
videoBtn.onmousedown = () => { startRec('video-note'); videoBtn.style.color = '#ff9900'; };
videoBtn.onmouseup = () => { if(mediaRecorder) mediaRecorder.stop(); videoBtn.style.color = 'white'; };

socket.on('chat message', (data) => {
    const div = document.createElement('div');
    let content = '';
    if (data.type === 'image') content = `<img src="${data.msg}" class="chat-media">`;
    else if (data.type === 'video-file') content = `<video src="${data.msg}" controls class="chat-media"></video>`;
    else if (data.type === 'video-note') content = `<video src="${data.msg}" class="video-circle" autoplay loop muted></video>`;
    else if (data.type === 'audio') content = `<audio src="${data.msg}" controls></audio>`;
    else content = `<span>${data.msg}</span>`;
    div.innerHTML = `<b style="color:#ff9900;">${data.name}:</b><br>${content}`;
    chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
});

async function startCall(id, name) {
    targetUserId = id; callScreen.style.display = 'flex';
    document.getElementById('caller-name').innerText = name;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    peerConnection.ontrack = e => remoteAudio.srcObject = e.streams[0];
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call user', { to: id, offer, fromName: nickInput.value || "Zivo" });
}

socket.on('incoming call', (data) => {
    window.lastOffer = data.offer; targetUserId = data.from;
    callScreen.style.display = 'flex';
    document.getElementById('caller-name').innerText = data.fromName;
    document.getElementById('answer-btn').style.display = 'inline-block';
});

async function answerCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    peerConnection.ontrack = e => remoteAudio.srcObject = e.streams[0];
    await peerConnection.setRemoteDescription(new RTCSessionDescription(window.lastOffer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('accept call', { to: targetUserId, answer });
    document.getElementById('answer-btn').style.display = 'none';
}

socket.on('call accepted', d => peerConnection.setRemoteDescription(new RTCSessionDescription(d.answer)));
function endCall() { socket.emit('end call', { to: targetUserId }); location.reload(); }
socket.on('call ended', () => location.reload());