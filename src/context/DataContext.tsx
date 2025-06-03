import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import bunkyoRoadsData from '../data/bunkyoRoadsData';
import { simulateAIDamageAssessment } from '../utils/aiSimulation';
// AIによる被害評価をシミュレーションする関数をインポートしています。
// 空間的なユーティリティ関数をインポートしています。
// findNearestRoad: 最も近い道路を見つける関数。
// findNearestRoadsForPoints: 複数のポイントに対して最も近い道路を見つける関数。
// GPSポイントに基づいて最も近い道路を見つける関数をインポートしています。
import { Feature, LineString } from 'geojson';
import { generateColoredRoadPathFromGPS } from '../utils/roadPathUtils';

interface DataContextType {
  roadData: any; // 道路データを格納するプロパティ。型は `any` で、どのようなデータ型でも許容されます。
  statistics: StatisticsType; // 統計情報を格納するプロパティ。型は `StatisticsType` です。
  uploadPhotos: (files: File[]) => void; // 写真をアップロードする関数。引数は `File` 型の配列で、戻り値はありません。
  processVideo: (file: File, gpsData: GPSData[]) => void; // 動画を処理する関数。引数は `File` 型のファイルと `GPSData` 型の配列で、戻り値はありません。
  loading: boolean; // ローディング状態を示すプロパティ。`true` または `false` のブール値です。
  coloredRoads: Feature<LineString>[]; // 色付けされた道路データを格納するプロパティ。型は `Feature<LineString>` の配列です。
}

interface StatisticsType {
  noDamage: number;
  minorDamage: number; // 軽微な損傷の数を格納するプロパティ。
  moderateDamage: number; // 中程度の損傷の数を格納するプロパティ。
  severeDamage: number; // 深刻な損傷の数を格納するプロパティ。
  totalAssessments: number; // 全体の評価数を格納するプロパティ。
  lastUpdated: string; // 最終更新日時を文字列で格納するプロパティ。
}

interface PhotoAssessment {
  coordinates: [number, number]; // 写真の座標を格納するプロパティ。緯度と経度のペアです。
  damageScore: number; // 損傷スコアを格納するプロパティ。
  timestamp: string; // 写真のタイムスタンプを文字列で格納するプロパティ。
  originalTimestamp?: number; // オリジナルのタイムスタンプを格納するプロパティ（オプショナル）。
}

interface GPSData {
  timestamp: string; // GPSデータのタイムスタンプを文字列で格納するプロパティ。
  latitude: number; // 緯度を格納するプロパティ。
  longitude: number; // 経度を格納するプロパティ。
}

const initialStatistics: StatisticsType = {
  noDamage: 0, // 損傷なしの初期値を 0 に設定。
  minorDamage: 0, // 軽微な損傷の初期値を 0 に設定。
  moderateDamage: 0, // 中程度の損傷の初期値を 0 に設定。
  severeDamage: 0, // 深刻な損傷の初期値を 0 に設定。
  totalAssessments: 0, // 全体の評価数の初期値を 0 に設定。
  lastUpdated: '-' // 最終更新日時の初期値を '-' に設定。
};

const DataContext = createContext<DataContextType>({
  roadData: null, // 初期値として道路データを `null` に設定。
  statistics: initialStatistics, // 統計情報の初期値として `initialStatistics` を使用。
  uploadPhotos: () => {}, // 写真アップロード関数の初期値として空の関数を設定。
  processVideo: () => {}, // 動画処理関数の初期値として空の関数を設定。
  loading: false, // ローディング状態の初期値を `false` に設定。
  coloredRoads: [] // 色付けされた道路データの初期値を空の配列に設定。
});



// useContextを利用して、DataContextからデータを取得するカスタムフックを定義
export const useData = () => useContext(DataContext);
interface DataProviderProps {
  children: ReactNode;
}



