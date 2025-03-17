/**
 * シリーダンス プロトタイプ
 * メインサーバーファイル
 * 
 * このファイルは、アプリケーションのメインエントリーポイントとして機能し、
 * Express サーバーとSocket.IOの設定を行います。
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { handleSocketConnection } = require('./services/socketService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 基本的なルート
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// Socket.IO接続ハンドリング
io.on('connection', (socket) => {
  console.log('新しいユーザーが接続しました');
  handleSocketConnection(socket, io);
});

// サーバーの起動
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // すべてのネットワークインターフェースでリッスン
server.listen(PORT, HOST, () => {
  console.log(`サーバーが起動しました - ポート ${PORT}`);
  console.log(`ローカルアクセス: http://localhost:${PORT}`);
  console.log(`ネットワークアクセス: http://<あなたのIPアドレス>:${PORT}`);
}); 