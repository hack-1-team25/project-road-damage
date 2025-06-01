// 最近接道路検索のためのユーティリティ関数
import { Feature, LineString, Point } from 'geojson';

// 2点間の距離を計算する関数（ハバーサイン公式）
export function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371000; // 地球の半径（メートル）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 点と線分の最短距離を計算する関数
export function pointToLineDistance(
  point: [number, number], 
  lineStart: [number, number], 
  lineEnd: [number, number]
): number {
  // 点と線分の最短距離を計算
  const [lon, lat] = point;
  const [lon1, lat1] = lineStart;
  const [lon2, lat2] = lineEnd;
  
  // 線分の長さの2乗
  const lengthSquared = Math.pow(haversineDistance(lat1, lon1, lat2, lon2), 2);
  
  // 線分の長さが0の場合（始点と終点が同じ場合）
  if (lengthSquared === 0) {
    return haversineDistance(lat, lon, lat1, lon1);
  }
  
  // 線分上の最近接点を求めるためのパラメータ t
  // t = 0 なら始点、t = 1 なら終点、0 < t < 1 なら線分上の点
  const t = Math.max(0, Math.min(1, (
    (lon - lon1) * (lon2 - lon1) + (lat - lat1) * (lat2 - lat1)
  ) / lengthSquared));
  
  // 線分上の最近接点の座標
  const projectionLon = lon1 + t * (lon2 - lon1);
  const projectionLat = lat1 + t * (lat2 - lat1);
  
  // 点と最近接点の距離を返す
  return haversineDistance(lat, lon, projectionLat, projectionLon);
}

// 点に最も近い道路線を見つける関数
export function findNearestRoad(
  point: [number, number], 
  roads: Feature<LineString>[]
): { road: Feature<LineString>; distance: number } | null {
  if (!roads || roads.length === 0) {
    return null;
  }

  let nearestRoad = null;
  let minDistance = Infinity;

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
      }
    }
  }

  return nearestRoad ? { road: nearestRoad, distance: minDistance } : null;
}

// 複数の点に対して最も近い道路線を見つける関数
export function findNearestRoadsForPoints(
  points: [number, number][], 
  roads: Feature<LineString>[]
): Map<string, Feature<LineString>> {
  const roadMap = new Map<string, Feature<LineString>>();
  
  // 各点について最近接道路を探索
  for (const point of points) {
    const nearest = findNearestRoad(point, roads);
    if (nearest && nearest.road.id) {
      roadMap.set(nearest.road.id.toString(), nearest.road);
    }
  }
  
  return roadMap;
}
