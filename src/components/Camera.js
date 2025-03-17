/**
 * カメラコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * - Webカメラのアクセスと表示
 * - PoseNetによる姿勢推定の実行
 * - 推定結果の親コンポーネントへの通知
 */

class Camera {
  constructor(videoElement, onPoseDetected) {
    this.video = videoElement;
    this.onPoseDetected = onPoseDetected;
    this.isRunning = false;
    this.poseNet = null;
  }

  // カメラの初期化
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
  }

  // ポーズ推定の開始
  async start() {
    if (!this.poseNet || !this.video || this.isRunning) return;

    this.isRunning = true;
    this.detectPose();
  }

  // ポーズ推定の停止
  stop() {
    this.isRunning = false;
  }

  // ポーズ推定の実行
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
  }

  // リソースの解放
  dispose() {
    this.stop();
    if (this.video && this.video.srcObject) {
      const tracks = this.video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  }
}

export default Camera; 