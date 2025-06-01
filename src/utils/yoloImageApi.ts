// YOLO画像生成APIとの連携用ユーティリティ
import { RoboflowPrediction } from './aiSimulation';

/**
 * 画像をリサイズする
 * @param imageFile 元の画像ファイル
 * @param maxSize 最大サイズ（幅・高さ）
 * @returns リサイズされた画像のBlobとDataURL
 */
const resizeImage = async (imageFile: File, maxSize: number = 1024): Promise<{ blob: Blob, dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 元の画像サイズを取得
      const originalWidth = img.width;
      const originalHeight = img.height;
      
      // リサイズ比率を計算（長辺が最大サイズになるように）
      const ratio = Math.min(maxSize / originalWidth, maxSize / originalHeight);
      
      // 新しいサイズを計算
      const newWidth = Math.floor(originalWidth * ratio);
      const newHeight = Math.floor(originalHeight * ratio);
      
      // Canvasを作成してリサイズ
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // 画像を描画
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Blobとして取得
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }
        
        // DataURLも取得
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        resolve({ blob, dataUrl });
      }, 'image/jpeg', 0.95);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // 画像の読み込み
    img.src = URL.createObjectURL(imageFile);
  });
};

/**
 * 画像をYOLO APIにアップロードして加工済み画像を取得する
 * @param imageFile アップロードする画像ファイル
 * @returns 加工済み画像のbase64データとURL、予測結果
 */
export const processImageWithYolo = async (imageFile: File) => {
  try {
    // Roboflow APIの設定
    const API_URL = "https://detect.roboflow.com";
    const API_KEY = "Jg5nNY2yVf0uOReHR3C7";
    const MODEL_ID = "road-damages-detection/1";
    
    // 1. 画像をリサイズ（長辺最大 1024px ）
    const { blob: resizedBlob, dataUrl: resizedDataUrl } = await resizeImage(imageFile, 1024);
    
    // リサイズした画像をFileオブジェクトに変換
    const resizedFile = new File([resizedBlob], 'resized.jpg', { type: 'image/jpeg' });
    
    // 2. JSONデータを取得するリクエスト
    const formDataJson = new FormData();
    formDataJson.append('file', resizedFile);
    
    const jsonEndpoint = `${API_URL}/${MODEL_ID}?api_key=${API_KEY}&format=json`;
    
    const jsonResponse = await fetch(jsonEndpoint, {
      method: 'POST',
      body: formDataJson,
    });

    if (!jsonResponse.ok) {
      throw new Error(`API error: ${jsonResponse.status}`);
    }

    const jsonData = await jsonResponse.json();
    const predictions = jsonData.predictions || [];
    
    // 3. 予測結果を画像に描画
    const annotatedImageDataUrl = await drawAnnotationsOnImage(resizedDataUrl, predictions);
    
    // DataURLからBlobを生成
    const annotatedImageBlob = await dataURLtoBlob(annotatedImageDataUrl);
    
    // BlobからURLを生成
    const imageUrl = URL.createObjectURL(annotatedImageBlob);

    return {
      imageData: annotatedImageDataUrl, // base64エンコードされた画像データ
      imageUrl, // 画像URL（Blob URL）
      predictions // YOLOの検出結果
    };
  } catch (error) {
    console.error('Error processing image with YOLO:', error);
    return null;
  }
};

/**
 * 予測結果を画像に描画する
 * @param imageDataUrl 元画像のDataURL
 * @param predictions 予測結果
 * @returns アノテーション付き画像のDataURL
 */
const drawAnnotationsOnImage = async (imageDataUrl: string, predictions: RoboflowPrediction[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Canvasを作成
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // 背景に元画像を描画
      ctx.drawImage(img, 0, 0);
      
      // バウンディングボックスとラベルを描画
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.font = '16px Arial';
      
      for (const pred of predictions) {
        // Roboflow の場合、(x,y) は中心座標、width, height は幅と高さ
        const x = pred.x - pred.width / 2;
        const y = pred.y - pred.height / 2;
        const w = pred.width;
        const h = pred.height;
        const label = pred.class;
        const confText = (pred.confidence * 100).toFixed(1) + "%";
        
        // 四角形を描画
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.stroke();
        
        // ラベルを描画（四角形の上部に文字を描く）
        const text = `${label} (${confText})`;
        const textWidth = ctx.measureText(text).width;
        const textHeight = 16; // フォントサイズに合わせる
        
        // 背景用の白い長方形
        ctx.fillStyle = 'white';
        ctx.fillRect(x, y - textHeight - 5, textWidth + 4, textHeight + 4);
        
        // ラベル文字を赤で描画
        ctx.fillStyle = 'red';
        ctx.fillText(text, x + 2, y - 5);
      }
      
      // DataURLとして取得
      const annotatedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      resolve(annotatedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // 画像の読み込み
    img.src = imageDataUrl;
  });
};

/**
 * DataURLをBlobに変換する
 * @param dataUrl 変換するDataURL
 * @returns Blob
 */
const dataURLtoBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

/**
 * BlobをBase64文字列に変換する
 * @param blob 変換するBlob
 * @returns Base64文字列
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
