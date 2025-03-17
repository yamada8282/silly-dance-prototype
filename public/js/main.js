/**
 * シリーダンス クライアントサイドスクリプト
 * 
 * このファイルは以下の機能を提供します：
 * - アプリケーションの初期化と統合
 * - コンポーネント間の連携
 * - ユーザーインターフェースの管理
 */

// importパスを修正
const socket = io();

// デバッグモード
const DEBUG = true;

// デバッグログ関数
function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
    
    // デバッグパネルにも表示
    const debugLogElement = document.getElementById('debug-log');
    if (debugLogElement) {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg);
        }
        return arg;
      }).join(' ');
      const logEntry = document.createElement('div');
      logEntry.textContent = `${new Date().toLocaleTimeString()}: [DEBUG] ${message}`;
      debugLogElement.appendChild(logEntry);
      debugLogElement.scrollTop = debugLogElement.scrollHeight;
    }
  }
}

// Socket.IOの接続状態をチェック
socket.on('connect', () => {
  debugLog('Socket.IOサーバーに接続しました');
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO接続エラー:', error);
  debugLog('Socket.IO接続エラー:', error.message);
});

socket.on('disconnect', (reason) => {
  console.warn('Socket.IOが切断されました:', reason);
  debugLog('Socket.IOが切断されました:', reason);
});

