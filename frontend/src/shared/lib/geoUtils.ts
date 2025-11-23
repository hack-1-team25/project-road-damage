// lib/geoUtils.ts

/**
 * 2点間の距離をメートル単位で計算（Haversine formula）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // 地球の半径（メートル）
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // メートル
}

/**
 * 点から線分への最短距離を計算
 */
export function pointToLineSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 点から道路（LineString）への最短距離を計算（メートル単位）
 */
export function pointToRoadDistance(
  pointLat: number,
  pointLon: number,
  roadCoordinates: number[][] | number[][][]
): number {
  let minDistance = Infinity;

  // LineStringの場合
  if (Array.isArray(roadCoordinates[0]) && typeof roadCoordinates[0][0] === 'number') {
    const coords = roadCoordinates as number[][];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];

      // 簡易的な計算のため、緯度経度を直接使用
      // より正確には投影座標系を使用すべきだが、小範囲では許容範囲
      const distance = pointToLineSegmentDistance(
        pointLon,
        pointLat,
        lon1,
        lat1,
        lon2,
        lat2
      );

      // 度数からメートルに変換（緯度1度≈111km、経度は緯度により変動）
      const avgLat = (lat1 + lat2 + pointLat) / 3;
      const metersPerDegreeLat = 111000;
      const metersPerDegreeLon = 111000 * Math.cos((avgLat * Math.PI) / 180);
      const distanceInMeters = Math.sqrt(
        Math.pow(distance * metersPerDegreeLon, 2) +
        Math.pow(distance * metersPerDegreeLat, 2)
      );

      minDistance = Math.min(minDistance, distanceInMeters);
    }
  }
  // MultiLineStringの場合
  else if (Array.isArray(roadCoordinates[0]) && Array.isArray(roadCoordinates[0][0])) {
    const multiCoords = roadCoordinates as number[][][];
    for (const lineString of multiCoords) {
      const distance = pointToRoadDistance(pointLat, pointLon, lineString);
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance;
}

/**
 * 道路の近くにある危険箇所を取得
 */
export function getDangerSpotsNearRoad(
  roadCoordinates: number[][] | number[][][],
  dangerSpots: Array<{ latitude: number; longitude: number; danger_score: number }>,
  maxDistanceMeters: number = 50 // デフォルト50メートル以内
): Array<{ distance: number; danger_score: number }> {
  const nearbySpots: Array<{ distance: number; danger_score: number }> = [];

  for (const spot of dangerSpots) {
    const distance = pointToRoadDistance(spot.latitude, spot.longitude, roadCoordinates);
    if (distance <= maxDistanceMeters) {
      nearbySpots.push({
        distance,
        danger_score: spot.danger_score,
      });
    }
  }

  return nearbySpots;
}
