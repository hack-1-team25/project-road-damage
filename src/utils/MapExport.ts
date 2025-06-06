import html2canvas from 'html2canvas';

// 地図エクスポート用のユーティリティ関数
export const exportMapAsImage = async (
  mapContainer: HTMLElement,
  filename: string = 'bunkyo-map',
  format: 'png' | 'jpeg' = 'png'
): Promise<void> => {
  try {
    // html2canvasを使用してマップコンテナをキャプチャ
    const canvas = await html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: 2, // 高解像度でキャプチャ
      width: mapContainer.offsetWidth,
      height: mapContainer.offsetHeight,
      scrollX: 0,
      scrollY: 0,
    });

    // キャンバスを画像データに変換
    const imageData = canvas.toDataURL(`image/${format}`, 0.95);
    
    // ダウンロードリンクを作成
    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = imageData;
    
    // ダウンロードを実行
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('地図のエクスポートが完了しました');
  } catch (error) {
    console.error('地図のエクスポートに失敗しました:', error);
    throw error;
  }
};

// 文京区の境界座標（おおよその範囲）
export const BUNKYO_BOUNDS = {
  north: 35.7280,
  south: 35.6880,
  east: 139.7720,
  west: 139.7300
};

// 文京区エリアに地図をフィットさせる関数
export const fitMapToBunkyoBounds = (map: L.Map): void => {
  const bounds = L.latLngBounds(
    [BUNKYO_BOUNDS.south, BUNKYO_BOUNDS.west],
    [BUNKYO_BOUNDS.north, BUNKYO_BOUNDS.east]
  );
  map.fitBounds(bounds, { padding: [20, 20] });
};

// エクスポート設定のインターフェース
export interface ExportSettings {
  format: 'png' | 'jpeg';
  filename: string;
  includeTimestamp: boolean;
  fitToBounds: boolean;
}

// デフォルトのエクスポート設定
export const defaultExportSettings: ExportSettings = {
  format: 'png',
  filename: 'bunkyo-road-map',
  includeTimestamp: true,
  fitToBounds: true
};

// タイムスタンプ付きファイル名を生成する関数
export const generateFilename = (baseName: string, includeTimestamp: boolean = true): string => {
  if (!includeTimestamp) {
    return baseName;
  }
  
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
  return `${baseName}_${timestamp}`;
};

