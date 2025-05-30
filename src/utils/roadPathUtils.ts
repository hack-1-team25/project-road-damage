// 道路スナップとパス生成のためのユーティリティ関数
import { Feature, LineString, Point } from 'geojson';
import { haversineDistance, pointToLineDistance } from './spatialUtils';

// GPSポイントを最も近い道路上の点にスナップする関数
export function snapPointToRoad(
  point: [number, number],
  roads: Feature<LineString>[]
): { 
  snappedPoint: [number, number]; 
  road: Feature<LineString>; 
  segmentIndex: number;
  distance: number;
} | null {
  if (!roads || roads.length === 0) {
    return null;
  }

  let nearestRoad = null;
  let minDistance = Infinity;
  let nearestSegmentIndex = -1;
  let snappedPoint: [number, number] = [0, 0];

  // 全ての道路線を調べる
  for (const road of roads) {
    if (!road.geometry || !road.geometry.coordinates) continue;
    
    const coordinates = road.geometry.coordinates;
    
    // 道路線の各線分について最短距離を計算
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];
      
      // 点と線分の最短距離を計算
      const distance = pointToLineDistance(point, start, end);
      
      // より近い道路線が見つかれば更新
      if (distance < minDistance) {
        minDistance = distance;
        nearestRoad = road;
        nearestSegmentIndex = i;
        
        // 線分上の最近接点（スナップ先）を計算
        snappedPoint = projectPointOnSegment(point, start, end);
      }
    }
  }

  return nearestRoad ? { 
    snappedPoint, 
    road: nearestRoad, 
    segmentIndex: nearestSegmentIndex,
    distance: minDistance 
  } : null;
}

// 点を線分上に投影する関数
function projectPointOnSegment(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): [number, number] {
  const [lon, lat] = point;
  const [lon1, lat1] = lineStart;
  const [lon2, lat2] = lineEnd;
  
  // 線分の長さの2乗
  const lengthSquared = Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2);
  
  // 線分の長さが0の場合（始点と終点が同じ場合）
  if (lengthSquared === 0) {
    return lineStart;
  }
  
  // 線分上の最近接点を求めるためのパラメータ t
  // t = 0 なら始点、t = 1 なら終点、0 < t < 1 なら線分上の点
  const t = Math.max(0, Math.min(1, (
    (lon - lon1) * (lon2 - lon1) + (lat - lat1) * (lat2 - lat1)
  ) / lengthSquared));
  
  // 線分上の最近接点の座標
  const projectionLon = lon1 + t * (lon2 - lon1);
  const projectionLat = lat1 + t * (lat2 - lat1);
  
  return [projectionLon, projectionLat];
}

// 連続するGPSポイントから道路パスを生成する関数
export function generateRoadPath(
  gpsPoints: [number, number][],
  roads: Feature<LineString>[]
): Feature<LineString>[] {
  if (!gpsPoints || gpsPoints.length === 0 || !roads || roads.length === 0) {
    return [];
  }

  const roadSegments: Feature<LineString>[] = [];
  const processedRoadIds = new Set<string>();
  
  // 各GPSポイントをスナップ
  const snappedPoints = gpsPoints.map(point => snapPointToRoad(point, roads));
  
  // 連続するスナップポイント間のパスを生成
  for (let i = 0; i < snappedPoints.length - 1; i++) {
    const current = snappedPoints[i];
    const next = snappedPoints[i + 1];
    
    if (!current || !next) continue;
    
    // 同じ道路上の場合
    if (current.road.id === next.road.id) {
      const roadId = current.road.id?.toString() || 
                    `${current.road.geometry.coordinates[0][0]}-${current.road.geometry.coordinates[0][1]}`;
      
      // 既に処理済みの道路は重複して追加しない
      if (!processedRoadIds.has(roadId)) {
        processedRoadIds.add(roadId);
        
        // 道路のプロパティに損傷スコアを追加
        const roadWithScore = {
          ...current.road,
          properties: {
            ...current.road.properties,
            damageScore: calculateAverageDamageScore(i, i + 1, snappedPoints)
          }
        };
        
        roadSegments.push(roadWithScore);
      }
    } 
    // 異なる道路の場合、両方の道路を追加
    else {
      const currentRoadId = current.road.id?.toString() || 
                          `${current.road.geometry.coordinates[0][0]}-${current.road.geometry.coordinates[0][1]}`;
      const nextRoadId = next.road.id?.toString() || 
                        `${next.road.geometry.coordinates[0][0]}-${next.road.geometry.coordinates[0][1]}`;
      
      if (!processedRoadIds.has(currentRoadId)) {
        processedRoadIds.add(currentRoadId);
        
        const roadWithScore = {
          ...current.road,
          properties: {
            ...current.road.properties,
            damageScore: calculateAverageDamageScore(i, i, snappedPoints)
          }
        };
        
        roadSegments.push(roadWithScore);
      }
      
      if (!processedRoadIds.has(nextRoadId)) {
        processedRoadIds.add(nextRoadId);
        
        const roadWithScore = {
          ...next.road,
          properties: {
            ...next.road.properties,
            damageScore: calculateAverageDamageScore(i + 1, i + 1, snappedPoints)
          }
        };
        
        roadSegments.push(roadWithScore);
      }
      
      // 必要に応じて道路間の接続経路を探索・追加
      const connectionPath = findConnectionPath(current.road, next.road, roads);
      if (connectionPath && connectionPath.length > 0) {
        for (const segment of connectionPath) {
          const segmentId = segment.id?.toString() || 
                          `${segment.geometry.coordinates[0][0]}-${segment.geometry.coordinates[0][1]}`;
          
          if (!processedRoadIds.has(segmentId)) {
            processedRoadIds.add(segmentId);
            
            const segmentWithScore = {
              ...segment,
              properties: {
                ...segment.properties,
                damageScore: calculateAverageDamageScore(i, i + 1, snappedPoints)
              }
            };
            
            roadSegments.push(segmentWithScore);
          }
        }
      }
    }
  }

  return roadSegments;
}

