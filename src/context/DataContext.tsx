import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import mockRoadData from '../data/mockRoadData';
import bunkyoRoadsData from '../data/bunkyoRoadsData';
import { simulateAIDamageAssessment } from '../utils/aiSimulation';
import { findNearestRoad, findNearestRoadsForPoints } from '../utils/spatialUtils';
import { findNearestRoadsForGPSPoints } from '../utils/roadUtils';
import { generateColoredRoadPathFromGPS } from '../utils/roadPathUtils';
import { Feature, LineString } from 'geojson';

interface DataContextType {
  roadData: any;
  statistics: StatisticsType;
  uploadPhotos: (files: File[]) => void;
  processVideo: (file: File, gpsData: GPSData[]) => void;
  loading: boolean;
  coloredRoads: Feature<LineString>[];
}

interface StatisticsType {
  minorDamage: number;
  moderateDamage: number;
  severeDamage: number;
  totalAssessments: number;
  lastUpdated: string;
}

interface PhotoAssessment {
  coordinates: [number, number];
  damageScore: number;
  timestamp: string;
  originalTimestamp?: number;
}

interface GPSData {
  timestamp: string;
  latitude: number;
  longitude: number;
}

const initialStatistics: StatisticsType = {
  minorDamage: 0,
  moderateDamage: 0,
  severeDamage: 0,
  totalAssessments: 0,
  lastUpdated: '-'
};

const DataContext = createContext<DataContextType>({
  roadData: null,
  statistics: initialStatistics,
  uploadPhotos: () => {},
  processVideo: () => {},
  loading: false,
  coloredRoads: []
});

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

  const calculateStatistics = (data: any) => {
    if (!data || !data.features) return;
    
    const counts = {
      minor: 0,
      moderate: 0,
      severe: 0,
      total: 0
    };

    data.features.forEach((feature: any) => {
      const score = feature.properties.damageScore || 0;
      counts.total++;
      
      if (score <= 1) counts.minor++;
      else if (score <= 3) counts.moderate++;
      else counts.severe++;
    });

    setStatistics({
      minorDamage: counts.minor,
      moderateDamage: counts.moderate,
      severeDamage: counts.severe,
      totalAssessments: counts.total,
      lastUpdated: new Date().toLocaleString('ja-JP')
    });
  };

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
    
    // 連続するポイント間をLineStringとして追加
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
    return [...pointFeatures, ...lineFeatures];
  };

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