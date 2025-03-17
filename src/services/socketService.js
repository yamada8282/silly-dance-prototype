/**
 * Socket.IOサーバーサイドハンドラ
 * 
 * このファイルは以下の機能を提供します：
 * - Socket.IO接続の管理
 * - セッション管理
 * - ポーズデータのブロードキャスト
 */

// アクティブセッション管理
const sessions = new Map();

// Socket接続管理関数
function handleSocketConnection(socket, io) {
  console.log(`新しい接続: ${socket.id}`);

  // セッション参加ハンドラ
  socket.on('join-session', (data) => {
    const { sessionId, userId } = data;

    // セッション作成/参加
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        users: new Map(),
        startTime: Date.now()
      });
    }

    const session = sessions.get(sessionId);

    // ユーザー情報記録
    session.users.set(userId, {
      socketId: socket.id,
      joinTime: Date.now(),
      lastActivity: Date.now()
    });

    // ルーム参加
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.userId = userId;

    // 全参加者に通知
    io.to(sessionId).emit('user-joined', {
      userId,
      userCount: session.users.size
    });

    // 現在のユーザーリストを送信
    socket.emit('session-users', {
      users: Array.from(session.users.keys())
    });

    console.log(`ユーザー ${userId} がセッション ${sessionId} に参加しました`);
  });

  // ポーズデータ受信ハンドラ
  socket.on('pose-data', (data) => {
    const { sessionId, userId, poseData } = data;

    if (!sessionId || !sessions.has(sessionId)) return;

    const session = sessions.get(sessionId);

    // アクティビティ時間更新
    if (session.users.has(userId)) {
      session.users.get(userId).lastActivity = Date.now();
    }

    // 同セッションの他のユーザーにブロードキャスト
    socket.to(sessionId).emit('receive-pose', {
      userId,
      poseData,
      timestamp: Date.now()
    });
  });
  
  // 音楽コントロールハンドラ
  socket.on('music-control', (data) => {
    const { sessionId, action, position } = data;
    
    if (!sessionId || !sessions.has(sessionId)) return;
    
    console.log(`音楽イベント: ${action} at ${position}秒 (セッション: ${sessionId})`);
    
    // 同セッションの全ユーザーにブロードキャスト（送信者も含む）
    io.to(sessionId).emit('music-event', {
      action,
      position,
      timestamp: Date.now()
    });
  });

  // 切断ハンドラ
  socket.on('disconnect', () => {
    const sessionId = socket.sessionId;
    const userId = socket.userId;

    if (sessionId && sessions.has(sessionId) && userId) {
      const session = sessions.get(sessionId);

      // ユーザー情報削除
      session.users.delete(userId);

      // 他のユーザーに通知
      io.to(sessionId).emit('user-left', {
        userId,
        userCount: session.users.size
      });

      // セッションが空になったら削除
      if (session.users.size === 0) {
        sessions.delete(sessionId);
        console.log(`セッション ${sessionId} が削除されました`);
      }

      console.log(`ユーザー ${userId} がセッション ${sessionId} から退出しました`);
    }
  });

  // 非アクティブセッション・ユーザーの定期的なクリーンアップ
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5分

    sessions.forEach((session, sessionId) => {
      session.users.forEach((userData, userId) => {
        if (now - userData.lastActivity > inactiveThreshold) {
          // 非アクティブユーザーの切断
          const socketId = userData.socketId;
          const clientSocket = io.sockets.sockets.get(socketId);
          if (clientSocket) {
            clientSocket.disconnect(true);
          }
        }
      });
    });
  }, 60000); // 1分ごとにチェック

  // ソケット切断時にクリーンアップインターバルをクリア
  socket.on('disconnect', () => {
    clearInterval(cleanupInterval);
  });
}

module.exports = { handleSocketConnection }; 