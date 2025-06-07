import React, { useState } from 'react';
import MapView from '../components/MapView';
import RoadReportPanel from '../components/RoadReportPanel'; //AIレポート
import StatisticsPanel from '../components/StatisticsPanel';
import UploadPanel from '../components/UploadPanel';
import { useData } from '../context/DataContext';
import MapExportControl from '../components/MapExportControl'; // エクスポートコントロールをインポート


const Dashboard: React.FC = () => {
  const { loading } = useData();
  const [selectedRoads, setSelectedRoads] = useState<any[]>([]);//AIレポート
  const [isExporting, setIsExporting] = useState<boolean>(false); // エクスポート状態
  const [mapReady, setMapReady] = useState<boolean>(false); // マップの準備完了状態

  // 個別削除機能
  const handleRemoveRoad = (indexToRemove: number) => {
    setSelectedRoads(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // 一括削除機能
  const handleClearAllRoads = () => {
    setSelectedRoads([]);
  };

  // マップの準備完了状態を更新するコールバック
  const handleMapReady = (ready: boolean) => {
    setMapReady(ready);
  };

  // エクスポート状態を更新するコールバック
  const handleExportStateChange = (exporting: boolean) => {
    setIsExporting(exporting);
  };

  return (
    //AIレポート
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      <div className="lg:w-3/4 h-full">
      <MapView 
        onSelectRoad={(road) => {
          setSelectedRoads((prev) => {
            const alreadySelected = prev.some(r =>
              r.roadName === road.roadName &&
              JSON.stringify(r.coordinates) === JSON.stringify(road.coordinates)
            );
            return alreadySelected ? prev : [...prev, road];
          });
        }}
        onMapReady={handleMapReady}
        onExportStateChange={handleExportStateChange}
      />
        
      </div>
      <div className="lg:w-1/4 h-full overflow-y-auto bg-white border-l border-gray-200">
        <div className="p-4">
          {/* エクスポートコントロールを右側パネルの最上部に配置 */}
          {/* <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">地図エクスポート</h2>
            <MapExportControl 
              onExport={(settings) => {
                // MapViewコンポーネントのエクスポート機能を呼び出すためのイベント発火
                const exportEvent = new CustomEvent('map-export', { detail: settings });
                window.dispatchEvent(exportEvent);
              }}
              isExporting={isExporting}
              disabled={!mapReady}
            />
          </div> */}
          
          <UploadPanel />
          <div className="mt-6">
            <StatisticsPanel />
          </div>
          <div className="mt-6">
            {selectedRoads ? (
              <RoadReportPanel 
                roads={selectedRoads} 
                onRemoveRoad={handleRemoveRoad}
                onClearAllRoads={handleClearAllRoads}
              />
            ) : (
              <div className="text-sm text-gray-500">地図上の道路を選択するとレポートを表示できます</div>
            )}
          </div>
          {loading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p>処理中...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
