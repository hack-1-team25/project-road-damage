// utils/calculateAHPWeights.ts

export function calculateAHPWeights(matrix: number[][]): { weights: number[], criteria: string[] } {
    const n = matrix.length;
  
    // ステップ1：列の合計を求める
    const colSums = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        colSums[j] += matrix[i][j];
      }
    }
  
    // ステップ2：行列を正規化（各要素 ÷ 列合計）
    const normalizedMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      normalizedMatrix[i] = [];
      for (let j = 0; j < n; j++) {
        normalizedMatrix[i][j] = matrix[i][j] / colSums[j];
      }
    }
  
    // ステップ3：各行の平均（＝重み）を求める
    const weights: number[] = [];
    for (let i = 0; i < n; i++) {
      const rowSum = normalizedMatrix[i].reduce((sum, val) => sum + val, 0);
      weights[i] = parseFloat((rowSum / n).toFixed(4));
    }
  
    return {
      weights,
      criteria: [] // 必要なら ["damage", "confidence", ...] をここで返してもOK
    };
  }
  