/**
 * エネルギーメーターコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * - ユーザーの動きの活発さを視覚化
 * - 動きエネルギーの計算と表示
 */

class EnergyMeter {
  constructor(meterElement) {
    this.meterFill = meterElement;
    this.energy = 0;
    this.maxEnergy = 100;
    this.decayRate = 0.95; // エネルギー減衰率
    this.lastPose = null;
  }

  // エネルギー値の更新
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
  }

  // 動きの量を計算
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
  }

  // 表示の更新
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
  }

  // エネルギー値のリセット
  reset() {
    this.energy = 0;
    this.lastPose = null;
    this.updateDisplay();
  }
}

export default EnergyMeter; 