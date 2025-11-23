'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, GeoJSON } from 'react-leaflet';
import { getDangerSpots, getImageUrl } from '@/shared/api';
import type { DangerSpot } from '@/shared/types';
import { getDangerColor, getDamageDescription } from '../lib/utils';
import { ImageModal } from '@/shared/ui';
import { bunkyoRoadsData, bunkyoRoadsPointData } from '@/shared/data';
import { getAHPScoreMap, getDynamicAHPScoreMap } from '@/shared/lib/ahpScoring';
import type { GeoJsonObject } from 'geojson';
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

  // 文京区の道路データをメモ化
  const bunkyoRoads = useMemo(() => bunkyoRoadsData, []);
  const bunkyoPoints = useMemo(() => bunkyoRoadsPointData, []);

  // AHPスコアマップを取得（危険箇所を考慮）
  const scoreMap = useMemo(() => {
    if (dangerSpots.length > 0) {
      // 危険箇所がある場合は動的スコアを使用（影響度70%）
      return getDynamicAHPScoreMap(dangerSpots, 50, 0.7);
    } else {
      // 危険箇所がない場合は静的スコアを使用（道路の基本プロパティのみ）
      return getAHPScoreMap().map(item => ({ ...item, nearbyDangers: 0 }));
    }
  }, [dangerSpots]);
  
  const scoreLookup = useMemo(() => 
    new Map(scoreMap.map((item: { index: number; score: number; nearbyDangers: number }) => [item.index, item.score])), 
    [scoreMap]
  );

  // 道路種別のマッピング
  const highwayMap: Record<string, string> = {
    motorway: '高速道路',
    trunk: '幹線道路',
    primary: '主要地方道',
    secondary: '二次道路',
    tertiary: '第三級道路',
    residential: '住宅街の道路',
    service: 'サービス道路',
    unclassified: '小道路'
  };

  // スコアから色を取得する関数
  const getPointColor = (scoreStr: string | number): string => {
    const score = typeof scoreStr === 'number' ? scoreStr : parseFloat(scoreStr);
    if (isNaN(score)) return "#999999"; // 無効なスコア

    if (score >= 0.7) return "#ff0000";    // 赤（重度損傷）
    if (score >= 0.5) return "#ffff00";     // 黄（中度損傷）
    if (score >= 0.2) return "#00ff00";     // 緑（軽度損傷）
    return "#0000ff";                     // 青（ほぼ損傷なし）
  };

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
        <div className="space-y-1 text-xs mb-3">
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
        {dangerSpots.length > 0 && (
          <div className="border-t pt-2">
            <h4 className="text-xs font-semibold text-gray-900 mb-1">道路への影響</h4>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">影響を受けた道路:</span>
              <span className="font-medium text-orange-600">
                {scoreMap.filter(item => item.nearbyDangers > 0).length}本
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 凡例 */}
      <div className="absolute bottom-8 left-4 z-[1000] bg-white p-3 rounded-lg shadow-lg max-w-xs">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">危険度（危険箇所プロット）</h4>
        <div className="space-y-1 text-xs mb-3">
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
        <div className="border-t pt-2">
          <h4 className="text-xs font-semibold text-gray-900 mb-2">道路補修優先度</h4>
          <p className="text-xs text-gray-500 mb-2">※危険箇所と道路状態から算出</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center">
              <span className="w-8 h-0.5 bg-red-500 mr-2"></span>
              <span>高優先度 (≥0.7)</span>
            </div>
            <div className="flex items-center">
              <span className="w-8 h-0.5 bg-yellow-500 mr-2"></span>
              <span>中優先度 (0.5-0.7)</span>
            </div>
            <div className="flex items-center">
              <span className="w-8 h-0.5 bg-green-500 mr-2"></span>
              <span>低優先度 (0.2-0.5)</span>
            </div>
            <div className="flex items-center">
              <span className="w-8 h-0.5 bg-blue-500 mr-2"></span>
              <span>正常 (&lt;0.2)</span>
            </div>
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

        {/* 文京区の全道路を表示 (AHPスコアに基づいて色付け) */}
        <GeoJSON
          data={bunkyoRoads as GeoJsonObject}
          style={(feature) => {
            const index = (bunkyoRoads as any).features.indexOf(feature);
            const score = scoreLookup.get(index);
            const color = typeof score === 'number' ? getPointColor(String(score)) : '#000000';
            return {
              color,
              weight: 3,
              opacity: 0.8
            };
          }}
          onEachFeature={(feature, layer) => {
            const index = (bunkyoRoads as any).features.indexOf(feature);
            const scoreData = scoreMap.find(item => item.index === index);
            const score = scoreData?.score;
            const nearbyDangers = scoreData?.nearbyDangers || 0;

            const p = feature.properties || {};

            const highwayLabel = highwayMap[p.highway] ?? 'その他';

            const popupContent = `
            <div style="font-size: 13px; line-height: 1.4">
              <strong>道路名:</strong> ${p.name || "(名称なし)"}<br />
              <strong>道路種別:</strong> ${highwayLabel}<br />
              <strong>舗装種別:</strong> ${p["Type of Pavement"] || "-"}<br />
              <strong>築年:</strong> ${p["Year of Construction"] ?? "-"} 年<br />
              <strong>補修履歴:</strong> ${p["Road Repair History"] ?? "-"} 年前<br />
              <strong>交通量:</strong> ${p["Traffic Volume"] ?? "-"}<br />
              <strong>排水性:</strong> ${p["Drainage Performance"] ?? "-"}<br />
              <strong>水道管:</strong> ${p["Presence of Water Pipe"] ? p["Presence of Water Pipe"] + " 年前補修" : "なし"}<br />
              <strong>ガス管:</strong> ${p["Presence of Gas Pipe"] ? p["Presence of Gas Pipe"] + " 年前補修" : "なし"}<br />
              ${nearbyDangers > 0 ? `<strong style="color: #f90;">⚠ 近くの危険箇所:</strong> ${nearbyDangers}箇所<br />` : ''}
              <strong style="color: #d00;">補修優先スコア (AHP):</strong> ${typeof score === 'number' ? score.toFixed(3) : "-"}${nearbyDangers > 0 ? ' <span style="color: #f90;">↑</span>' : ''}
            </div>
            `;
            layer.bindPopup(popupContent);
          }}
        />

        {/* 文京区の道路ポイントデータ（透明で表示） */}
        <GeoJSON
          data={bunkyoPoints as GeoJsonObject}
          pointToLayer={(feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 2,
              color: "transparent",
              fillColor: "transparent",
              fillOpacity: 0,
              weight: 0
            });
          }}
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