export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [roadData, setRoadData] = useState<any>(null);
  const [statistics, setStatistics] = useState<StatisticsType>(initialStatistics);
  const [loading, setLoading] = useState<boolean>(false);
  const [coloredRoads, setColoredRoads] = useState<Feature<LineString>[]>([]);
  
  // 文京区の道路データを取得
  const bunkyoRoads = useMemo(() => {
    if (bunkyoRoadsData && bunkyoRoadsData.features) {
      return bunkyoRoadsData.features.filter(
        feature => feature.geometry.type === "LineString"
      ) as Feature<LineString>[];
    }
    return [];
  }, []);
  

  //損傷の評価(道具)
  const calculateStatistics = (data: any) => {
    if (!data || !data.features) return;
    
    const counts = {
      no: 0,
      minor: 0,
      moderate: 0,
      severe: 0,
      total: 0
    };

    data.features.forEach((feature: any) => {
      const score = feature.properties.damageScore || 0;
      counts.total++;
      
      if (score <= 0) counts.no++;
      else if (score <= 2) counts.minor++;
      else if (score <= 4) counts.moderate++;
      else counts.severe++;
    });

    setStatistics({
      noDamage: counts.no,
      minorDamage: counts.minor,
      moderateDamage: counts.moderate,
      severeDamage: counts.severe,
      totalAssessments: counts.total,
      lastUpdated: new Date().toLocaleString('ja-JP')
    });
  };
  

  //60秒ごとに動画を画像に分割(道具)
  const extractFrames = async (videoFile: File): Promise<Blob[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const frames: Blob[] = [];
      
      video.src = URL.createObjectURL(videoFile);
      
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
          video.currentTime = 0;
      };

      const interval = 60; // Extract frame every 10 seconds
      let currentTime = 0;

      video.onseeked = () => {
        if (ctx && currentTime <= video.duration) {
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              frames.push(blob);
            }
            currentTime += interval;
            if (currentTime <= video.duration) {
              video.currentTime = currentTime;
            } else {
              URL.revokeObjectURL(video.src);
              resolve(frames);
            }
          }, 'image/jpeg', 0.95); // High quality JPEG
        }
      };

      video.onerror = (e) => {
        console.error('Video error:', e);
        reject(e);
      };
      
      // 5秒後にもフレームが抽出されていない場合のフォールバック
      setTimeout(() => {
        if (frames.length === 0) {
          console.warn('Frame extraction timeout - forcing resolution');
          resolve(frames);
        }
      }, 5000);
    });
  };
  

  //[核]動画用、extractFrames、processFrames、地図上に可視化する関数
  const processVideo = async (videoFile: File, gpsData: GPSData[]) => {
    setLoading(true);
    
    try {
      // GPSデータを時間順にソート
      const sortedGPSData = [...gpsData].sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
      const frames = await extractFrames(videoFile);
      
      if (frames.length === 0) {
        alert('動画からフレームを抽出できませんでした。別の動画をお試しください。');
        return;
      }
      
      const assessments = await processFrames(frames, sortedGPSData);
      
      if (assessments.length === 0) {
        alert('有効なフレームが見つかりませんでした。');
        return;
      }

      // 従来のポイントとライン生成
      const newRoadFeatures = createRoadSegments(assessments);
      
      const updatedRoadData = {
        type: "FeatureCollection",
        features: [...(roadData?.features || []), ...newRoadFeatures]
      };
      
      // 各GPSポイントを道路上にスナップし、連続した道路パスを生成
      const gpsPoints = assessments.map(a => a.coordinates);
      const damageScores = assessments.map(a => a.damageScore);
      
      // 文京区の道路データから道路パスを生成
      const roadPath = generateColoredRoadPathFromGPS(gpsPoints, bunkyoRoads, damageScores);
      
      // 生成された道路パスで色付け
      setColoredRoads(roadPath);
      
      setRoadData(updatedRoadData);
      calculateStatistics(updatedRoadData);

    } catch (error) {
      console.error('Error processing video:', error);
      alert('動画の処理中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };


  //GPSデータを使用してフレームを処理し、各画像に対するGPS座標を求めてaIが損傷スコア計算(道具→動画用)
  const processFrames = async (frames: Blob[], gpsData: GPSData[]): Promise<PhotoAssessment[]> => {
    // GPSデータを時間順にソート
    const sortedGPSData = [...gpsData].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    
    const assessments = await Promise.all(
      frames.map(async (frame, index) => {
        // 10秒間隔でフレームを抽出しているので、それに合わせて時間を計算
        const timestamp = index * 10000; // Convert frame index to milliseconds (10s intervals)
        const gpsPoint = findClosestGPSPoint(timestamp, sortedGPSData);
        
        if (!gpsPoint) return null;

        const frameFile = new File([frame], `frame-${index}.jpg`, { type: 'image/jpeg' });
        const damageScore = await simulateAIDamageAssessment(frameFile);
        

        return {
          coordinates: [gpsPoint.longitude, gpsPoint.latitude], // Swap for GeoJSON format
          damageScore,
          timestamp: new Date(timestamp).toISOString(),
          originalTimestamp: timestamp
        };
      })
    );

    return assessments.filter((a): a is PhotoAssessment => a !== null);
  };


  // GPSデータから最も近いGPSポイントを見つける関数(道具)
  // 動画のフレームタイムスタンプ（ミリ秒）を受け取り、最も時刻が近いGPSポイントを返す
  const findClosestGPSPoint = (timestamp: number, gpsData: GPSData[]): GPSData | null => {
    if (gpsData.length === 0) return null;
    
    // 動画の開始時間を最初のGPSデータの時間とみなす
    const startTime = new Date(gpsData[0].timestamp).getTime();
    
    // フレームの時間（ミリ秒）から対応するGPSデータのインデックスを推定
    const frameTimeOffset = timestamp;
    const targetTime = startTime + frameTimeOffset;
    
    // 最も近い時間のGPSポイントを探す
    return gpsData.reduce((closest, current) => {
      const currentTime = new Date(current.timestamp).getTime();
      const closestTime = new Date(closest.timestamp).getTime();
      
      return Math.abs(currentTime - targetTime) < Math.abs(closestTime - targetTime)
        ? current
        : closest;
    });
  };


  
  // [核]写真用、写真のファイルを受け取り、GPS座標を抽出し、AIによる損傷評価を行い、地図上に可視化する
  const uploadPhotos = async (files: File[]) => {
    setLoading(true);
    
    try {
      const assessments = await Promise.all(
        files.map(async (file) => {
          const coordinates = await extractGPSCoordinates(file);
          if (!coordinates) {
            console.warn(`No GPS data found in file: ${file.name}`);
            return null;
          }
          
          const damageScore = await simulateAIDamageAssessment(file);
          const originalTimestamp = await extractTimestamp(file);
          
          return {
            coordinates,
            damageScore,
            timestamp: new Date().toISOString(),
            originalTimestamp
          };
        })
      );

      const validAssessments = assessments.filter((a): a is PhotoAssessment => a !== null);
      
      if (validAssessments.length === 0) {
        alert('有効なGPS情報を含む写真が見つかりませんでした。');
        return;
      }

      const newRoadFeatures = createRoadSegments(validAssessments);
      
      const updatedRoadData = {
        type: "FeatureCollection",
        features: [...(roadData?.features || []), ...newRoadFeatures]
      };
      
      // 各GPSポイントを道路上にスナップし、連続した道路パスを生成
      const gpsPoints = validAssessments.map(a => a.coordinates);
      const damageScores = validAssessments.map(a => a.damageScore);
      
      // 文京区の道路データから道路パスを生成
      const roadPath = generateColoredRoadPathFromGPS(gpsPoints, bunkyoRoads, damageScores);
      
      // 生成された道路パスで色付け
      setColoredRoads(roadPath);
      
      setRoadData(updatedRoadData);
      calculateStatistics(updatedRoadData);

    } catch (error) {
      console.error('Error processing photos:', error);
      alert('写真の処理中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };


  // 道路セグメントを生成する関数(道具)
  // 各写真の評価を基に、GeoJSON形式のポイントとラインを生成
  const createRoadSegments = (assessments: PhotoAssessment[]) => {
    const sortedAssessments = [...assessments].sort((a, b) => 
      (a.originalTimestamp || 0) - (b.originalTimestamp || 0)
    );

    
    // 各ポイントをPointとして追加
    const pointFeatures = sortedAssessments.map((assessment, index) => ({
      type: "Feature",
      properties: {
        pointId: `point-${index}`,
        damageScore: assessment.damageScore,
        lastUpdated: new Date().toLocaleString('ja-JP')
      },
      geometry: {
        type: "Point",
        coordinates: assessment.coordinates
      }
    }));
    
    // (線を一度繋がなくする)連続するポイント間をLineStringとして追加
    const lineFeatures = [];
    for (let i = 0; i < sortedAssessments.length - 1; i++) {
      const current = sortedAssessments[i];
      const next = sortedAssessments[i + 1];
      
      // 座標が有効かチェック
      if (!current.coordinates || !next.coordinates) {
        console.warn(`Invalid coordinates at index ${i}`);
        continue;
      }
      
      const avgScore = Math.round((current.damageScore + next.damageScore) / 2);
      
      lineFeatures.push({
        type: "Feature",
        properties: {
          roadName: `区道${new Date().getTime()}-${i}`,
          damageScore: avgScore,
          lastUpdated: new Date().toLocaleString('ja-JP')
        },
        geometry: {
          type: "LineString",
          coordinates: [
            current.coordinates,
            next.coordinates
          ]
        }
      });
    } 
    
    
    // ポイントとラインの両方を返す
    return [...pointFeatures];
  };


  // EXIFデータからタイムスタンプを抽出する関数(道具)
  const extractTimestamp = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      EXIF.getData(file as any, function() {
        const exifData = EXIF.getAllTags(this);
        let timestamp = 0;
        
        if (exifData && exifData.DateTimeOriginal) {
          const dateStr = exifData.DateTimeOriginal;
          const [date, time] = dateStr.split(' ');
          const [year, month, day] = date.split(':');
          const [hour, minute, second] = time.split(':');
          timestamp = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          ).getTime();
        } else {
          timestamp = file.lastModified;
        }
        
        resolve(timestamp);
      });
    });
  };


  // EXIFデータからGPS座標を抽出する関数(道具)
  const extractGPSCoordinates = (file: File): Promise<[number, number] | null> => {
    return new Promise((resolve) => {
      EXIF.getData(file as any, function() {
        const exifData = EXIF.getAllTags(this);
        
        if (exifData && exifData.GPSLatitude && exifData.GPSLongitude) {
          const lat = convertDMSToDD(exifData.GPSLatitude, exifData.GPSLatitudeRef);
          const lng = convertDMSToDD(exifData.GPSLongitude, exifData.GPSLongitudeRef);
          resolve([lng, lat]); // Swap for GeoJSON format
        } else {
          resolve(null);
        }
      });
    });
  };


  // DMS形式の座標をDD形式に変換する関数(道具)
  const convertDMSToDD = (dms: number[], ref: string): number => {
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    
    let dd = degrees + minutes / 60 + seconds / 3600;
    
    if (ref === 'S' || ref === 'W') {
      dd = dd * -1;
    }
    
    return dd;
  };

  return (
    <DataContext.Provider value={{ roadData, statistics, uploadPhotos, processVideo, loading, coloredRoads }}>
      {children}
    </DataContext.Provider>
  );
};
