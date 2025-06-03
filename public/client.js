// client.js
const boardDiv = document.getElementById('board');
const statusDiv = document.getElementById('status');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const boardSizeSelect = document.getElementById('boardSize');
const gameModeSelect = document.getElementById('gameMode');
const clickSound = document.getElementById('clickSound');
const restartBtn = document.getElementById('restartBtn');
const roleSelect = document.getElementById('role');

let socket = null;
let yourTurn = false;
let symbol = '';
let clientId = localStorage.getItem('clientId');
if (!clientId) {
  clientId = Math.random().toString(36).substr(2, 9);
  localStorage.setItem('clientId', clientId);
}

joinBtn.onclick = () => {
  const username = usernameInput.value.trim();
  const roomId = roomInput.value.trim();
  const role = roleSelect.value;
  const boardSize = parseInt(boardSizeSelect.value);
  const gameMode = gameModeSelect.value;
  if (!username || !roomId) return;

  socket = new WebSocket('ws://localhost:3000');

  socket.onopen = () => {
    // Send create or join request
    socket.send(JSON.stringify({
      type: 'join',
      clientId,
      username,
      roomId,
      role,
      boardSize: role === 'create' ? boardSize : undefined,
      gameMode: role === 'create' ? gameMode : undefined
    }));
    statusDiv.innerText = 'Waiting for opponent...';
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'start') {
      symbol = msg.symbol;

      // Always update local UI to match room settings
      boardSizeSelect.value = msg.boardSize;
      gameModeSelect.value = msg.gameMode;
    } else if (msg.type === 'update') {
      renderBoard(msg.board, msg.boardSize);
      yourTurn = msg.yourTurn;
      const nameInfo = `You are "${symbol}"`;
      if (msg.winner) {
        if (msg.winner === 'draw') {
          statusDiv.innerText = 'Draw!';
        } else {
          const you = usernameInput.value.trim();
          const opponent = msg.usernames.find(name => name !== you);
          if (msg.result === 'win') {
            statusDiv.innerText = `You (${you}) win! 🎉`;
            launchConfetti();  // 🎉 Confetti
          } else {
            statusDiv.innerText = `You (${you}) lose. ${opponent} wins! 😢`;
            showSadEmoji();    // 😢 Sad face animation
          }
        }
        restartBtn.style.display = 'inline-block';
      } else {
        statusDiv.innerText = `${nameInfo} — ${yourTurn ? 'Your turn' : 'Opponent\'s turn'}`;
        restartBtn.style.display = 'none';
      }
    }
  };

  socket.onclose = () => {
    statusDiv.innerText = 'Disconnected';
  };
};

restartBtn.onclick = () => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'restart' }));
  }
};

function renderBoard(board, size = 3) {
  boardDiv.innerHTML = '';
  boardDiv.style.gridTemplateColumns = `repeat(${size}, 100px)`;
  board.forEach((cell, index) => {
    const div = document.createElement('div');
    div.className = 'cell';
    if (cell) {
      div.innerText = cell;
    } else {
      div.onclick = () => {
        if (yourTurn && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'move', index }));
          clickSound.play();
        }
      };
    }
    boardDiv.appendChild(div);
  });
}

function launchConfetti() {
  if (window.confetti) {
    const duration = 2 * 1000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }
}

function showSadEmoji() {
  const sad = document.createElement('div');
  sad.innerText = '😢';
  sad.style.fontSize = '5em';
  sad.style.position = 'fixed';
  sad.style.top = '50%';
  sad.style.left = '50%';
  sad.style.transform = 'translate(-50%, -50%)';
  sad.style.opacity = '0.8';
  sad.style.animation = 'fadeOut 3s ease-out forwards';

  document.body.appendChild(sad);

  setTimeout(() => {
    document.body.removeChild(sad);
  }, 3000);
}

// Fade-out keyframe
const style = document.createElement('style');
style.innerHTML = `
@keyframes fadeOut {
  0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2); }
}`;
document.head.appendChild(style);
