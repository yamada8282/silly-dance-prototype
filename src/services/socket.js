/**
 * Socket.IOサービス
 * 
 * このサービスは以下の機能を提供します：
 * - サーバーとのWebSocket接続管理
 * - セッション参加・退出の処理
 * - ポーズデータの送受信
 */

class SocketService {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.userId = this.generateUserId();
    this.onPoseReceived = null;
    this.onUserJoined = null;
    this.onUserLeft = null;
  }

  // 接続の初期化
  initialize() {
    this.socket = io();

    // 接続イベントのハンドリング
    this.socket.on('connect', () => {
      console.log('サーバーに接続しました');
    });

    // 切断イベントのハンドリング
    this.socket.on('disconnect', () => {
      console.log('サーバーから切断されました');
    });

    // ポーズデータ受信のハンドリング
    this.socket.on('receive-pose', (data) => {
      if (this.onPoseReceived && data.userId !== this.userId) {
        this.onPoseReceived(data.userId, data.poseData);
      }
    });

    // ユーザー参加イベントのハンドリング
    this.socket.on('user-joined', (data) => {
      if (this.onUserJoined && data.userId !== this.userId) {
        this.onUserJoined(data.userId, data.userCount);
      }
    });

    // ユーザー退出イベントのハンドリング
    this.socket.on('user-left', (data) => {
      if (this.onUserLeft) {
        this.onUserLeft(data.userId, data.userCount);
      }
    });
  }

  // セッションへの参加
  joinSession(sessionId = null) {
    this.sessionId = sessionId || this.generateSessionId();
    
    this.socket.emit('join-session', {
      sessionId: this.sessionId,
      userId: this.userId
    });

    return this.sessionId;
  }

  // ポーズデータの送信
  sendPoseData(poseData) {
    if (!this.socket || !this.sessionId) return;

    this.socket.emit('pose-data', {
      sessionId: this.sessionId,
      userId: this.userId,
      poseData,
      timestamp: Date.now()
    });
  }

  // ユーザーIDの生成
  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  // セッションIDの生成
  generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 6);
  }

  // イベントハンドラの設定
  setHandlers({
    onPoseReceived,
    onUserJoined,
    onUserLeft
  }) {
    this.onPoseReceived = onPoseReceived;
    this.onUserJoined = onUserJoined;
    this.onUserLeft = onUserLeft;
  }

  // 切断処理
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export default new SocketService(); 