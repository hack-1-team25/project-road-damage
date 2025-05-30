import React from 'react';
import { useData } from '../context/DataContext';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const StatisticsPanel: React.FC = () => {
  const { statistics } = useData();
  
  const chartData = {
    labels: ['軽微 (0-1)', '中程度 (2-3)', '重度 (4-5)'],
    datasets: [
      {
        data: [
          statistics.minorDamage,
          statistics.moderateDamage,
          statistics.severeDamage
        ],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            size: 12
          }
        }
      }
    },
    maintainAspectRatio: false
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-4">損傷状況統計</h2>
        
        <div className="space-y-4">
          <div className="h-48 w-full">
            <Doughnut data={chartData} options={options} />
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 p-2 rounded">
              <p className="text-xs text-gray-600">軽微</p>
              <p className="text-lg font-semibold text-green-600">{statistics.minorDamage}</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <p className="text-xs text-gray-600">中程度</p>
              <p className="text-lg font-semibold text-yellow-600">{statistics.moderateDamage}</p>
            </div>
            <div className="bg-red-50 p-2 rounded">
              <p className="text-xs text-gray-600">重度</p>
              <p className="text-lg font-semibold text-red-600">{statistics.severeDamage}</p>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">合計検査箇所:</span>
              <span className="font-medium">{statistics.totalAssessments}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">最終更新:</span>
              <span className="font-medium">{statistics.lastUpdated}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;