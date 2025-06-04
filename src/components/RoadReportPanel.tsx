import React, { useEffect, useState } from 'react';
import { generateReport } from '../api/gemini';

interface RoadReportPanelProps {
  roads: any[];
}

const RoadReportPanel: React.FC<RoadReportPanelProps> = ({ roads }) => {
  const [selectedRoads, setSelectedRoads] = useState<any[]>([]);
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedRoads(roads);
  }, [roads]);

  const handleRemove = (indexToRemove: number) => {
    setSelectedRoads(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const combined = {
        roads: selectedRoads.map((road, index) => ({
          index: index + 1,
          name: road["name"] || `道路${index + 1}`,
          severity: road["Damage Severity"] ?? "-",
          confidence: road["Confidence Level"] ?? "-",
          traffic: road["Traffic Volume"] ?? "-",
          waterPipe: road["Presence of Water Pipes"] ?? "-",
          repair: road["Road Repair History"] ?? "-"
        }))
      };
      const result = await generateReport(combined);
      setReport(result);
    } catch (err) {
      console.error('レポート生成失敗:', err);
      setReport('レポート生成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-4">自動レポート作成</h2>

        {selectedRoads.length === 0 ? (
          <p className="text-sm text-gray-600">まだ道路が選択されていません。</p>
        ) : (
          <>
            <ul className="space-y-2 text-sm text-gray-800 mb-4">
              {selectedRoads.map((road, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded"
                >
                  <div>
                    <strong>{road["name"] || '名称なし'}</strong>：
                    損傷 {road["Damage Severity"] ?? '-'}、信頼度 {road["Confidence Level"] ?? '-'}
                  </div>
                    <button
                    onClick={() => handleRemove(index)}
                    className="ml-4 text-red-500 hover:text-red-700 text-sm"
                    >
                    ✕ 
                    </button>
                </li>
              ))}
            </ul>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'レポート生成中...' : 'レポートを生成'}
            </button>

            {report && (
              <div className="border-t pt-3 mt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">生成されたレポート</h3>
                <p className="text-sm text-gray-800 whitespace-pre-line">{report}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RoadReportPanel;
