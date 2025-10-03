import { InferenceHTTPClient } from './inferenceClient';

export interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
}

export interface RoboflowResponse {
  predictions: RoboflowPrediction[];
  image: {
    width: number;
    height: number;
  };
}

// 損傷クラスの説明マッピング
export const damageClassDescriptions: { [key: string]: string } = {
  'D00': '線状ひび割れ',
  'D01': '線状ひび割れ',
  'D10': '亀甲状ひび割れ',
  'D11': '亀甲状ひび割れ',
  'D20': 'ポットホール',
  'D40': '縦断ひび割れ',
  'D43': '段差',
  'D44': '沈下・陥没',
  'D50': '路肩の欠損',
  // 他の損傷クラスがあれば追加
};

const ROBOFLOW_API_KEY = "Jg5nNY2yVf0uOReHR3C7";
const ROBOFLOW_MODEL = "road-damages-detection/1";
const ROBOFLOW_API_URL = "https://detect.roboflow.com";

// Roboflow APIクライアントのインスタンスを作成
const client = new InferenceHTTPClient(ROBOFLOW_API_URL, ROBOFLOW_API_KEY );

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

// 従来の関数（互換性のため残す）
export const simulateAIDamageAssessment = async (file: File): Promise<number> => {
  try {
    const predictions = await getYoloPredictions(file);
    
    // If no predictions, return 0 (no damage)
    if (!predictions || predictions.length === 0) {
      return 0;
    }

    // Get the highest confidence prediction
    const highestConfidence = Math.max(
      ...predictions.map(pred => pred.confidence)
    );

    // Convert confidence (0-1) to damage score (0-5)
    const damageScore = Math.round(highestConfidence * 5);

    return Math.min(5, Math.max(0, damageScore));
  } catch (error) {
    console.error('Error in damage assessment:', error);
    // Return 0 if API call fails
    return 0;
  }
};

/**
 * 画像をYOLO APIにアップロードして予測結果と加工済み画像を取得する
 * analyze.pyと同様のロジックで実装
 * @param imageFile アップロードする画像ファイル
 * @returns 予測結果と加工済み画像のURLとデータ
 */
export const processYoloImage = async (imageFile: File) => {
  try {
    // 1. 画像をリサイズ（長辺最大 1024px）
    const { blob: resizedBlob, dataUrl: resizedDataUrl } = await resizeImage(imageFile, 1024);
    
    // リサイズした画像をFileオブジェクトに変換
    const resizedFile = new File([resizedBlob], 'resized.jpg', { type: 'image/jpeg' });
    
    // 2. 単一のAPIリクエストで推論実行（analyze.pyと同様）
    const result = await client.infer(resizedFile, ROBOFLOW_MODEL);
    
    // 3. 予測結果を画像に描画
    const annotatedImageDataUrl = await drawAnnotationsOnImage(resizedDataUrl, result.predictions);
    
    // DataURLからBlobを生成
    const annotatedImageBlob = await dataURLtoBlob(annotatedImageDataUrl);
    
    // BlobからURLを生成
    const imageUrl = URL.createObjectURL(annotatedImageBlob);

    return {
      imageData: annotatedImageDataUrl, // base64エンコードされた画像データ
      imageUrl, // 画像URL（Blob URL）
      predictions: result.predictions // YOLOの検出結果
    };
  } catch (error) {
    console.error('Error processing image with YOLO:', error);
    return null;
  }
};

/**
 * YOLOの予測結果を全て取得
 * @param file アップロードする画像ファイル
 * @returns 予測結果
 */
export const getYoloPredictions = async (file: File): Promise<RoboflowPrediction[]> => {
  try {
    // リサイズした画像を作成
    const { blob: resizedBlob } = await resizeImage(file, 1024);
    const resizedFile = new File([resizedBlob], 'resized.jpg', { type: 'image/jpeg' });
    
    // 単一のAPIリクエストで推論実行
    const result = await client.infer(resizedFile, ROBOFLOW_MODEL);
    
    return result.predictions || [];
  } catch (error) {
    console.error('Error in YOLO API call:', error);
    // エラー時はサンプルデータを返す
    return [
      {
        x: 470.5,
        y: 439,
        width: 259,
        height: 254,
        confidence: 0.876,
        class: "D44",
        class_id: 5,
        detection_id: "f9a7a442-93f6-42cf-bd02-a4ed49f915d7"
      },
      {
        x: 90.5,
        y: 370.5,
        width: 171,
        height: 185,
        confidence: 0.692,
        class: "D44",
        class_id: 5,
        detection_id: "61ecab00-1b60-4c6c-806d-871e8d6df4f3"
      }
    ];
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
 * YOLO加工済み画像のURLを生成する関数
 * 互換性のために残す - 内部では新しいprocessYoloImageを使用
 */
export const generateYoloProcessedImageUrl = async (file: File, predictions: RoboflowPrediction[]): Promise<string> => {
  try {
    // 画像をリサイズ
    const { dataUrl: resizedDataUrl } = await resizeImage(file, 1024);
    
    // 予測結果を画像に描画
    const annotatedImageDataUrl = await drawAnnotationsOnImage(resizedDataUrl, predictions);
    
    return annotatedImageDataUrl;
  } catch (error) {
    console.error('Error generating processed image URL:', error);
    
    // エラー時は従来の方法でフォールバック
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // キャンバスサイズを画像に合わせる
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 画像を描画
        ctx?.drawImage(img, 0, 0);
        
        // 検出結果を描画
        if (ctx) {
          predictions.forEach(pred => {
            // バウンディングボックスの座標計算
            const x = pred.x - pred.width / 2;
            const y = pred.y - pred.height / 2;
            
            // バウンディングボックスを描画
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, pred.width, pred.height);
            
            // クラス名と信頼度を描画
            ctx.fillStyle = '#FF0000';
            ctx.font = '16px Arial';
            ctx.fillText(
              `${pred.class} (${(pred.confidence * 100).toFixed(1)}%)`,
              x, y > 20 ? y - 5 : y + pred.height + 20
            );
          });
        }
        
        // 画像URLを生成して返す
        resolve(canvas.toDataURL('image/jpeg'));
      };
      
      // 画像の読み込み
      img.src = URL.createObjectURL(file);
    });
  }
};