class App {
  constructor() {
    this.camera = null;
    this.canvas = null;
    this.controls = null;
    this.energyMeter = null;
    this.musicPlayer = null;
    this.initialized = false;
    this.userCount = 0;
    this.socketService = {
      userId: 'user_' + Math.random().toString(36).substr(2, 9),
      sessionId: null,
      socket: socket,
      handlers: {},
      
      initialize() {
        // 接続イベントのハンドリング
        this.socket.on('connect', () => {
          debugLog('サーバーに接続しました');
        });
        
        // 切断イベントのハンドリング
        this.socket.on('disconnect', () => {
          debugLog('サーバーから切断されました');
        });
        
        // ポーズデータ受信のハンドリング
        this.socket.on('receive-pose', (data) => {
          debugLog('ポーズデータを受信:', data.userId);
          if (this.handlers.onPoseReceived && data.userId !== this.userId) {
            this.handlers.onPoseReceived(data.userId, data.poseData);
          }
        });
        
        // ユーザー参加イベントのハンドリング
        this.socket.on('user-joined', (data) => {
          debugLog('ユーザーが参加:', data.userId, data.userCount);
          if (this.handlers.onUserJoined && data.userId !== this.userId) {
            this.handlers.onUserJoined(data.userId, data.userCount);
          }
        });
        
        // ユーザー退出イベントのハンドリング
        this.socket.on('user-left', (data) => {
          debugLog('ユーザーが退出:', data.userId, data.userCount);
          if (this.handlers.onUserLeft) {
            this.handlers.onUserLeft(data.userId, data.userCount);
          }
        });
        
        // 音楽イベントのハンドリング
        this.socket.on('music-event', (data) => {
          debugLog('音楽イベント受信:', data.action, data.position);
          if (this.handlers.onMusicEvent) {
            this.handlers.onMusicEvent(data);
          }
        });
      },
      
      setHandlers(handlers) {
        this.handlers = handlers;
      },
      
      joinSession(sessionId = null) {
        // URLパラメータからセッションIDを取得
        const urlParams = new URLSearchParams(window.location.search);
        const urlSessionId = urlParams.get('session');
        
        // 優先順位: 引数 > URLパラメータ > 新規生成
        this.sessionId = sessionId || urlSessionId || 'session_' + Math.random().toString(36).substr(2, 6);
        
        // URLにセッションIDを反映（履歴に追加せず）
        if (!urlSessionId) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('session', this.sessionId);
          window.history.replaceState({}, '', newUrl);
        }
        
        this.socket.emit('join-session', {
          sessionId: this.sessionId,
          userId: this.userId
        });
        
        return this.sessionId;
      },
      
      sendPoseData(poseData) {
        if (!this.socket || !this.sessionId) return;
        
        this.socket.emit('pose-data', {
          sessionId: this.sessionId,
          userId: this.userId,
          poseData,
          timestamp: Date.now()
        });
      },
      
      sendMusicControl(action, position) {
        if (!this.socket || !this.sessionId) return;
        
        this.socket.emit('music-control', {
          sessionId: this.sessionId,
          action,
          position,
          timestamp: Date.now()
        });
      },
      
      disconnect() {
        if (this.socket) {
          this.socket.disconnect();
        }
      }
    };
  }

  async initialize() {
    try {
      debugLog('アプリケーションの初期化を開始');
      
      // DOMエレメントの取得
      const videoElement = document.createElement('video');
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);

      const canvasElement = document.createElement('canvas');
      canvasElement.width = 640;
      canvasElement.height = 480;
      document.getElementById('dance-area').appendChild(canvasElement);

      const startButton = document.getElementById('start-btn');
      const stopButton = document.getElementById('stop-btn');
      const sessionIdElement = document.getElementById('session-id');
      const userCountElement = document.getElementById('user-count');
      const energyFillElement = document.getElementById('energy-fill');
      
      // 音楽プレーヤー要素
      const audioElement = document.getElementById('audio-element');
      const playButton = document.getElementById('play-btn');
      const pauseButton = document.getElementById('pause-btn');
      const progressElement = document.getElementById('music-progress');
      const currentTimeElement = document.getElementById('current-time');
      const totalTimeElement = document.getElementById('total-time');

      // 音楽ファイルの存在確認
      audioElement.addEventListener('error', (e) => {
        console.error('音楽ファイルの読み込みに失敗しました:', e);
        alert('音楽ファイルの読み込みに失敗しました。管理者に連絡してください。');
      });

      // コンポーネントの初期化
      debugLog('コンポーネントの初期化');
      this.camera = this.createCamera(videoElement);
      this.canvas = this.createCanvas(canvasElement);
      this.controls = this.createControls({
        startButton,
        stopButton,
        sessionIdElement,
        userCountElement
      });
      this.energyMeter = this.createEnergyMeter(energyFillElement);
      this.musicPlayer = this.createMusicPlayer({
        audioElement,
        playButton,
        pauseButton,
        progressElement,
        currentTimeElement,
        totalTimeElement
      });
      
      // Socket.IOの初期化
      debugLog('Socket.IOの初期化');
      this.socketService.initialize();
      this.socketService.setHandlers({
        onPoseReceived: this.handlePoseReceived.bind(this),
        onUserJoined: this.handleUserJoined.bind(this),
        onUserLeft: this.handleUserLeft.bind(this),
        onMusicEvent: this.handleMusicEvent.bind(this)
      });

      // カメラの初期化
      debugLog('カメラの初期化を開始');
      try {
        const cameraInitialized = await this.initializeCamera();
        if (!cameraInitialized) {
          throw new Error('カメラの初期化に失敗しました');
        }
        debugLog('カメラの初期化が完了');
      } catch (cameraError) {
        console.error('カメラエラー:', cameraError);
        alert('カメラへのアクセスが許可されていないか、利用できません。カメラを許可してページを更新してください。');
        // カメラエラーでも続行
      }

      // セッションへの参加
      const sessionId = this.socketService.joinSession();
      debugLog(`セッションに参加しました: ${sessionId}`);
      this.controls.updateSessionId(sessionId);

      this.initialized = true;
      debugLog('アプリケーションの初期化が完了');

    } catch (error) {
      console.error('アプリケーションの初期化に失敗しました:', error);
      alert('アプリケーションの初期化に失敗しました。ページを更新してください。');
    }
  }

  // 音楽プレーヤーコンポーネントの作成
  createMusicPlayer({ audioElement, playButton, pauseButton, progressElement, currentTimeElement, totalTimeElement }) {
    return {
      audio: audioElement,
      playButton,
      pauseButton,
      progressElement,
      currentTimeElement,
      totalTimeElement,
      isPlaying: false,
      updateInterval: null,
      
      initialize() {
        debugLog('音楽プレーヤーの初期化を開始');
        
        // 音楽の読み込み完了時のイベント
        this.audio.addEventListener('loadedmetadata', () => {
          debugLog('音楽メタデータの読み込みが完了しました');
          this.updateTotalTime();
        });
        
        // 再生終了時のイベント
        this.audio.addEventListener('ended', () => {
          debugLog('音楽の再生が終了しました');
          this.stop();
        });
        
        // エラー発生時のイベント
        this.audio.addEventListener('error', (e) => {
          const errorMessage = this.getAudioErrorMessage(e);
          console.error('音楽の読み込みエラー:', errorMessage);
          debugLog('音楽の読み込みエラー:', errorMessage);
          
          // フォールバックソースがある場合は自動的に次のソースを試す
          // エラーハンドリングはブラウザが自動的に行う
        });
        
        // 再生ボタンのイベント
        this.playButton.addEventListener('click', () => {
          debugLog('再生ボタンがクリックされました');
          this.play();
        });
        
        // 一時停止ボタンのイベント
        this.pauseButton.addEventListener('click', () => {
          debugLog('一時停止ボタンがクリックされました');
          this.pause();
        });
        
        debugLog('音楽プレーヤーの初期化が完了しました');
      },
      
      // オーディオエラーメッセージの取得
      getAudioErrorMessage(e) {
        if (!e || !this.audio.error) {
          return '不明なエラー';
        }
        
        const error = this.audio.error;
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            return 'ユーザーによって再生が中止されました';
          case MediaError.MEDIA_ERR_NETWORK:
            return 'ネットワークエラーが発生しました';
          case MediaError.MEDIA_ERR_DECODE:
            return '音声ファイルの復号化に失敗しました';
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            return '音声形式がサポートされていないか、ファイルが見つかりません';
          default:
            return `不明なエラー (コード: ${error.code})`;
        }
      },
      
      // 再生
      play() {
        if (this.isPlaying) return;
        
        debugLog('音楽の再生を開始します');
        this.audio.play().then(() => {
          debugLog('音楽の再生が開始されました');
          this.isPlaying = true;
          this.updateButtonState();
          this.startProgressUpdate();
          
          // 他のユーザーに通知
          app.socketService.sendMusicControl('play', this.audio.currentTime);
        }).catch(error => {
          console.error('音楽の再生に失敗しました:', error);
          debugLog('音楽の再生に失敗しました:', error.message);
          alert('音楽の再生に失敗しました。ブラウザの自動再生ポリシーにより、ユーザーの操作が必要な場合があります。');
        });
      },
      
      // 一時停止
      pause() {
        if (!this.isPlaying) return;
        
        this.audio.pause();
        this.isPlaying = false;
        this.updateButtonState();
        this.stopProgressUpdate();
        
        // 他のユーザーに通知
        app.socketService.sendMusicControl('pause', this.audio.currentTime);
      },
      
      // 停止（最初に戻る）
      stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.updateButtonState();
        this.stopProgressUpdate();
        this.updateProgress();
      },
      
      // 特定の位置にシーク
      seek(time) {
        this.audio.currentTime = time;
        this.updateProgress();
      },
      
      // ボタン状態の更新
      updateButtonState() {
        if (this.isPlaying) {
          this.playButton.disabled = true;
          this.pauseButton.disabled = false;
        } else {
          this.playButton.disabled = false;
          this.pauseButton.disabled = true;
        }
      },
      
      // 進捗更新の開始
      startProgressUpdate() {
        this.updateInterval = setInterval(() => {
          this.updateProgress();
        }, 100);
      },
      
      // 進捗更新の停止
      stopProgressUpdate() {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
      },
      
      // 進捗表示の更新
      updateProgress() {
        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration || 0;
        
        // プログレスバーの更新
        if (duration > 0) {
          const percentage = (currentTime / duration) * 100;
          this.progressElement.style.width = `${percentage}%`;
        }
        
        // 時間表示の更新
        this.currentTimeElement.textContent = this.formatTime(currentTime);
      },
      
      // 総再生時間の表示更新
      updateTotalTime() {
        const duration = this.audio.duration || 0;
        this.totalTimeElement.textContent = this.formatTime(duration);
      },
      
      // 時間のフォーマット（秒→mm:ss）
      formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
      },
      
      // 音楽イベントの処理
      handleMusicEvent(data) {
        const { action, position } = data;
        
        switch (action) {
          case 'play':
            this.seek(position);
            if (!this.isPlaying) {
              this.audio.play();
              this.isPlaying = true;
              this.updateButtonState();
              this.startProgressUpdate();
            }
            break;
            
          case 'pause':
            this.seek(position);
            if (this.isPlaying) {
              this.audio.pause();
              this.isPlaying = false;
              this.updateButtonState();
              this.stopProgressUpdate();
            }
            break;
            
          case 'seek':
            this.seek(position);
            break;
        }
      }
    };
  }

  // カメラコンポーネントの作成
  createCamera(videoElement) {
    return {
      video: videoElement,
      poseNet: null,
      isRunning: false,
      onPoseDetected: this.handlePoseDetected.bind(this),
      
      async initialize() {
        try {
          debugLog('カメラストリームの取得を試みます');
          
          // カメラの権限を確認
          if (navigator.permissions) {
            try {
              const result = await navigator.permissions.query({ name: 'camera' });
              debugLog('カメラ権限状態:', result.state);
              
              if (result.state === 'denied') {
                throw new Error('カメラへのアクセスが拒否されています');
              }
            } catch (permError) {
              debugLog('権限確認エラー:', permError);
              // 権限APIがサポートされていない場合は続行
            }
          }
          
          // カメラストリームの取得
          const constraints = {
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user'
            }
          };
          
          debugLog('カメラ制約:', constraints);
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
          debugLog('カメラストリームの取得に成功');
          // videoエレメントにストリームを設定
          this.video.srcObject = stream;
          this.video.onloadedmetadata = () => {
            debugLog('ビデオメタデータ読み込み完了');
            this.video.play().catch(e => {
              console.error('ビデオ再生エラー:', e);
            });
          };
          
          // ビデオ要素のエラーハンドリング
          this.video.onerror = (e) => {
            console.error('ビデオ要素エラー:', e);
          };
          
          // PoseNetの読み込みを待機
          debugLog('PoseNetの初期化を開始');
          try {
            this.poseNet = await posenet.load({
              architecture: 'MobileNetV1',
              outputStride: 16,
              inputResolution: { width: 640, height: 480 },
              multiplier: 0.75,
              quantBytes: 2
            });
            debugLog('PoseNetの初期化が完了');
          } catch (poseNetError) {
            console.error('PoseNetの初期化に失敗:', poseNetError);
            alert('姿勢検出モデルの読み込みに失敗しました。ネットワーク接続を確認してください。');
            return false;
          }
          
          debugLog('カメラとPoseNetの初期化が完了しました');
          return true;
        } catch (error) {
          console.error('カメラまたはPoseNetの初期化に失敗しました:', error);
          
          // エラーメッセージをユーザーフレンドリーに
          let errorMessage = 'カメラの初期化に失敗しました。';
          
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'カメラへのアクセスが許可されていません。ブラウザの設定でカメラへのアクセスを許可してください。';
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'カメラが見つかりません。カメラが接続されているか確認してください。';
          } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'カメラにアクセスできません。他のアプリケーションがカメラを使用している可能性があります。';
          } else if (error.name === 'OverconstrainedError') {
            errorMessage = '指定された要件を満たすカメラが見つかりません。';
          } else if (error.name === 'TypeError') {
            errorMessage = 'カメラの設定が無効です。';
          }
          
          alert(errorMessage);
          return false;
        }
      },
      
      async start() {
        if (!this.poseNet || !this.video || this.isRunning) return;
        
        debugLog('ポーズ検出を開始');
        this.isRunning = true;
        this.detectPose();
      },
      
      stop() {
        debugLog('ポーズ検出を停止');
        this.isRunning = false;
      },
      
      async detectPose() {
        while (this.isRunning) {
          try {
            // ポーズの推定
            const pose = await this.poseNet.estimateSinglePose(this.video, {
              flipHorizontal: true
            });
            
            // スコアが低いキーポイントをフィルタリング
            const filteredKeypoints = pose.keypoints.filter(kp => kp.score > 0.5);
            
            // データを最適化
            const optimizedPose = {
              keypoints: filteredKeypoints.map(kp => ({
                position: {
                  x: Math.round(kp.position.x),
                  y: Math.round(kp.position.y)
                },
                score: parseFloat(kp.score.toFixed(2)),
                part: kp.part
              })),
              score: parseFloat(pose.score.toFixed(2))
            };
            
            // 結果を通知
            if (this.onPoseDetected) {
              this.onPoseDetected(optimizedPose);
            }
            
            // フレームレート調整（30fps程度）
            await new Promise(resolve => setTimeout(resolve, 33));
          } catch (error) {
            console.error('ポーズ推定中にエラーが発生しました:', error);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      },
      
      dispose() {
        this.stop();
        if (this.video && this.video.srcObject) {
          const tracks = this.video.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
      }
    };
  }

  // キャンバスコンポーネントの作成
  createCanvas(canvasElement) {
    return {
      canvas: canvasElement,
      ctx: canvasElement.getContext('2d'),
      poses: new Map(),
      
      setSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
      },
      
      clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      },
      
      updatePose(userId, poseData) {
        this.poses.set(userId, poseData);
        this.render();
      },
      
      removeUser(userId) {
        this.poses.delete(userId);
        this.render();
      },
      
      render() {
        this.clear();
        this.poses.forEach((pose, userId) => {
          this.drawPose(pose, this.getColorForUser(userId));
        });
      },
      
      drawPose(pose, color) {
        const keypoints = pose.keypoints;
        
        // キーポイントの描画
        keypoints.forEach(keypoint => {
          this.drawKeypoint(keypoint, color);
        });
        
        // 骨格線の描画
        this.drawSkeleton(keypoints, color);
      },
      
      drawKeypoint(keypoint, color) {
        const { x, y } = keypoint.position;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
      },
      
      drawSkeleton(keypoints, color) {
        // 骨格の接続定義
        const connections = [
          ['nose', 'leftEye'], ['leftEye', 'leftEar'],
          ['nose', 'rightEye'], ['rightEye', 'rightEar'],
          ['leftShoulder', 'rightShoulder'],
          ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
          ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
          ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
          ['leftHip', 'rightHip'],
          ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
          ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle']
        ];
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        
        connections.forEach(([partA, partB]) => {
          const a = keypoints.find(kp => kp.part === partA);
          const b = keypoints.find(kp => kp.part === partB);
          
          if (a && b && a.score > 0.5 && b.score > 0.5) {
            this.ctx.beginPath();
            this.ctx.moveTo(a.position.x, a.position.y);
            this.ctx.lineTo(b.position.x, b.position.y);
            this.ctx.stroke();
          }
        });
      },
      
      getColorForUser(userId) {
        // 単純なハッシュ関数でユーザーIDから色を生成
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
          hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 50%)`;
      }
    };
  }

  // コントロールコンポーネントの作成
  createControls({ startButton, stopButton, sessionIdElement, userCountElement }) {
    return {
      startButton,
      stopButton,
      sessionIdElement,
      userCountElement,
      onStart: this.handleStart.bind(this),
      onStop: this.handleStop.bind(this),
      isRunning: false,
      
      initEventListeners() {
        this.startButton.addEventListener('click', () => {
          this.start();
        });
        
        this.stopButton.addEventListener('click', () => {
          this.stop();
        });
      },
      
      start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.updateButtonState();
        
        if (this.onStart) {
          this.onStart();
        }
      },
      
      stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.updateButtonState();
        
        if (this.onStop) {
          this.onStop();
        }
      },
      
      updateButtonState() {
        if (this.isRunning) {
          this.startButton.disabled = true;
          this.stopButton.disabled = false;
        } else {
          this.startButton.disabled = false;
          this.stopButton.disabled = true;
        }
      },
      
      updateSessionId(sessionId) {
        if (this.sessionIdElement) {
          this.sessionIdElement.textContent = sessionId;
        }
      },
      
      updateUserCount(count) {
        if (this.userCountElement) {
          this.userCountElement.textContent = count;
        }
      }
    };
  }

  // エネルギーメーターコンポーネントの作成
  createEnergyMeter(meterElement) {
    return {
      meterFill: meterElement,
      energy: 0,
      maxEnergy: 100,
      decayRate: 0.95,
      lastPose: null,
      
      update(poseData) {
        // 前回のポーズがない場合は初期化のみ
        if (!this.lastPose) {
          this.lastPose = poseData;
          return;
        }
        
        // 動きエネルギーの計算
        const movement = this.calculateMovement(poseData, this.lastPose);
        
        // エネルギー値の更新（減衰も考慮）
        this.energy = Math.min(this.maxEnergy, this.energy * this.decayRate + movement);
        
        // 表示の更新
        this.updateDisplay();
        
        // 現在のポーズを保存
        this.lastPose = poseData;
      },
      
      calculateMovement(currentPose, previousPose) {
        let totalMovement = 0;
        const keypoints = currentPose.keypoints;
        const prevKeypoints = previousPose.keypoints;
        
        // 各キーポイントの移動距離を計算
        for (let i = 0; i < keypoints.length; i++) {
          const current = keypoints[i];
          // 前回のポーズから同じ部位を探す
          const prev = prevKeypoints.find(kp => kp.part === current.part);
          
          if (current && prev && current.score > 0.5 && prev.score > 0.5) {
            const dx = current.position.x - prev.position.x;
            const dy = current.position.y - prev.position.y;
            // ユークリッド距離を計算
            const distance = Math.sqrt(dx*dx + dy*dy);
            totalMovement += distance;
          }
        }
        
        // 動きの大きさに応じてスケーリング
        return Math.min(10, totalMovement / 10);
      },
      
      updateDisplay() {
        const percentage = (this.energy / this.maxEnergy) * 100;
        this.meterFill.style.width = `${percentage}%`;
        
        // エネルギーレベルに応じて色を変更
        if (percentage < 30) {
          this.meterFill.style.backgroundColor = '#4CAF50'; // 緑
        } else if (percentage < 70) {
          this.meterFill.style.backgroundColor = '#FFC107'; // 黄色
        } else {
          this.meterFill.style.backgroundColor = '#FF5722'; // オレンジ
        }
      },
      
      reset() {
        this.energy = 0;
        this.lastPose = null;
        this.updateDisplay();
      }
    };
  }

  // カメラの初期化
  async initializeCamera() {
    debugLog('カメラ初期化メソッドが呼び出されました');
    try {
      const result = await this.camera.initialize();
      debugLog('カメラ初期化結果:', result);
      return result;
    } catch (error) {
      console.error('カメラ初期化エラー:', error);
      debugLog('カメラ初期化エラー:', error.message);
      return false;
    }
  }

  // 開始ボタンのハンドラ
  handleStart() {
    if (!this.initialized) return;
    debugLog('開始ボタンがクリックされました');
    this.camera.start();
  }

  // 停止ボタンのハンドラ
  handleStop() {
    if (!this.initialized) return;
    debugLog('停止ボタンがクリックされました');
    this.camera.stop();
    this.energyMeter.reset();
  }

  // ポーズ検出時のハンドラ
  handlePoseDetected(poseData) {
    if (!this.initialized || !this.controls.isRunning) return;

    // 自分のポーズを描画
    this.canvas.updatePose(this.socketService.userId, poseData);
    
    // エネルギーメーターの更新
    this.energyMeter.update(poseData);
    
    // サーバーにポーズデータを送信
    this.socketService.sendPoseData(poseData);
  }

  // 他のユーザーのポーズ受信時のハンドラ
  handlePoseReceived(userId, poseData) {
    if (!this.controls.isRunning) return;
    this.canvas.updatePose(userId, poseData);
  }

  // ユーザー参加時のハンドラ
  handleUserJoined(userId, userCount) {
    console.log(`新しいユーザーが参加しました: ${userId} (計${userCount}人)`);
    this.userCount = userCount;
    this.controls.updateUserCount(userCount);
  }

  // ユーザー退出時のハンドラ
  handleUserLeft(userId, userCount) {
    console.log(`ユーザーが退出しました: ${userId} (計${userCount}人)`);
    this.userCount = userCount;
    this.controls.updateUserCount(userCount);
    this.canvas.removeUser(userId);
  }
  
  // 音楽イベント受信時のハンドラ
  handleMusicEvent(data) {
    if (this.musicPlayer) {
      this.musicPlayer.handleMusicEvent(data);
    }
  }

  // アプリケーションの終了処理
  dispose() {
    if (this.camera) {
      this.camera.dispose();
    }
    this.socketService.disconnect();
  }
}

// アプリケーションのインスタンス化と開始
const app = new App();
document.addEventListener('DOMContentLoaded', () => {
  debugLog('DOMContentLoadedイベントが発火しました');
  
  // 音楽ファイルの存在確認
  const audioElement = document.getElementById('audio-element');
  if (audioElement) {
    debugLog('音楽要素が見つかりました');
    
    // 音楽ファイルのロード状態を確認
    audioElement.addEventListener('loadeddata', () => {
      debugLog('音楽ファイルがロードされました');
    });
    
    // 音楽ファイルのエラーを詳細に記録
    audioElement.addEventListener('error', (e) => {
      const error = audioElement.error;
      let errorMessage = '不明なエラー';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'ユーザーによって再生が中止されました';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'ネットワークエラーが発生しました';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = '音声ファイルの復号化に失敗しました';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = '音声形式がサポートされていないか、ファイルが見つかりません';
            break;
          default:
            errorMessage = `不明なエラー (コード: ${error.code})`;
        }
      }
      
      console.error('音楽ファイルエラー:', errorMessage);
      debugLog('音楽ファイルエラー:', errorMessage);
    });
  } else {
    debugLog('音楽要素が見つかりません');
  }
  
  app.initialize();
  // コントロールのイベントリスナーを初期化
  if (app.controls) {
    debugLog('コントロールのイベントリスナーを初期化します');
    app.controls.initEventListeners();
  }
  // 音楽プレーヤーのイベントリスナーを初期化
  if (app.musicPlayer) {
    debugLog('音楽プレーヤーのイベントリスナーを初期化します');
    app.musicPlayer.initialize();
  }
});
window.addEventListener('beforeunload', () => app.dispose()); 