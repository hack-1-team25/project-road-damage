// 道路グルーピングと代表危険度計算のためのユーティリティ関数
import { Feature, LineString, Point } from 'geojson';
import { snapPointToRoad } from './roadPathUtils';
import { damageClassDescriptions } from './aiSimulation';

// 入力点を最も近い道路にグルーピングする関数
export interface PointData {
  coordinates: [number, number];
  damageScore: number;
  damageClass?: string;
  confidence?: number;
  timestamp?: string;
  originalTimestamp?: number;
}

export interface RoadGroup {
  roadId: string;
  road: Feature<LineString>;
  points: PointData[];
  representativePoint: RepresentativePoint | null;
}

export interface RepresentativePoint {
  coordinates: [number, number];
  damageScore: number;
  damageClass?: string;
  confidence?: number;
  lastUpdated: string;
}

// 入力点を道路ごとにグルーピングする関数
export function groupPointsByRoad(
  points: PointData[],
  roads: Feature<LineString>[]
): RoadGroup[] {
  if (!points || points.length === 0 || !roads || roads.length === 0) {
    return [];
  }

  // 道路IDごとのグループを初期化
  const roadGroups: Map<string, RoadGroup> = new Map();

  // 各ポイントを最も近い道路にスナップしてグルーピング
  for (const point of points) {
    const snappedResult = snapPointToRoad(point.coordinates, roads);
    
    if (!snappedResult) continue;
    
    const { road } = snappedResult;
    const roadId = road.id?.toString() || 
                  `${road.geometry.coordinates[0][0]}-${road.geometry.coordinates[0][1]}`;
    
    // 既存のグループがあれば更新、なければ新規作成
    if (roadGroups.has(roadId)) {
      const group = roadGroups.get(roadId)!;
      group.points.push(point);
    } else {
      roadGroups.set(roadId, {
        roadId,
        road,
        points: [point],
        representativePoint: null
      });
    }
  }

  // 各道路グループの代表点（最も危険な点）を計算
  for (const group of roadGroups.values()) {
    group.representativePoint = calculateRepresentativePoint(group.points);
  }

  return Array.from(roadGroups.values());
}

// 道路グループ内で最も危険な点を代表点として選定する関数
export function calculateRepresentativePoint(points: PointData[]): RepresentativePoint | null {
  if (!points || points.length === 0) {
    return null;
  }

  // 最も危険度の高い点（damageScoreが最大の点）を見つける
  let mostDangerousPoint = points[0];
  
  for (let i = 1; i < points.length; i++) {
    const currentPoint = points[i];
    
    // 危険度が高い場合、または同じ危険度でも信頼度が高い場合に更新
    if (currentPoint.damageScore > mostDangerousPoint.damageScore || 
        (currentPoint.damageScore === mostDangerousPoint.damageScore && 
         (currentPoint.confidence || 0) > (mostDangerousPoint.confidence || 0))) {
      mostDangerousPoint = currentPoint;
    }
  }

  return {
    coordinates: mostDangerousPoint.coordinates,
    damageScore: mostDangerousPoint.damageScore,
    damageClass: mostDangerousPoint.damageClass,
    confidence: mostDangerousPoint.confidence,
    lastUpdated: new Date().toLocaleString('ja-JP')
  };
}

// 道路グループから色付けされた道路GeoJSONを生成する関数
export function createColoredRoadsFromGroups(roadGroups: RoadGroup[]): Feature<LineString>[] {
  if (!roadGroups || roadGroups.length === 0) {
    return [];
  }

  const coloredRoads: Feature<LineString>[] = [];

  for (const group of roadGroups) {
    if (!group.representativePoint) continue;
    
    // 代表点の情報を道路のプロパティに追加
    const coloredRoad: Feature<LineString> = {
      ...group.road,
      properties: {
        ...group.road.properties,
        roadId: group.roadId,
        damageScore: group.representativePoint.damageScore,
        damageClass: group.representativePoint.damageClass || '',
        damageClassDescription: group.representativePoint.damageClass ? 
                               damageClassDescriptions[group.representativePoint.damageClass] || '不明な損傷' : '',
        confidence: group.representativePoint.confidence || 0,
        lastUpdated: group.representativePoint.lastUpdated
      }
    };
    
    coloredRoads.push(coloredRoad);
  }

  return coloredRoads;
}

// 交差点情報を更新する関数（道路の端点を交差点として扱う）
export function updateIntersectionInfo(
  roadGroups: RoadGroup[],
  existingRoads: Feature<LineString>[]
): Feature<Point>[] {
  if (!roadGroups || roadGroups.length === 0) {
    return [];
  }

  const intersections: Feature<Point>[] = [];
  const processedPoints = new Set<string>();

  for (const group of roadGroups) {
    if (!group.representativePoint) continue;
    
    const road = group.road;
    const coords = road.geometry.coordinates;
    
    // 道路の始点と終点を交差点として扱う
    const startPoint = coords[0];
    const endPoint = coords[coords.length - 1];
    
    // 始点を処理
    const startPointKey = `${startPoint[0]},${startPoint[1]}`;
    if (!processedPoints.has(startPointKey)) {
      processedPoints.add(startPointKey);
      
      intersections.push({
        type: "Feature",
        properties: {
          intersectionId: `intersection-${startPointKey}`,
          damageScore: group.representativePoint.damageScore,
          damageClass: group.representativePoint.damageClass || '',
          damageClassDescription: group.representativePoint.damageClass ? 
                                 damageClassDescriptions[group.representativePoint.damageClass] || '不明な損傷' : '',
          confidence: group.representativePoint.confidence || 0,
          lastUpdated: group.representativePoint.lastUpdated
        },
        geometry: {
          type: "Point",
          coordinates: startPoint
        }
      });
    }
    
    // 終点を処理
    const endPointKey = `${endPoint[0]},${endPoint[1]}`;
    if (!processedPoints.has(endPointKey)) {
      processedPoints.add(endPointKey);
      
      intersections.push({
        type: "Feature",
        properties: {
          intersectionId: `intersection-${endPointKey}`,
          damageScore: group.representativePoint.damageScore,
          damageClass: group.representativePoint.damageClass || '',
          damageClassDescription: group.representativePoint.damageClass ? 
                                 damageClassDescriptions[group.representativePoint.damageClass] || '不明な損傷' : '',
          confidence: group.representativePoint.confidence || 0,
          lastUpdated: group.representativePoint.lastUpdated
        },
        geometry: {
          type: "Point",
          coordinates: endPoint
        }
      });
    }
  }

  return intersections;
}
