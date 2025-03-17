/**
 * キャンバスコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * - 検出された骨格の描画
 * - 複数ユーザーの骨格の同時表示
 * - アニメーションの管理
 */

class Canvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.poses = new Map(); // ユーザーIDごとのポーズデータを保持
  }

  // キャンバスのサイズを設定
  setSize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  // キャンバスをクリア
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ポーズデータの更新
  updatePose(userId, poseData) {
    this.poses.set(userId, poseData);
    this.render();
  }

  // ユーザーの削除
  removeUser(userId) {
    this.poses.delete(userId);
    this.render();
  }

  // 全ポーズの描画
  render() {
    this.clear();
    this.poses.forEach((pose, userId) => {
      this.drawPose(pose, this.getColorForUser(userId));
    });
  }

  // 単一ポーズの描画
  drawPose(pose, color) {
    const keypoints = pose.keypoints;
    
    // キーポイントの描画
    keypoints.forEach(keypoint => {
      this.drawKeypoint(keypoint, color);
    });

    // 骨格線の描画
    this.drawSkeleton(keypoints, color);
  }

  // キーポイントの描画
  drawKeypoint(keypoint, color) {
    const { x, y } = keypoint.position;
    
    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  // 骨格線の描画
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
  }

  // ユーザーごとの色を生成
  getColorForUser(userId) {
    // 単純なハッシュ関数でユーザーIDから色を生成
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
}

export default Canvas; 