const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

let players = [];
let gameState = Array(9).fill(null);
let currentPlayer = 0;
let startingPlayer = 0;
const clients = new Map();

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (let [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.every(cell => cell) ? 'draw' : null;
}

function broadcastGameState(winner = null) {
  players.forEach((p, index) => {
    p.ws.send(JSON.stringify({
      type: 'update',
      board: gameState,
      yourTurn: index === currentPlayer,
      symbol: index === 0 ? 'X' : 'O',
      winner,
    }));
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let message;
    try {
      message = JSON.parse(msg);
    } catch (e) {
      return;
    }

    if (message.type === 'join') {
      const { clientId } = message;
      clients.set(clientId, ws);

      let playerIndex = players.findIndex(p => p.clientId === clientId);

      if (playerIndex === -1 && players.length < 2) {
        playerIndex = players.length;
        players.push({ ws, clientId });
      } else if (playerIndex !== -1) {
        players[playerIndex].ws = ws;
      } else {
        ws.send(JSON.stringify({ type: 'full' }));
        return ws.close();
      }

      ws.send(JSON.stringify({ type: 'start', symbol: playerIndex === 0 ? 'X' : 'O' }));
      ws.playerIndex = playerIndex;

      if (players.length === 2) broadcastGameState();
    }

    if (message.type === 'move') {
      const { index } = message;
      const playerIndex = ws.playerIndex;

      if (playerIndex !== currentPlayer || gameState[index] || players.length < 2) return;

      gameState[index] = playerIndex === 0 ? 'X' : 'O';
      const winner = checkWinner(gameState);

      if (winner) {
        broadcastGameState(winner);
        setTimeout(() => {
          gameState = Array(9).fill(null);
          if (winner === 'draw') {
            startingPlayer = 1 - currentPlayer;
          } else {
            startingPlayer = (winner === 'X') ? 0 : 1;
          }
          currentPlayer = startingPlayer;
          broadcastGameState();
        }, 3000);
      } else {
        currentPlayer = 1 - currentPlayer;
        broadcastGameState();
      }
    }
  });

  ws.on('close', () => {
    players = players.filter(p => p.ws !== ws);
    gameState = Array(9).fill(null);
    currentPlayer = 0;
    players.forEach(p => p.ws.send(JSON.stringify({ type: 'reset' })));
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
