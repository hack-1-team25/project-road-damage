import React, { useState } from 'react';
import { Download, Settings, Image, FileImage } from 'lucide-react';
import { ExportSettings, defaultExportSettings, generateFilename } from '../utils/mapExport';

interface MapExportControlProps {
  onExport: (settings: ExportSettings) => void;
  isExporting: boolean;
  disabled?: boolean;
}

const MapExportControl: React.FC<MapExportControlProps> = ({ onExport, isExporting, disabled = false }) => {
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
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* クイックエクスポートボタン */}
      <div className="p-3">
        <button
          onClick={handleQuickExport}
          disabled={isExporting || disabled}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 w-full"
          title={disabled ? "地図の読み込み中..." : "地図をPNG形式でエクスポート"}
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm font-medium">エクスポート中...</span>
            </>
          ) : disabled ? (
            <>
              <div className="animate-pulse rounded-full h-4 w-4 bg-white opacity-50"></div>
              <span className="text-sm font-medium">地図読み込み中...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">地図をエクスポート</span>
            </>
          )}
        </button>
        
        {/* 設定ボタン */}
        <button
          onClick={() => !disabled && setShowSettings(!showSettings)}
          disabled={disabled}
          className="flex items-center justify-center w-full mt-2 px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title={disabled ? "地図の読み込み中..." : "エクスポート設定"}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* 設定パネル */}
      {showSettings && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">エクスポート設定</h3>
          
          {/* ファイル名 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ファイル名
            </label>
            <input
              type="text"
              value={settings.filename}
              onChange={(e) => setSettings({ ...settings, filename: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="ファイル名を入力"
            />
          </div>

          {/* 画像形式 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              画像形式
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setSettings({ ...settings, format: 'png' })}
                className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors duration-200 ${
                  settings.format === 'png'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Image className="w-3 h-3" />
                <span>PNG</span>
              </button>
              <button
                onClick={() => setSettings({ ...settings, format: 'jpeg' })}
                className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors duration-200 ${
                  settings.format === 'jpeg'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <FileImage className="w-3 h-3" />
                <span>JPEG</span>
              </button>
            </div>
          </div>

          {/* オプション */}
          <div className="mb-4">
            <label className="flex items-center space-x-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={settings.includeTimestamp}
                onChange={(e) => setSettings({ ...settings, includeTimestamp: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>タイムスタンプを含める</span>
            </label>
          </div>

          <div className="mb-4">
            <label className="flex items-center space-x-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={settings.fitToBounds}
                onChange={(e) => setSettings({ ...settings, fitToBounds: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>文京区エリアにフィット</span>
            </label>
          </div>

          {/* エクスポート実行ボタン */}
          <button
            onClick={handleCustomExport}
            disabled={isExporting || disabled}
            className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            カスタムエクスポート
          </button>
        </div>
      )}
    </div>
  );
};

export default MapExportControl;
