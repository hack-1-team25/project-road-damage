import type { GeoJsonObject } from 'geojson';
import React, { useEffect, useMemo, useState } from 'react';
import { GeoJSON, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl } from 'react-leaflet';
import { useData } from '../context/DataContext';

import bunkyoRoadsData from '../data/bunkyoRoadsData';
import bunkyoRoadsPointData from '../data/bunkyoRoadsPointData';
//スコア
import { getAHPScoreMap } from '../utils/ahpScoring';

import MapLegend from './MapLegend';


//AIレポート
interface MapViewProps {
  onSelectRoad: (road: any) => void;
}


//AIレポート交換
// const MapView: React.FC = () => {
const MapView: React.FC<MapViewProps> = ({ onSelectRoad }) => {


  const { roadData, coloredRoads} = useData();
  const [map, setMap] = useState<L.Map | null>(null);
  
  // Center coordinates for Bunkyo Ward, Tokyo
  const position: [number, number] = [35.7080, 139.7516];
  
  // 文京区の道路の線データをメモ化、
  const bunkyoRoads = useMemo(() => bunkyoRoadsData, []);

  
  useEffect(() => {
    if (map) {
      map.setView(position, 14);
    }
  }, [map]);

  // 文京区の道路ポイントデータをメモ化
  const bunkyoPoints = useMemo(() => bunkyoRoadsPointData, []);

  

  
  

  

  // 文京区道路のスタイル（黒線）にする(道具)（可視化はしていない）
  // const baseRoadStyle = useMemo(() => {
  //   return {
  //     color: "#000000", // Black color
  //     weight: 3,
  //     opacity: 0.7,
  //   };
  // }, []);
  


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
    if (score <= 0) return '#0000ff'; // blue - No damage
    if (score <= 2) return '#22c55e'; // Green - Minor damage
    if (score <= 4) return '#eab308'; // Yellow - Moderate damage
    return '#ef4444'; // Red - Severe damage
  };
  //後で上のやつと揃える(道具)
  const getPointColor = (scoreStr: string): string => {
    const score = parseFloat(scoreStr);
    if (isNaN(score)) return "#999999"; // 無効なスコア
  
    if (score >= 0.7) return "#ff0000";    // 赤（重度損傷）
    if (score >= 0.5) return "#ffff00";     // 黄（中度損傷）
    if (score >= 0.2) return "#00ff00";     // 緑（軽度損傷）
    return "#0000ff";                     // 青（ほぼ損傷なし）
  };
  
  //スコア
  const scoreMap = getAHPScoreMap();
  const scoreLookup = new Map(scoreMap.map(({ index, score }) => [index, score]));
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
  
  const damageMap: Record<string, string> = {
    D00: '縦方向ひび割れ',
    D10: '横方向ひび割れ',
    D20: 'ワニ皮状ひび割れ',
    D40: 'ポットホール（穴ぼこ）',
    D43: '白線のぼやけ',
    D44: '横断歩道のぼやけ',
    D50: 'マンホールカバー'
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
        


        {/* 文京区の全道路を表示(道路の可視化) (scoreがなければ黒になる)*/}
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
            const score = scoreLookup.get(index);

            // AIレポート（選択処理）
            layer.on({
              click: () => {
                const roadProps = feature.properties;
                const road = {
                  ...roadProps,
                  coordinates: feature.geometry.coordinates,
                  score // ← ここでscoreを一緒に渡しておくと便利
                };
                onSelectRoad(road);
              }
            });

            const p = feature.properties || {};

            const highwayLabel = highwayMap[p.highway] ?? 'その他';//追加
            const damageLabel = damageMap[p["Damage Severity"]] ?? '-';//追加

            const popupContent = `
            <div style="font-size: 13px; line-height: 1.4">
              <strong>道路名:</strong> ${p.name || "(名称なし)"}<br />
              <strong>道路種別:</strong> ${highwayLabel}<br />
              <strong>舗装種別:</strong> ${p["Type of Pavement"] || "-"}<br />
              <strong>築年:</strong> ${p["Year of Construction"] ?? "-"} 年<br />
              <strong>補修履歴:</strong> ${p["Road Repair History"] ?? "-"} 年前<br />
              <strong>損傷の種類:</strong> ${damageLabel}<br />
              <strong>信頼度:</strong> ${typeof p["Confidence Level"] === 'number' ? p["Confidence Level"].toFixed(2) : "-"}<br />
              <strong>交通量:</strong> ${p["Traffic Volume"] ?? "-"}<br />
              <strong>排水性:</strong> ${p["Drainage Performance"] ?? "-"}<br />
              <strong>水道管:</strong> ${p["Presence of Water Pipe"] ? p["Presence of Water Pipe"] + " 年前補修" : "なし"}<br />
              <strong>ガス管:</strong> ${p["Presence of Gas Pipe"] ? p["Presence of Gas Pipe"] + " 年前補修" : "なし"}<br />
              <strong style="color: #d00;">補修優先スコア (AHP):</strong> ${typeof score === 'number' ? score.toFixed(3) : "-"}
            </div>
            `;
            layer.bindPopup(popupContent);
          }}
        />

        <GeoJSON
          data={bunkyoPoints as GeoJsonObject}
          pointToLayer={(feature, latlng) => {
            const marker = L.circleMarker(latlng, {
              radius: 2,
              color: "transparent",       // 外枠を透明
              fillColor: "transparent",   // 塗りつぶしも透明
              fillOpacity: 0,             // 念のため透明度も0
              weight: 0                   // 枠線を非表示に
            });

            // ポップアップは残しておく
            // const p = feature.properties;
            // marker.bindPopup(`
            //   <div>
            //     <strong>${p.name || "(名称なし)"}</strong><br />
            //     種別: ${p.highway}<br />
            //     画像ID: ${p.image_id}<br />
            //     損傷: ${p.damage_severity}<br />
            //     信頼度: ${p.confidence}<br />
            //     交通量: ${p.traffic_volume}<br />
            //     水道管: ${p.water_pipes}<br />
            //     補修履歴: ${p.repair_history}<br />
            //     <strong>スコア: ${p.score}</strong>
            //   </div>
            // `);

            return marker;
          }}
        />
        {/* 文京区の道路ポイントデータを表示 */}
        {/* <GeoJSON
          data={bunkyoPoints as GeoJsonObject}
          pointToLayer={(feature, latlng) => {
            const color = getPointColor(feature.properties.score);
            const p = feature.properties;

            const marker = L.circleMarker(latlng, {
              radius: 0.5,
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
        /> */}
          

        
        
        



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