// export default StatisticsPanel;
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { useData } from '../context/DataContext';
import { getAHPScoreMap } from '../utils/ahpScoring'; // AHPスコアの関数をインポート

ChartJS.register(ArcElement, Tooltip, Legend);

// AHPスコアを分類するための基準
const AHP_THRESHOLDS = {
  SEVERE: 0.7,
  MODERATE: 0.5,
  MINOR: 0.2,
};

const StatisticsPanel: React.FC = () => {
  // 1. useDataから既存の統計データを取得
  const { statistics } = useData();

  // 2. 合算した最終的な統計データを保持するためのstateを定義
  const [combinedStats, setCombinedStats] = useState(statistics);

  // 3. statisticsデータが更新されたら、AHPスコアと合算する処理を実行
  useEffect(() => {
    // AHPスコアを取得して集計
    const ahpScores = getAHPScoreMap();
    const ahpCounts = {
      noDamage: 0,
      minorDamage: 0,
      moderateDamage: 0,
      severeDamage: 0,
    };

    ahpScores.forEach(({ score }) => {
      if (score >= AHP_THRESHOLDS.SEVERE) {
        ahpCounts.severeDamage++;
      } else if (score >= AHP_THRESHOLDS.MODERATE) {
        ahpCounts.moderateDamage++;
      } else if (score >= AHP_THRESHOLDS.MINOR) {
        ahpCounts.minorDamage++;
      } else {
        ahpCounts.noDamage++;
      }
    });

    // 既存の統計データとAHPの統計データを合算
    const newCombinedStats = {
      noDamage: statistics.noDamage + ahpCounts.noDamage,
      minorDamage: statistics.minorDamage + ahpCounts.minorDamage,
      moderateDamage: statistics.moderateDamage + ahpCounts.moderateDamage,
      severeDamage: statistics.severeDamage + ahpCounts.severeDamage,
      totalAssessments: statistics.totalAssessments + ahpScores.length,
      lastUpdated: new Date().toLocaleString(), // 最終更新日時を現在時刻に更新
    };

    setCombinedStats(newCombinedStats);

  }, [statistics]); // statisticsが変更されたときに再計算

  // 4. 合算後のデータ(combinedStats)をグラフに渡す
  const chartData = {
    labels: ['損傷なし', '軽微', '中程度', '重度'],
    datasets: [
      {
        data: [
          combinedStats.noDamage,
          combinedStats.minorDamage,
          combinedStats.moderateDamage,
          combinedStats.severeDamage,
        ],
        backgroundColor: ['#3b82f6', '#22c55e', '#eab308', '#ef4444'],
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
            size: 12,
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-4">損傷状況統計</h2>
        <div className="space-y-4">
          <div className="h-48 w-full">
            <Doughnut data={chartData} options={options} />
          </div>
          {/* 表示部分も合算後のデータ(combinedStats)を使用する */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-blue-50 p-2 rounded">
              <p className="text-xs text-gray-600">損傷なし</p>
              <p className="text-lg font-semibold text-blue-600">{combinedStats.noDamage}</p>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <p className="text-xs text-gray-600">軽微</p>
              <p className="text-lg font-semibold text-green-600">{combinedStats.minorDamage}</p>
            </div>
            <div className="bg-yellow-50 p-2 rounded">
              <p className="text-xs text-gray-600">中程度</p>
              <p className="text-lg font-semibold text-yellow-600">{combinedStats.moderateDamage}</p>
            </div>
            <div className="bg-red-50 p-2 rounded">
              <p className="text-xs text-gray-600">重度</p>
              <p className="text-lg font-semibold text-red-600">{combinedStats.severeDamage}</p>
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">合計検査箇所:</span>
              <span className="font-medium">{combinedStats.totalAssessments}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">最終更新:</span>
              <span className="font-medium">{combinedStats.lastUpdated}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;
