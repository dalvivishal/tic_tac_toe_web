
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

let rooms = new Map();

function createRoom(roomId) {
  return {
    players: [],
    gameState: Array(9).fill(null),
    currentPlayer: 0,
    startingPlayer: 0,
    lastWinner: null
  };
}

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

function broadcastGameState(roomId, winner = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players.forEach((p, index) => {
    p.ws.send(JSON.stringify({
      type: 'update',
      board: room.gameState,
      yourTurn: index === room.currentPlayer,
      symbol: index === 0 ? 'X' : 'O',
      winner,
      usernames: room.players.map(pl => pl.username)
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
      const { clientId, username, roomId } = message;
      if (!rooms.has(roomId)) {
        rooms.set(roomId, createRoom(roomId));
      }

      const room = rooms.get(roomId);
      let playerIndex = room.players.findIndex(p => p.clientId === clientId);
      if (playerIndex === -1 && room.players.length < 2) {
        playerIndex = room.players.length;
        room.players.push({ ws, clientId, username });
      } else if (playerIndex !== -1) {
        room.players[playerIndex].ws = ws;
        room.players[playerIndex].username = username;
      } else {
        return ws.send(JSON.stringify({ type: 'full' }));
      }

      ws.playerIndex = playerIndex;
      ws.roomId = roomId;
      ws.send(JSON.stringify({ type: 'start', symbol: playerIndex === 0 ? 'X' : 'O' }));

      if (room.players.length === 2) {
        broadcastGameState(roomId);
      }
    }

    if (message.type === 'move') {
      const { index } = message;
      const room = rooms.get(ws.roomId);
      if (!room || room.players.length < 2) return;
      if (room.players[room.currentPlayer].ws !== ws || room.gameState[index]) return;

      room.gameState[index] = room.currentPlayer === 0 ? 'X' : 'O';
      const winner = checkWinner(room.gameState);
      if (winner) {
        room.lastWinner = winner;
        broadcastGameState(ws.roomId, winner);
        setTimeout(() => {
          room.gameState = Array(9).fill(null);
          if (winner === 'draw') {
            room.startingPlayer = 1 - room.currentPlayer;
          } else {
            room.startingPlayer = winner === 'X' ? 0 : 1;
          }
          room.currentPlayer = room.startingPlayer;
          broadcastGameState(ws.roomId);
        }, 2000);
      } else {
        room.currentPlayer = 1 - room.currentPlayer;
        broadcastGameState(ws.roomId);
      }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    if (room.players.length === 0) rooms.delete(ws.roomId);
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
