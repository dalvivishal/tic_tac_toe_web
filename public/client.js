// client.js
const boardDiv = document.getElementById('board');
const statusDiv = document.getElementById('status');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const clickSound = document.getElementById('clickSound');
const restartBtn = document.getElementById('restartBtn');

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
  if (!username || !roomId) return;

  socket = new WebSocket('ws://localhost:3000'); // Use your server's IP here
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'join', clientId, username, roomId }));
    statusDiv.innerText = 'Waiting for opponent...';
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'start') {
      symbol = msg.symbol;
    } else if (msg.type === 'update') {
      renderBoard(msg.board);
      yourTurn = msg.yourTurn;
      const nameInfo = `You are "${symbol}"`;
      if (msg.winner) {
        statusDiv.innerText = msg.winner === 'draw' ? 'Draw!' : `${msg.winner} wins!`;
        if (msg.winner !== 'draw') launchConfetti();
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

function renderBoard(board) {
  boardDiv.innerHTML = '';
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
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }
}
