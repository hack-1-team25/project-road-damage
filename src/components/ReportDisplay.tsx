import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Download, 
  Eye, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  TrendingUp,
  Calendar,
  MapPin
} from 'lucide-react';

interface ReportDisplayProps {
  report: string;
  onDownload: () => void;
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, onDownload }) => {
  // レポートをセクションに分割
  const formatReport = (text: string) => {
    // 基本的なマークダウン形式に変換
    let formatted = text;
    
    // セクションヘッダーを強調
    formatted = formatted.replace(/^(概要|総合評価|詳細分析|推奨事項|結論)[:：]/gm, '## $1\n');
    
    // 重要な情報をハイライト
    formatted = formatted.replace(/(高|危険|緊急)/g, '**⚠️ $1**');
    formatted = formatted.replace(/(良好|安全|正常)/g, '**✅ $1**');
    formatted = formatted.replace(/(中程度|注意)/g, '**⚡ $1**');
    
    // 数値や評価をハイライト
    formatted = formatted.replace(/(\d+(?:\.\d+)?%)/g, '`$1`');
    formatted = formatted.replace(/(信頼度|損傷度|交通量)[:：]\s*([^\n]+)/g, '**$1**: `$2`');
    
    return formatted;
  };

  const getReportSummary = (text: string) => {
    const lines = text.split('\n');
    const summaryLine = lines.find(line => 
      line.includes('総合評価') || 
      line.includes('概要') || 
      line.includes('結論')
    );
    return summaryLine || '道路状況の詳細な分析レポートが生成されました。';
  };

  const getReportStats = (text: string) => {
    const highCount = (text.match(/(高|危険|緊急)/g) || []).length;
    const mediumCount = (text.match(/(中程度|注意)/g) || []).length;
    const lowCount = (text.match(/(良好|安全|正常)/g) || []).length;
    
    return { high: highCount, medium: mediumCount, low: lowCount };
  };

  const stats = getReportStats(report);
  const formattedReport = formatReport(report);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-lg">
      {/* レポートヘッダー */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Eye className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI診断レポート</h3>
              <p className="text-sm text-gray-600 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date().toLocaleDateString('ja-JP')} 生成
              </p>
            </div>
          </div>
          <button
            onClick={onDownload}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            <span>ダウンロード</span>
          </button>
        </div>
      </div>

      {/* レポート統計 */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-semibold">{stats.high}</span>
            </div>
            <p className="text-xs text-gray-600">高リスク項目</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-yellow-600 mb-1">
              <Info className="w-4 h-4" />
              <span className="font-semibold">{stats.medium}</span>
            </div>
            <p className="text-xs text-gray-600">中リスク項目</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="font-semibold">{stats.low}</span>
            </div>
            <p className="text-xs text-gray-600">良好項目</p>
          </div>
        </div>
      </div>

      {/* レポート概要 */}
      <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
        <div className="flex items-start space-x-3">
          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900 mb-1">レポート概要</h4>
            <p className="text-sm text-gray-700">{getReportSummary(report)}</p>
          </div>
        </div>
      </div>

      {/* レポート本文 */}
      <div className="p-6">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({children}) => (
                <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  {children}
                </h2>
              ),
              h3: ({children}) => (
                <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">
                  {children}
                </h3>
              ),
              p: ({children}) => (
                <p className="text-gray-700 leading-relaxed mb-3">
                  {children}
                </p>
              ),
              strong: ({children}) => (
                <strong className="font-semibold text-gray-900">
                  {children}
                </strong>
              ),
              code: ({children}) => (
                <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                  {children}
                </code>
              ),
              ul: ({children}) => (
                <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700">
                  {children}
                </ul>
              ),
              li: ({children}) => (
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{children}</span>
                </li>
              )
            }}
          >
            {formattedReport}
          </ReactMarkdown>
        </div>
      </div>

      {/* フッター */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>Gemini AI による自動生成レポート</span>
          </div>
          <div className="text-xs">
            レポート文字数: {report.length}文字
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDisplay;