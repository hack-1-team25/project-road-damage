// 最近接道路を探索し、色を変更するための関数
import { findNearestRoad } from './spatialUtils';
import { Feature, LineString } from 'geojson';

// 損傷スコアに基づいて色を決定する関数
export function getDamageColor(score: number): string {
  if (score <= 1) return '#22c55e'; // Green - Minor damage
  if (score <= 3) return '#eab308'; // Yellow - Moderate damage
  return '#ef4444'; // Red - Severe damage
}

// GPSポイントに最も近い道路を探索する関数
export function findNearestRoadsForGPSPoints(
  gpsPoints: [number, number][],
  roads: Feature<LineString>[]
): Feature<LineString>[] {
  if (!gpsPoints || gpsPoints.length === 0 || !roads || roads.length === 0) {
    return [];
  }

  const nearestRoads: Feature<LineString>[] = [];
  const processedRoadIds = new Set<string>();

  // 各GPSポイントについて最近接道路を探索
  for (const point of gpsPoints) {
    const nearest = findNearestRoad(point, roads);
    
    if (nearest && nearest.road) {
      const roadId = nearest.road.id?.toString() || 
                    `${nearest.road.geometry.coordinates[0][0]}-${nearest.road.geometry.coordinates[0][1]}`;
      
      // 同じ道路が重複して追加されないようにする
      if (!processedRoadIds.has(roadId)) {
        processedRoadIds.add(roadId);
        
        // 道路のプロパティに損傷スコアを追加
        const roadWithScore = {
          ...nearest.road,
          properties: {
            ...nearest.road.properties,
            damageScore: calculateDamageScoreForRoad(point, gpsPoints)
          }
        };
        
        nearestRoads.push(roadWithScore);
      }
    }
  }

  return nearestRoads;
}

// 道路の損傷スコアを計算する関数
function calculateDamageScoreForRoad(
  targetPoint: [number, number],
  allPoints: [number, number][]
): number {
  // 近くのポイントの損傷スコアを考慮して計算
  // 実際のアプリケーションでは、より複雑なロジックが必要かもしれない
  // ここでは簡易的に1〜5のランダムなスコアを返す
  return Math.floor(Math.random() * 5) + 1;
}
