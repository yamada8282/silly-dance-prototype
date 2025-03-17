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
          console.log('サーバーに接続しました');
        });
        
        // 切断イベントのハンドリング
        this.socket.on('disconnect', () => {
          console.log('サーバーから切断されました');
        });
        
        // ポーズデータ受信のハンドリング
        this.socket.on('receive-pose', (data) => {
          if (this.handlers.onPoseReceived && data.userId !== this.userId) {
            this.handlers.onPoseReceived(data.userId, data.poseData);
          }
        });
        
        // ユーザー参加イベントのハンドリング
        this.socket.on('user-joined', (data) => {
          if (this.handlers.onUserJoined && data.userId !== this.userId) {
            this.handlers.onUserJoined(data.userId, data.userCount);
          }
        });
        
        // ユーザー退出イベントのハンドリング
        this.socket.on('user-left', (data) => {
          if (this.handlers.onUserLeft) {
            this.handlers.onUserLeft(data.userId, data.userCount);
          }
        });
        
        // 音楽イベントのハンドリング
        this.socket.on('music-event', (data) => {
          if (this.handlers.onMusicEvent) {
            this.handlers.onMusicEvent(data);
          }
        });
      },
      
      setHandlers(handlers) {
        this.handlers = handlers;
      },
      
      joinSession(sessionId = null) {
        this.sessionId = sessionId || 'session_' + Math.random().toString(36).substr(2, 6);
        
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

      // コンポーネントの初期化
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
      this.socketService.initialize();
      this.socketService.setHandlers({
        onPoseReceived: this.handlePoseReceived.bind(this),
        onUserJoined: this.handleUserJoined.bind(this),
        onUserLeft: this.handleUserLeft.bind(this),
        onMusicEvent: this.handleMusicEvent.bind(this)
      });

      // カメラの初期化
      const cameraInitialized = await this.initializeCamera();
      if (!cameraInitialized) {
        throw new Error('カメラの初期化に失敗しました');
      }

      // セッションへの参加
      const sessionId = this.socketService.joinSession();
      console.log(`セッションに参加しました: ${sessionId}`);
      this.controls.updateSessionId(sessionId);

      this.initialized = true;

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
        // 音楽の読み込み完了時のイベント
        this.audio.addEventListener('loadedmetadata', () => {
          this.updateTotalTime();
        });
        
        // 再生終了時のイベント
        this.audio.addEventListener('ended', () => {
          this.stop();
        });
        
        // 再生ボタンのイベント
        this.playButton.addEventListener('click', () => {
          this.play();
        });
        
        // 一時停止ボタンのイベント
        this.pauseButton.addEventListener('click', () => {
          this.pause();
        });
      },
      
      // 再生
      play() {
        if (this.isPlaying) return;
        
        this.audio.play();
        this.isPlaying = true;
        this.updateButtonState();
        this.startProgressUpdate();
        
        // 他のユーザーに通知
        app.socketService.sendMusicControl('play', this.audio.currentTime);
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
          // カメラストリームの取得
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: 640,
              height: 480
            }
          });
          
          // videoエレメントにストリームを設定
          this.video.srcObject = stream;
          this.video.play();
          
          // PoseNetの初期化
          this.poseNet = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 640, height: 480 },
            multiplier: 0.75,
            quantBytes: 2
          });
          
          console.log('カメラとPoseNetの初期化が完了しました');
          return true;
        } catch (error) {
          console.error('カメラまたはPoseNetの初期化に失敗しました:', error);
          return false;
        }
      },
      
      async start() {
        if (!this.poseNet || !this.video || this.isRunning) return;
        
        this.isRunning = true;
        this.detectPose();
      },
      
      stop() {
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
    return await this.camera.initialize();
  }

  // 開始ボタンのハンドラ
  handleStart() {
    if (!this.initialized) return;
    this.camera.start();
  }

  // 停止ボタンのハンドラ
  handleStop() {
    if (!this.initialized) return;
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
  app.initialize();
  // コントロールのイベントリスナーを初期化
  if (app.controls) {
    app.controls.initEventListeners();
  }
  // 音楽プレーヤーのイベントリスナーを初期化
  if (app.musicPlayer) {
    app.musicPlayer.initialize();
  }
});
window.addEventListener('beforeunload', () => app.dispose()); 