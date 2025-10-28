'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import { getDangerSpots } from '@/shared/api';
import type { DangerSpot } from '@/shared/types';
import { getDangerColor, getDamageDescription } from '../lib/utils';
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
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm mb-2">危険箇所情報</h3>
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
