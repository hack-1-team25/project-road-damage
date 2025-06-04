import React, { useState } from 'react';
import MapView from '../components/MapView';
import RoadReportPanel from '../components/RoadReportPanel'; //AIレポート
import StatisticsPanel from '../components/StatisticsPanel';
import UploadPanel from '../components/UploadPanel';
import { useData } from '../context/DataContext';


const Dashboard: React.FC = () => {
  const { loading } = useData();
  const [selectedRoads, setSelectedRoads] = useState<any[]>([]);//AIレポート

  return (
    // <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
    //   <div className="lg:w-3/4 h-full">
    //     <MapView />
    //   </div>
    //   <div className="lg:w-1/4 h-full overflow-y-auto bg-white border-l border-gray-200">
    //     <div className="p-4">
    //       <UploadPanel />
    //       <div className="mt-6">
    //         <StatisticsPanel />
    //       </div>
    //       {loading && (
    //         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    //           <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-4">
    //             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    //             <p>処理中...</p>
    //           </div>
    //         </div>
    //       )}
    //     </div>
    //   </div>
    // </div>
    //AIレポート
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      <div className="lg:w-3/4 h-full">
      <MapView onSelectRoad={(road) => {
        setSelectedRoads((prev) => {
          const alreadySelected = prev.some(r =>
            r.roadName === road.roadName &&
            JSON.stringify(r.coordinates) === JSON.stringify(road.coordinates)
          );
          return alreadySelected ? prev : [...prev, road];
        });
      }} />
        
      </div>
      <div className="lg:w-1/4 h-full overflow-y-auto bg-white border-l border-gray-200">
        <div className="p-4">
          <UploadPanel />
          <div className="mt-6">
            <StatisticsPanel />
          </div>
          <div className="mt-6">
            {selectedRoads ? (
              <RoadReportPanel roads={selectedRoads} />
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
