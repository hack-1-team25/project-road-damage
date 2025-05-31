import type { GeoJsonObject } from 'geojson';
import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl } from 'react-leaflet';
import { useData } from '../context/DataContext';

import bunkyoRoadsData from '../data/bunkyoRoadsData';
import bunkyoRoadsPointData from '../data/bunkyoRoadsPointData';

import MapLegend from './MapLegend';

const MapView: React.FC = () => {
  const { roadData, coloredRoads} = useData();
  const [map, setMap] = useState<L.Map | null>(null);
  
  // Center coordinates for Bunkyo Ward, Tokyo
  const position: [number, number] = [35.7080, 139.7516];
  
  // 文京区の道路の線データをメモ化
  const bunkyoRoads = useMemo(() => bunkyoRoadsData, []);

  
  useEffect(() => {
    if (map) {
      map.setView(position, 14);
    }
  }, [map]);

  // 文京区の道路ポイントデータをメモ化
  const bunkyoPoints = useMemo(() => bunkyoRoadsPointData, []);

  

  
  

  

  // 文京区道路のスタイル（黒線）にする(道具)（可視化はしていない）
  const baseRoadStyle = useMemo(() => {
    return {
      color: "#000000", // Black color
      weight: 3,
      opacity: 0.7,
    };
  }, []);
  


  // アップロードデータのスタイル関数
  const style = useMemo(() => (feature: any) => {
    // ポイントとラインで異なるスタイルを適用
    if (feature.geometry.type === "Point") {
      return {
        radius: 8,
        fillColor: getColor(feature.properties.damageScore || 0),
        color: "#000",//くろ
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      };
    } else {
      return {
        color: getColor(feature.properties.damageScore || 0),
        weight: 5,
        opacity: 0.7,
      };
    }
  }, []);


  //損傷度合いの色を決定する関数(道具)
  const getColor = (score: number): string => {
    if (score <= 1) return '#22c55e'; // Green - Minor damage
    if (score <= 3) return '#eab308'; // Yellow - Moderate damage
    return '#ef4444'; // Red - Severe damage
  };
  //後で上のやつと揃える(道具)
  const getPointColor = (scoreStr: string): string => {
    const score = parseFloat(scoreStr);
    if (isNaN(score)) return "#999999"; // 無効なスコア
  
    if (score >= 12) return "#ff0000";    // 赤（重度損傷）
    if (score >= 9) return "#ffff00";     // 黄（中度損傷）
    if (score >= 6) return "#00ff00";     // 緑（軽度損傷）
    return "#0000ff";                     // 青（ほぼ損傷なし）
  };


  // 各フィーチャー(アップロードした動画など)にポップアップをバインドする関数(道具)
  const onEachFeature = (feature: any, layer: L.Layer) => {
    if (feature.properties) {
      if (feature.geometry.type === "Point") {
        const { pointId, damageScore, lastUpdated } = feature.properties;
        layer.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold">ポイント ${pointId}</h3>
            <p>損傷スコア: <strong>${damageScore || 0}/5</strong></p>
            <p>最終更新: ${lastUpdated || '情報なし'}</p>
          </div>
        `);
      } else {
        const { roadName, damageScore, lastUpdated } = feature.properties;
        layer.bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold">${roadName || '未命名の道路'}</h3>
            <p>損傷スコア: <strong>${damageScore || 0}/5</strong></p>
            <p>最終更新: ${lastUpdated || '情報なし'}</p>
          </div>
        `);
      }
    }
  };

  // Key for GeoJSON component to force re-render when data changes
  const geoJsonKey = useMemo(() => JSON.stringify(roadData), [roadData]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        scrollWheelZoom={true}   // ← これを明示的に追加
        whenCreated={setMap}
      >
        <ZoomControl position="bottomright" />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="グレースケール">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="標準">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        


        {/* 文京区の全道路を表示(黒線にしてある道路の可視化) */}
        <GeoJSON 
          data={bunkyoRoads as GeoJsonObject}
          style={baseRoadStyle}
        />
        {/* 文京区の道路ポイントデータを表示 */}
        <GeoJSON
          data={bunkyoPoints as GeoJsonObject}
          pointToLayer={(feature, latlng) => {
            const color = getPointColor(feature.properties.score);
            const p = feature.properties;

            const marker = L.circleMarker(latlng, {
              radius: 5,
              color: color,
              fillColor: color,
              fillOpacity: 0.8,
              weight: 1,
            });

            marker.bindPopup(`
              <div>
                <strong>${p.name || "(名称なし)"}</strong><br />
                種別: ${p.highway}<br />
                画像ID: ${p.image_id}<br />
                損傷: ${p.damage_severity}<br />
                信頼度: ${p.confidence}<br />
                交通量: ${p.traffic_volume}<br />
                水道管: ${p.water_pipes}<br />
                補修履歴: ${p.repair_history}<br />
                <strong>スコア: ${p.score}</strong>
              </div>
            `);

            return marker;
          }}
        />
          

        
        
        



        {/* 色付けされた道路を表示 */}
        {coloredRoads && coloredRoads.length > 0 && (
          <GeoJSON 
            key={`colored-roads-${coloredRoads.length}`}
            data={{
              type: "FeatureCollection",
              features: coloredRoads
            } as GeoJsonObject}
            style={(feature) => ({
              color: getColor(feature.properties.damageScore || 0),
              weight: 5,
              opacity: 0.8,
            })}
          />
        )}
        
        {/* アップロードされたデータの表示 */}
        {roadData && (
          <>
            <GeoJSON 
              key={geoJsonKey}
              data={roadData as GeoJsonObject} 
              style={style}
              onEachFeature={onEachFeature}
              pointToLayer={(feature, latlng) => {
                return L.circleMarker(latlng, {
                  radius: 8,
                  fillColor: getColor(feature.properties.damageScore || 0),
                  color: "#000",
                  weight: 1,
                  opacity: 1,
                  fillOpacity: 0.8
                });
              }}
            />
            
            {/* 明示的にポイントとラインを描画（バックアップ） */}
            {roadData.features && roadData.features.filter(f => f.geometry && f.geometry.type === "Point").map((point, idx) => {
              const coords = point.geometry.coordinates;
              if (!coords || coords.length < 2) return null;
              return (
                <Marker 
                  key={`marker-${idx}`} 
                  position={[coords[1], coords[0]]}
                >
                  <Popup>
                    <div>
                      <h3>ポイント {point.properties.pointId}</h3>
                      <p>損傷スコア: {point.properties.damageScore}/5</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {roadData.features && roadData.features.filter(f => f.geometry && f.geometry.type === "LineString").map((line, idx) => {
              if (!line.geometry.coordinates || line.geometry.coordinates.length < 2) return null;
              const coords = line.geometry.coordinates.map(coord => {
                if (!coord || coord.length < 2) return null;
                return [coord[1], coord[0]];
              }).filter(Boolean);
              
              if (coords.length < 2) return null;
              
                return (
                <Polyline
                  key={`line-${idx}`}
                  positions={coords}
                  color={getColor(line.properties.damageScore || 0)}
                  weight={5}
                  opacity={0.7}
                >
                  <Popup>
                  <div>
                    <h3>{line.properties.roadName || '未命名の道路'}</h3>
                    <p>損傷スコア: {line.properties.damageScore}/5</p>
                    <p>最終更新: {line.properties.lastUpdated}</p>
                  </div>
                  </Popup>
                </Polyline>
                );
            })}
          </>
        )}
      </MapContainer>
      <MapLegend />
    </div>
  );
};

export default MapView;