// 道路間の接続経路を探索する関数（簡易版）
function findConnectionPath(
  roadA: Feature<LineString>,
  roadB: Feature<LineString>,
  allRoads: Feature<LineString>[]
): Feature<LineString>[] {
  // 実際のアプリケーションでは、グラフ探索アルゴリズム（ダイクストラなど）を使用して
  // 道路ネットワーク上の最短経路を探索する必要があります
  // ここでは簡易的に、直接接続されている場合のみ対応
  
  const coordsA = roadA.geometry.coordinates;
  const coordsB = roadB.geometry.coordinates;
  
  // 道路Aの終点と道路Bの始点が近い場合
  const endA = coordsA[coordsA.length - 1];
  const startB = coordsB[0];
  
  if (haversineDistance(endA[1], endA[0], startB[1], startB[0]) < 50) { // 50m以内なら接続と見なす
    return []; // 直接接続されているので追加の道路セグメントは不要
  }
  
  // 道路Aの始点と道路Bの終点が近い場合
  const startA = coordsA[0];
  const endB = coordsB[coordsB.length - 1];
  
  if (haversineDistance(startA[1], startA[0], endB[1], endB[0]) < 50) {
    return []; // 直接接続されているので追加の道路セグメントは不要
  }
  
  // 道路Aの終点と道路Bの終点が近い場合
  if (haversineDistance(endA[1], endA[0], endB[1], endB[0]) < 50) {
    return []; // 直接接続されているので追加の道路セグメントは不要
  }
  
  // 道路Aの始点と道路Bの始点が近い場合
  if (haversineDistance(startA[1], startA[0], startB[1], startB[0]) < 50) {
    return []; // 直接接続されているので追加の道路セグメントは不要
  }
  
  // 接続経路が見つからない場合は空配列を返す
  return [];
}

// 指定範囲のスナップポイントの平均損傷スコアを計算する関数
function calculateAverageDamageScore(
  startIndex: number,
  endIndex: number,
  snappedPoints: Array<ReturnType<typeof snapPointToRoad>>
): number {
  // 実際のアプリケーションでは、GPSポイントに紐づく損傷スコアを使用
  // ここでは簡易的に1〜5のランダムなスコアを返す
  return Math.floor(Math.random() * 5) + 1;
}

// GPSポイントに基づいて道路パスを生成し、色付けする関数
export function generateColoredRoadPathFromGPS(
  gpsPoints: [number, number][],
  roads: Feature<LineString>[],
  damageScores?: number[] // オプション: GPSポイントごとの損傷スコア
): Feature<LineString>[] {
  // GPSポイントをスナップして道路パスを生成
  const roadPath = generateRoadPath(gpsPoints, roads);
  
  // 損傷スコアが提供されている場合は使用
  if (damageScores && damageScores.length === gpsPoints.length) {
    // 各道路セグメントに対応するGPSポイントの損傷スコアを割り当て
    // 実装は省略（実際のアプリケーションでは必要に応じて実装）
  }
  
  return roadPath;
}
