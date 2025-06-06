import React, { useEffect, useState } from 'react';
import { generateReport } from '../api/gemini';
import ReportDisplay from './ReportDisplay';
import { 
  FileText, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin,
  TrendingUp,
  Loader2,
  X
} from 'lucide-react';

interface RoadReportPanelProps {
  roads: any[];
  onRemoveRoad: (index: number) => void;
  onClearAllRoads: () => void;
}

const RoadReportPanel: React.FC<RoadReportPanelProps> = ({ roads, onRemoveRoad, onClearAllRoads }) => {
  const [selectedRoads, setSelectedRoads] = useState<any[]>([]);
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedRoads(roads);
  }, [roads]);

  const handleRemove = (indexToRemove: number) => {
    // 親コンポーネントの削除関数を呼び出す
    onRemoveRoad(indexToRemove);
  };

  const handleClearAll = () => {
    // 親コンポーネントの一括削除関数を呼び出す
    onClearAllRoads();
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

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case '高':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
      case '中':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
      case '低':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case '高':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
      case '中':
        return <Clock className="w-4 h-4" />;
      case 'low':
      case '低':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI道路診断レポート</h2>
            <p className="text-blue-100 text-sm">Gemini AIによる自動分析</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {selectedRoads.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">道路が選択されていません</p>
            <p className="text-gray-500 text-sm mt-1">地図上の道路をクリックして分析を開始してください</p>
          </div>
        ) : (
          <>
            {/* 選択された道路リスト */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  選択された道路 ({selectedRoads.length}件)
                </h3>
                {/* 一括削除ボタン */}
                <button
                  onClick={handleClearAll}
                  className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200 text-sm font-medium"
                  title="すべて削除"
                >
                  <X className="w-4 h-4" />
                  <span>すべて削除</span>
                </button>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {selectedRoads.map((road, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-semibold text-gray-900">
                            {road["name"] || `道路 ${index + 1}`}
                          </h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(road["Damage Severity"])}`}>
                            {getSeverityIcon(road["Damage Severity"])}
                            <span className="ml-1">{road["Damage Severity"] ?? '未評価'}</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                            信頼度: {road["Confidence Level"] ?? '-'}
                          </div>
                          <div className="flex items-center">
                            <TrendingUp className="w-3 h-3 mr-1 text-blue-500" />
                            交通量: {road["Traffic Volume"] ?? '-'}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemove(index)}
                        className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* レポート生成ボタン */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI分析中...</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span>AIレポートを生成</span>
                </>
              )}
            </button>

            {/* 生成されたレポート */}
            {report && (
              <div className="mt-6">
                <ReportDisplay 
                  report={report}
                  onDownload={() => {
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `道路診断レポート_${new Date().toISOString().split('T')[0]}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RoadReportPanel;