import React, { useState } from 'react';
import { Download, Settings, Image, FileImage } from 'lucide-react';
import { ExportSettings, defaultExportSettings, generateFilename } from '../utils/mapExport';

interface MapExportPanelProps {
  onExport: (settings: ExportSettings) => void;
  isExporting: boolean;
  disabled?: boolean;
}

const MapExportPanel: React.FC<MapExportPanelProps> = ({ onExport, isExporting, disabled = false }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>(defaultExportSettings);

  const handleQuickExport = () => {
    if (disabled) return;
    
    const quickSettings = {
      ...defaultExportSettings,
      filename: generateFilename(defaultExportSettings.filename, true)
    };
    onExport(quickSettings);
  };

  const handleCustomExport = () => {
    if (disabled) return;
    
    const customSettings = {
      ...settings,
      filename: generateFilename(settings.filename, settings.includeTimestamp)
    };
    onExport(customSettings);
    setShowSettings(false);
  };

  return (
    <div className="bg-gradient-to-br from-white to-green-50 rounded-xl shadow-lg border border-green-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">地図エクスポート</h2>
            <p className="text-green-100 text-sm">現在の地図を画像として保存</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* クイックエクスポートボタン */}
        <button
          onClick={handleQuickExport}
          disabled={isExporting || disabled}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 mb-4"
          title={disabled ? "地図の読み込み中..." : "地図をPNG形式でエクスポート"}
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span className="font-medium">エクスポート中...</span>
            </>
          ) : disabled ? (
            <>
              <div className="animate-pulse rounded-full h-5 w-5 bg-white opacity-50"></div>
              <span className="font-medium">地図読み込み中...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span className="font-medium">地図をエクスポート</span>
            </>
          )}
        </button>

        {/* 詳細設定トグル */}
        <button
          onClick={() => !disabled && setShowSettings(!showSettings)}
          disabled={disabled}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-green-700 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title={disabled ? "地図の読み込み中..." : "詳細設定"}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">詳細設定</span>
        </button>

        {/* 設定パネル */}
        {showSettings && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-sm font-semibold text-green-900 mb-3">エクスポート設定</h3>
            
            {/* ファイル名 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-green-700 mb-1">
                ファイル名
              </label>
              <input
                type="text"
                value={settings.filename}
                onChange={(e) => setSettings({ ...settings, filename: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="ファイル名を入力"
              />
            </div>

            {/* 画像形式 */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-green-700 mb-2">
                画像形式
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSettings({ ...settings, format: 'png' })}
                  className={`flex items-center space-x-1 px-3 py-2 text-xs rounded-lg transition-colors duration-200 ${
                    settings.format === 'png'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Image className="w-3 h-3" />
                  <span>PNG</span>
                </button>
                <button
                  onClick={() => setSettings({ ...settings, format: 'jpeg' })}
                  className={`flex items-center space-x-1 px-3 py-2 text-xs rounded-lg transition-colors duration-200 ${
                    settings.format === 'jpeg'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <FileImage className="w-3 h-3" />
                  <span>JPEG</span>
                </button>
              </div>
            </div>

            {/* オプション */}
            <div className="mb-3">
              <label className="flex items-center space-x-2 text-xs text-green-700">
                <input
                  type="checkbox"
                  checked={settings.includeTimestamp}
                  onChange={(e) => setSettings({ ...settings, includeTimestamp: e.target.checked })}
                  className="rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <span>タイムスタンプを含める</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="flex items-center space-x-2 text-xs text-green-700">
                <input
                  type="checkbox"
                  checked={settings.fitToBounds}
                  onChange={(e) => setSettings({ ...settings, fitToBounds: e.target.checked })}
                  className="rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <span>文京区エリアにフィット</span>
              </label>
            </div>

            {/* カスタムエクスポート実行ボタン */}
            <button
              onClick={handleCustomExport}
              disabled={isExporting || disabled}
              className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              カスタムエクスポート
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapExportPanel;

