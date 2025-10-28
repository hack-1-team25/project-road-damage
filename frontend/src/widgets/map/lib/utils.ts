// 損傷スコアに基づいて色を返す
export function getDangerColor(score: number): string {
  if (score <= 0) return '#3b82f6'; // blue - 損傷なし
  if (score <= 2) return '#22c55e'; // green - 軽度
  if (score <= 4) return '#eab308'; // yellow - 中度
  return '#ef4444'; // red - 重度
}

// 損傷クラスに基づいて説明を返す
export function getDamageDescription(damageClass: string | null): string {
  if (!damageClass) return '損傷なし';
  
  const descriptions: Record<string, string> = {
    D00: '縦方向ひび割れ',
    D10: '横方向ひび割れ',
    D20: 'ワニ皮状ひび割れ',
    D40: 'ポットホール（穴ぼこ）',
    D43: '白線のぼやけ',
    D44: '横断歩道のぼやけ',
    D50: 'マンホールカバー'
  };
  
  return descriptions[damageClass] || '不明な損傷';
}
