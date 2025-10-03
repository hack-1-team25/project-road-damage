// utils/ahpScoring.ts

import bunkyoRoadsGeoJSON from '../data/bunkyoRoadsGeoJSON.json';
import { calculateAHPWeights } from './calculateAHPWeights';

interface FeatureProperties {
  [key: string]: any;
}

function normalizeProperties(properties: FeatureProperties) {
  const damageScoreMap: Record<string, number> = {
    D50: 0.5,
    D40: 0.4,
    D20: 0.2,
    D43: 0.43,
    D44: 0.44,
    D10: 0.2,
    S00: 0.0,
  };

  const pavementMap: Record<string, number> = {
    アスファルト: 1.0,
    コンクリート: 0.8,
    その他: 0.5,
  };

  const trafficMap: Record<string, number> = {
    少: 0.2,
    中: 0.5,
    多: 1.0,
  };

  const drainageMap: Record<string, number> = {
    良: 1.0,
    普通: 0.5,
    不良: 0.0,
  };

  return {
    damage: damageScoreMap[properties['Damage Severity']] ?? 0,
    confidence: properties['Confidence Level'] ?? 0,
    pavement: pavementMap[properties['Type of Pavement']] ?? 0.1,
    repair: Math.min(properties['Road Repair History'] / 30, 1.0),
    age: Math.min(properties['Year of Construction'] / 50, 1.0),
    waterPipe: properties['Presence of Water Pipe'] > 0
      ? 0.5 + Math.min(properties['Presence of Water Pipe'] / 100, 0.5)
      : 0.0,
    gasPipe: properties['Presence of Gas Pipe'] > 0
      ? 0.5 + Math.min(properties['Presence of Gas Pipe'] / 100, 0.5)
      : 0.0,
    traffic: trafficMap[properties['Traffic Volume']] ?? 0.5,
    drainage: drainageMap[properties['Drainage Performance']] ?? 0.5,
  };
}

//ここだけ用途に合わせて変更する
// AHP比較行列（対称性とスケールを持たせる）
// 1-9スケールを使用し、1は等しい、3はやや重要、5はかなり重要、7は非常に重要、9は極めて重要
//例えば damage:repair = 5 → 「損傷の深刻度は補修履歴の5倍重要」。
//妥当性の評価
// CI = (λ_max - n) / (n - 1)
// CR = CI / RI   ← RI = ランダム一致指数（n=9のときは約1.45）
// CR < 0.1 なら整合性良好（判断は妥当）
const ahpMatrix = [
  [1,   3,   5,   5,   5,   7,   7,   3,   5],
  [1/3, 1,   3,   3,   3,   5,   5,   3,   3],
  [1/5, 1/3, 1,   1,   1,   3,   3,   1,   3],
  [1/5, 1/3, 1,   1,   1,   3,   3,   1,   3],
  [1/5, 1/3, 1,   1,   1,   3,   3,   1,   3],
  [1/7, 1/5, 1/3, 1/3, 1/3, 1,   1,   1/3, 1],
  [1/7, 1/5, 1/3, 1/3, 1/3, 1,   1,   1/3, 1],
  [1/3, 1/3, 1,   1,   1,   3,   3,   1,   3],
  [1/5, 1/3, 1/3, 1/3, 1/3, 1,   1,   1/3, 1],
];


const criteria = [
  "damage", "confidence", "pavement", "repair", "age",
  "waterPipe", "gasPipe", "traffic", "drainage"
];

const { weights } = calculateAHPWeights(ahpMatrix);

// ✅ 各 feature に対応するスコアだけを配列で返す（AHP動的重み使用）
export function getAHPScoreMap(): { index: number; score: number }[] {
  return bunkyoRoadsGeoJSON.features.map((feature, index) => {
    const scores = normalizeProperties(feature.properties);
    const totalScore = criteria.reduce((sum, key, i) => {
      return sum + weights[i] * scores[key];
    }, 0);
    return { index, score: parseFloat(totalScore.toFixed(3)) };
  });
}
