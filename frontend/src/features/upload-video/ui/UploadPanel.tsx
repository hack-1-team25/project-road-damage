'use client';

import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Video, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadVideo } from '@/shared/api';
import type { VideoResponse } from '@/shared/types';

export const UploadPanel: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [gpsFile, setGpsFile] = useState<File | null>(null);
  const [frameInterval, setFrameInterval] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<VideoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const onVideoDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const handleGPSUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file extension
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.gpx')) {
        setError('GPS データは CSV または GPX ファイルを選択してください');
        return;
      }
      setGpsFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !gpsFile) {
      setError('動画ファイルとGPSファイル（CSV または GPX）の両方を選択してください');
      return;
    }

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      const result = await uploadVideo({
        video_file: videoFile,
        gps_log_file: gpsFile,
        frame_interval: frameInterval,
      });

      setUploadResult(result);
      alert('動画のアップロードに成功しました！バックグラウンドで処理が開始されます。');
    } catch (err: unknown) {
      console.error('Upload error:', err);
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || '動画のアップロードに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onVideoDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
    },
    disabled: loading,
    multiple: false,
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">動画アップロード</h2>
      <p className="text-sm text-gray-600 mb-6">
        GPS情報付きの動画をアップロードして、AIによる路面損傷評価を行います。
      </p>

      {/* 動画アップロード */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          動画ファイル
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : videoFile
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-blue-400'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-2">
            {videoFile ? (
              <>
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm text-gray-700 font-medium">{videoFile.name}</p>
                <p className="text-xs text-gray-500">
                  サイズ: {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <Video className="h-8 w-8 text-blue-500" />
                <p className="text-sm text-center text-gray-600">
                  {isDragActive
                    ? '動画ファイルをドロップしてください'
                    : '動画をドラッグ＆ドロップするか、クリックして選択'}
                </p>
                <p className="text-xs text-center text-gray-500">MP4, MOV, AVI</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GPS アップロード */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          GPS データ（CSV または GPX）
        </label>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <FileText className="inline-block w-4 h-4 mr-2" />
            GPS ファイルを選択
          </button>
          <span className="text-sm text-gray-600">
            {gpsFile ? (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                {gpsFile.name}
              </span>
            ) : (
              'ファイルが未選択です'
            )}
          </span>
        </div>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.gpx"
          className="hidden"
          onChange={handleGPSUpload}
          disabled={loading}
        />
      </div>

      {/* フレーム間隔設定 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          フレーム抽出間隔（秒）
        </label>
        <input
          type="number"
          min="1"
          max="60"
          value={frameInterval}
          onChange={(e) => setFrameInterval(parseInt(e.target.value) || 10)}
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <p className="text-xs text-gray-500 mt-1">
          {frameInterval}秒ごとにフレームを抽出します（推奨: 10秒）
        </p>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 成功メッセージ */}
      {uploadResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">
            <strong>アップロード成功！</strong>
            <br />
            Job ID: {uploadResult.job_id}
            <br />
            ステータス: {uploadResult.status}
          </p>
        </div>
      )}

      {/* アップロードボタン */}
      <button
        onClick={handleUpload}
        disabled={loading || !videoFile || !gpsFile}
        className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            アップロード中...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-2" />
            アップロード開始
          </>
        )}
      </button>
    </div>
  );
};
