/**
 * コントロールコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * - ユーザーインターフェースの制御
 * - ボタン操作のハンドリング
 * - セッション情報の表示
 */

class Controls {
  constructor({
    startButton,
    stopButton,
    sessionIdElement,
    userCountElement,
    onStart,
    onStop
  }) {
    this.startButton = startButton;
    this.stopButton = stopButton;
    this.sessionIdElement = sessionIdElement;
    this.userCountElement = userCountElement;
    this.onStart = onStart;
    this.onStop = onStop;
    
    this.isRunning = false;
    
    this.initEventListeners();
  }
  
  // イベントリスナーの初期化
  initEventListeners() {
    this.startButton.addEventListener('click', () => {
      this.start();
    });
    
    this.stopButton.addEventListener('click', () => {
      this.stop();
    });
  }
  
  // 開始処理
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.updateButtonState();
    
    if (this.onStart) {
      this.onStart();
    }
  }
  
  // 停止処理
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.updateButtonState();
    
    if (this.onStop) {
      this.onStop();
    }
  }
  
  // ボタン状態の更新
  updateButtonState() {
    if (this.isRunning) {
      this.startButton.disabled = true;
      this.stopButton.disabled = false;
    } else {
      this.startButton.disabled = false;
      this.stopButton.disabled = true;
    }
  }
  
  // セッションIDの表示更新
  updateSessionId(sessionId) {
    if (this.sessionIdElement) {
      this.sessionIdElement.textContent = sessionId;
    }
  }
  
  // ユーザー数の表示更新
  updateUserCount(count) {
    if (this.userCountElement) {
      this.userCountElement.textContent = count;
    }
  }
}

export default Controls; 