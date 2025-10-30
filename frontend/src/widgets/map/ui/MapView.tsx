'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import { getDangerSpots, getImageUrl } from '@/shared/api';
import type { DangerSpot } from '@/shared/types';
import { getDangerColor, getDamageDescription } from '../lib/utils';
import { ImageModal } from '@/shared/ui';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leafletのデフォルトアイコンの問題を修正
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // ミリ秒
}

export const MapView: React.FC<MapViewProps> = ({ 
  autoRefresh = false, 
  refreshInterval = 30000 
}) => {
  const [dangerSpots, setDangerSpots] = useState<DangerSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // 文京区の中心座標
  const position: [number, number] = [35.7080, 139.7516];

  const fetchDangerSpots = async () => {
    try {
      setError(null);
      const response = await getDangerSpots({
        limit: 1000, // 最大1000件まで取得
      });
      setDangerSpots(response.spots);
    } catch (err: any) {
      console.error('Error fetching danger spots:', err);
      setError('危険箇所の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDangerSpots();

    if (autoRefresh) {
      const interval = setInterval(fetchDangerSpots, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  return (
    <div className="relative h-full w-full">
      {/* 画像モーダル */}
      {selectedImage && (
        <ImageModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          imageUrl={selectedImage.url}
          title={selectedImage.title}
        />
      )}

      {/* 読み込み中のオーバーレイ */}
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm text-gray-700">危険箇所を読み込み中...</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 統計情報 */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">危険箇所統計</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">総数:</span>
            <span className="font-medium">{dangerSpots.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
              重度:
            </span>
            <span className="font-medium">
              {dangerSpots.filter(s => s.danger_score > 4).length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
              中度:
            </span>
            <span className="font-medium">
              {dangerSpots.filter(s => s.danger_score > 2 && s.danger_score <= 4).length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              軽度:
            </span>
            <span className="font-medium">
              {dangerSpots.filter(s => s.danger_score > 0 && s.danger_score <= 2).length}
            </span>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div className="absolute bottom-8 left-4 z-[1000] bg-white p-3 rounded-lg shadow-lg">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">危険度</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
            <span>重度 (4-5)</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
            <span>中度 (2-4)</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
            <span>軽度 (0-2)</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
            <span>損傷なし</span>
          </div>
        </div>
      </div>

      {/* 地図 */}
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <ZoomControl position="bottomright" />
        
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {/* 危険箇所マーカー */}
        {dangerSpots.map((spot) => (
          <CircleMarker
            key={spot.id}
            center={[spot.latitude, spot.longitude]}
            radius={8}
            fillColor={getDangerColor(spot.danger_score)}
            color="#000"
            weight={1}
            opacity={1}
            fillOpacity={0.8}
          >
            <Popup maxWidth={400}>
              <div className="p-2">
                <h3 className="font-semibold text-sm mb-2">危険箇所情報</h3>
                
                {/* 画像プレビュー */}
                {spot.image && spot.image_id && (
                  <div className="mb-3">
                    <div 
                      className="relative w-full h-48 bg-gray-100 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        const imageUrl = getImageUrl(spot.image_id, true);
                        setSelectedImage({
                          url: imageUrl,
                          title: `危険箇所 (スコア: ${spot.danger_score.toFixed(1)}/5)`,
                        });
                      }}
                    >
                      <img
                        src={getImageUrl(spot.image_id, true)}
                        alt="危険箇所の画像"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ddd" width="300" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E画像なし%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-40">
                        <svg
                          className="w-12 h-12 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                          />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      クリックして拡大表示
                    </p>
                  </div>
                )}
                
                <div className="space-y-1 text-xs">
                  <p>
                    <strong>危険度スコア:</strong>{' '}
                    <span className="font-medium">{spot.danger_score.toFixed(1)}/5</span>
                  </p>
                  {spot.damage_class && (
                    <>
                      <p>
                        <strong>損傷種別:</strong>{' '}
                        {spot.damage_class} ({getDamageDescription(spot.damage_class)})
                      </p>
                      {spot.confidence && (
                        <p>
                          <strong>信頼度:</strong>{' '}
                          {(spot.confidence * 100).toFixed(1)}%
                        </p>
                      )}
                    </>
                  )}
                  <p>
                    <strong>検出日時:</strong>{' '}
                    {new Date(spot.detected_at).toLocaleString('ja-JP')}
                  </p>
                  <p className="text-gray-500">
                    座標: {spot.latitude.toFixed(6)}, {spot.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};
