const socket = new WebSocket(`ws://${location.host}`);
const boardDiv = document.getElementById('board');
const statusDiv = document.getElementById('status');
let symbol = localStorage.getItem('symbol') || '';
let yourTurn = false;

let clientId = localStorage.getItem('clientId');
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem('clientId', clientId);
}

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({ type: 'join', clientId }));
});

socket.onmessage = (e) => {
  const msg = JSON.parse(e.data);

  if (msg.type === 'start') {
    symbol = msg.symbol;
    localStorage.setItem('symbol', symbol);
    setStatus('Waiting for opponent...');
  }

  if (msg.type === 'update') {
    updateBoard(msg.board);
    yourTurn = msg.yourTurn;
    setStatus(`You are ${msg.symbol}. ${msg.winner ? winnerMessage(msg.winner) : (yourTurn ? 'Your turn' : "Opponent's turn")}`);
  }

  if (msg.type === 'reset') {
    boardDiv.innerHTML = '';
    setStatus('Opponent disconnected. Waiting...');
  }
};

function updateBoard(board) {
  boardDiv.innerHTML = '';
  board.forEach((cell, index) => {
    const div = document.createElement('div');
    div.className = 'cell';
    div.textContent = cell || '';
    div.onclick = () => {
      if (!cell && yourTurn) {
        socket.send(JSON.stringify({ type: 'move', index }));
      }
    };
    boardDiv.appendChild(div);
  });
}

function setStatus(text) {
  statusDiv.textContent = text;
}

function winnerMessage(winner) {
  return winner === 'draw' ? "It's a draw!" : `${winner} wins!`;
}