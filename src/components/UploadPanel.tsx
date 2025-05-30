import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, MapPin, Video, FileText } from 'lucide-react';
import { useData } from '../context/DataContext';

interface GPSData {
  timestamp: string;
  latitude: number;
  longitude: number;
}

const UploadPanel: React.FC = () => {
  const { uploadPhotos, processVideo, loading } = useData();
  const [gpsData, setGPSData] = useState<GPSData[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const videoFile = acceptedFiles.find(file => file.type.startsWith('video/'));
    if (videoFile && gpsData.length > 0) {
      processVideo(videoFile, gpsData);
    } else {
      uploadPhotos(acceptedFiles);
    }
  }, [uploadPhotos, processVideo, gpsData]);

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const parsedData: GPSData[] = [];

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 4) {
          parsedData.push({
            timestamp: parts[0],
            latitude: parseFloat(parts[3]),
            longitude: parseFloat(parts[4])
          });
        }
      }

      setGPSData(parsedData);
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'video/*': ['.mp4', '.mov', '.avi']
    },
    disabled: loading,
    multiple: true
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-2">メディアアップロード</h2>
        <p className="text-sm text-gray-500 mb-4">
          GPS情報付きの写真または動画をアップロードして、AIによる損傷評価を行います。
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GPS データ（CSV）
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FileText className="inline-block w-4 h-4 mr-2" />
              CSVファイルを選択
            </button>
            <span className="text-sm text-gray-500">
              {gpsData.length > 0 ? `${gpsData.length} 件のGPSデータを読み込み済み` : 'ファイルが未選択です'}
            </span>
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVUpload}
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex space-x-2">
              <Upload className="h-8 w-8 text-blue-500" />
              <Video className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-sm text-center text-gray-600">
              {isDragActive
                ? 'ファイルをドロップしてください'
                : '写真または動画をドラッグ＆ドロップするか、クリックして選択'}
            </p>
            <p className="text-xs text-center text-gray-500">
              写真(JPG, PNG) または 動画(MP4, MOV, AVI)
            </p>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">必要な情報</h3>
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <Image className="h-4 w-4 mr-2 text-gray-500" />
              <span>路面の写真または動画</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-2 text-gray-500" />
              <span>GPS位置情報（写真のExifまたはCSVファイル）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPanel;