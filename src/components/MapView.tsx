import type { GeoJsonObject } from 'geojson';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { GeoJSON, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { useData } from '../context/DataContext';
import YoloImagePopup from './YoloImagePopup';
// MapExportControlのインポートを削除

import bunkyoRoadsData from '../data/bunkyoRoadsData';
import bunkyoRoadsPointData from '../data/bunkyoRoadsPointData';

//スコア
import { getAHPScoreMap } from '../utils/ahpScoring';

import MapLegend from './MapLegend';

// エクスポート機能
import { exportMapAsImage, fitMapToBunkyoBounds, ExportSettings } from '../utils/mapExport';

//AIレポート
interface MapViewProps {
  onSelectRoad: (road: any) => void;
  onMapReady: (ready: boolean) => void; // マップ準備完了状態を通知するコールバック
  onExportStateChange: (exporting: boolean) => void; // エクスポート状態を通知するコールバック
}

// マップインスタンスを取得するためのコンポーネント
const MapInstanceHandler: React.FC<{ onMapReady: (map: L.Map) => void }> = ({ onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return null;
};


//AIレポート交換
// const MapView: React.FC = () => {
const MapView: React.FC<MapViewProps> = ({ onSelectRoad, onMapReady, onExportStateChange }) => {
  const { roadData, coloredRoads} = useData();
  const [map, setMap] = useState<L.Map | null>(null);
  const [hoveredImageUrl, setHoveredImageUrl] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);
  const [showPlots, setShowPlots] = useState<boolean>(true); // プロット表示のON/OFF状態（デフォルトはON）
  const [isExporting, setIsExporting] = useState<boolean>(false); // エクスポート状態
  const [mapReady, setMapReady] = useState<boolean>(false); // マップの準備完了状態
  
  // マップコンテナの参照
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // マップインスタンスが準備完了したときのコールバック
  const handleMapReady = (mapInstance: L.Map) => {
    setMap(mapInstance);
    setMapReady(true);
    onMapReady(true); // 親コンポーネントに通知
  };
  
  // エクスポート処理関数
  const handleExport = async (settings: ExportSettings) => {
    // マップの準備完了とコンテナの存在を確認
    if (!mapReady || !mapContainerRef.current || !map) {
      console.error('マップが準備できていません。しばらく待ってから再試行してください。');
      alert('マップが準備できていません。しばらく待ってから再試行してください。');
      return;
    }

    setIsExporting(true);
    onExportStateChange(true); // 親コンポーネントに通知
    
    try {
      // 文京区エリアにフィットする場合
      if (settings.fitToBounds) {
        fitMapToBunkyoBounds(map);
        // マップの更新を待つ
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // マップコンテナをエクスポート
      await exportMapAsImage(
        mapContainerRef.current,
        settings.filename,
        settings.format
      );
      
      console.log('地図のエクスポートが完了しました');
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('地図のエクスポートに失敗しました。もう一度お試しください。');
    } finally {
      setIsExporting(false);
      onExportStateChange(false); // 親コンポーネントに通知
    }
  };

  // カスタムイベントリスナーを設定
  useEffect(() => {
    const handleExportEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleExport(customEvent.detail);
      }
    };

    window.addEventListener('map-export', handleExportEvent);
    
    return () => {
      window.removeEventListener('map-export', handleExportEvent);
    };
  }, [map, mapReady]);

  // プロット表示のトグル処理
  const handleTogglePlots = () => {
    setShowPlots(prev => !prev);
  };
  
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


  // マウスイベントハンドラー
  const handleMouseOver = (e: any, feature: any) => {
    if (feature.properties && feature.geometry.type === "Point") {
      // マウス位置を取得
      const mouseEvent = e.originalEvent;
      
      // 元画像のURLを優先的に使用
      const imageUrl = feature.properties.processedImageUrl || feature.properties.originalImageUrl || '';
      
      // 画像ポップアップは表示しない（ボタンクリック時のみ表示）
      // 位置情報だけ更新（画像表示ボタンが押されたときのために）
      setPopupPosition({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY
      });
    }
  };
  
  const handleMouseOut = () => {
    // ポップアップは閉じない（ボタンで表示した場合は維持）
  };

  // クリックイベントハンドラー
  const handleClick = (e: any, feature: any) => {
    if (feature.properties && feature.geometry.type === "Point") {
      // クリック位置を取得
      const mouseEvent = e.originalEvent;
      
      // 位置情報だけ更新（画像表示ボタンが押されたときのために）
      setPopupPosition({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY
      });
      
      // 画像ポップアップを閉じる（他のプロットをクリックしたとき）
      setIsPopupVisible(false);
    }
  };

  // 画像表示ボタンのクリックハンドラー
  const handleShowImageClick = (imageUrl: string | Promise<string>) => {
    // ポップアップの位置を画面中央に設定（または適切な位置）
    setPopupPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    });
    
    // 画像URLがPromiseの場合は解決してから設定
    if (imageUrl instanceof Promise) {
      // 一時的に空文字をセット
      setHoveredImageUrl('');
      // Promiseを解決
      imageUrl.then(resolvedUrl => {
        setHoveredImageUrl(resolvedUrl);
        // ポップアップを表示（ボタンクリック時のみ）
        setIsPopupVisible(true);
      }).catch(error => {
        console.error('画像URLの解決に失敗しました:', error);
        // エラー時は表示しない
        setIsPopupVisible(false);
      });
    } else {
      // 文字列の場合はそのまま設定
      setHoveredImageUrl(imageUrl);
      // ポップアップを表示（ボタンクリック時のみ）
      setIsPopupVisible(true);
    }
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

  
  // 各フィーチャー(アップロードした動画など)にポップアップとイベントをバインドする関数(道具)
  const onEachFeature = (feature: any, layer: L.Layer) => {
    if (feature.properties) {
      if (feature.geometry.type === "Point") {
        const { pointId, damageScore, lastUpdated, damageClass, damageClassDescription, confidence, processedImageUrl, originalImageUrl } = feature.properties;
        
        // 元画像のURLを優先的に使用
        const imageUrl = processedImageUrl || originalImageUrl || '';
        
        // YOLOの情報を含むポップアップを作成
        let popupContent = `
          <div class="p-2">
            <h3 class="font-semibold">ポイント ${pointId}</h3>
            <p>損傷スコア: <strong>${damageScore || 0}/5</strong></p>
        `;
        
        // YOLOの情報がある場合は表示
        if (damageClass) {
          popupContent += `
            <p>損傷種別: <strong>${damageClass}</strong> (${damageClassDescription || '不明な損傷'})</p>
            <p>信頼度: <strong>${(confidence * 100).toFixed(1)}%</strong></p>
          `;
        }
        
        popupContent += `
            <p>最終更新: ${lastUpdated || '情報なし'}</p>
          </div>
        `;
        
        layer.bindPopup(popupContent);
        
        // マウスオーバーとマウスアウトのイベントを追加
        layer.on({
          mouseover: (e) => handleMouseOver(e, feature),
          mouseout: handleMouseOut,
          click: (e) => handleClick(e, feature) // クリックイベントを追加
        });
      } else {
        const { roadName, damageScore, lastUpdated, roadId } = feature.properties;
        
        // AIレポート（選択処理）- 動画アップロードで生成された道路線にもクリックイベントを追加
        layer.on({
          click: () => {
            // 画像ポップアップを閉じる（他の要素をクリックしたとき）
            setIsPopupVisible(false);
            
            const roadProps = feature.properties;
            const road = {
              ...roadProps,
              coordinates: feature.geometry.coordinates,
              score: damageScore // スコア情報を渡す
            };
            onSelectRoad(road);
          }
        });
        
        // デフォルト道路と同じ形式のポップアップを表示
        const p = feature.properties || {};
        const highwayLabel = highwayMap[p.highway] ?? 'その他';
        const damageLabel = damageMap[p["Damage Severity"] || p.damageClass] ?? '-';
        
        const popupContent = `
        <div style="font-size: 13px; line-height: 1.4">
          <strong>道路名:</strong> ${p.roadName || p.name || "(名称なし)"}<br />
          <strong>道路種別:</strong> ${highwayLabel}<br />
          <strong>舗装種別:</strong> ${p["Type of Pavement"] || "-"}<br />
          <strong>築年:</strong> ${p["Year of Construction"] ?? "-"} 年<br />
          <strong>補修履歴:</strong> ${p["Road Repair History"] ?? "-"} 年前<br />
          <strong>損傷の種類:</strong> ${damageLabel}<br />
          <strong>信頼度:</strong> ${typeof p["Confidence Level"] === 'number' ? p["Confidence Level"].toFixed(2) : 
                                  typeof p.confidence === 'number' ? p.confidence.toFixed(2) : "-"}<br />
          <strong>交通量:</strong> ${p["Traffic Volume"] ?? "-"}<br />
          <strong>排水性:</strong> ${p["Drainage Performance"] ?? "-"}<br />
          <strong>水道管:</strong> ${p["Presence of Water Pipe"] ? p["Presence of Water Pipe"] + " 年前補修" : "なし"}<br />
          <strong>ガス管:</strong> ${p["Presence of Gas Pipe"] ? p["Presence of Gas Pipe"] + " 年前補修" : "なし"}<br />
          <strong style="color: #d00;">補修優先スコア (AHP):</strong> ${typeof damageScore === 'number' ? damageScore.toFixed(3) : "-"}
        </div>
        `;
        layer.bindPopup(popupContent);
      }
    }
  };

  // Key for GeoJSON component to force re-render when data changes
  const geoJsonKey = useMemo(() => JSON.stringify(roadData), [roadData]);

  return (
    <div ref={mapContainerRef} className="relative h-full w-full">
      {/* プロット表示切り替えトグルスイッチ - 左上に配置して他のコントロールと重ならないようにする */}
      <div className="absolute top-4 left-4 z-[1000] bg-white p-2 rounded-md shadow-md flex items-center space-x-2">
        <span className="text-sm font-medium">プロット表示</span>
        <button 
          onClick={handleTogglePlots}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showPlots ? 'bg-blue-600' : 'bg-gray-300'}`}
          role="switch"
          aria-checked={showPlots}
        >
          <span 
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showPlots ? 'translate-x-6' : 'translate-x-1'}`} 
          />
        </button>
      </div>

      {/* 地図エクスポートコントロールは削除（Dashboard.tsxに移動） */}
      
      <MapContainer
        center={position}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        scrollWheelZoom={true}
        // マップ自体のクリックでも画像を閉じる
        onClick={() => setIsPopupVisible(false)}
      >
        {/* マップインスタンスハンドラー */}
        <MapInstanceHandler onMapReady={handleMapReady} />
        
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
        


        {/* 文京区の全道路を表示(道路の可視化  ) (scoreがなければ黒になる)*/}
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
                // 画像ポップアップを閉じる（他の要素をクリックしたとき）
                setIsPopupVisible(false);
                
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
            return marker;
          }}
        />

        {/* アップロードされたデータを表示 */}
        {roadData && (
          <>
            {/* GeoJSONによるデータ表示 - ポイントのみプロット表示ON/OFFで制御 */}
            {roadData.features && (
              <>
                {/* ポイントデータのみ条件付き表示 */}
                {showPlots && (
                  <GeoJSON 
                    key={`points-${geoJsonKey}`}
                    data={{
                      type: "FeatureCollection",
                      features: roadData.features.filter(f => f.geometry && f.geometry.type === "Point")
                    } as GeoJsonObject} 
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
                )}
                
                {/* ラインデータは常に表示 */}
                <GeoJSON 
                  key={`lines-${geoJsonKey}`}
                  data={{
                    type: "FeatureCollection",
                    features: roadData.features.filter(f => f.geometry && f.geometry.type === "LineString")
                  } as GeoJsonObject} 
                  style={style}
                  onEachFeature={onEachFeature}
                />
              </>
            )}
            
            {/* 明示的にポイントを描画 - プロット表示がONの場合のみ表示 */}
            {showPlots && roadData.features && roadData.features.filter(f => f.geometry && f.geometry.type === "Point").map((point, idx) => {
              const coords = point.geometry.coordinates;
              if (!coords || coords.length < 2) return null;
              
              // 元画像のURLを優先的に使用
              const imageUrl = point.properties.processedImageUrl || point.properties.originalImageUrl || '';
              
              return (
                <Marker 
                  key={`marker-${idx}`} 
                  position={[coords[1], coords[0]]}
                  eventHandlers={{
                    click: (e) => {
                      // クリック位置の更新のみ行い、画像表示はしない
                      setPopupPosition({
                        x: e.originalEvent.clientX,
                        y: e.originalEvent.clientY
                      });
                      // 画像ポップアップを閉じる（他のプロットをクリックしたとき）
                      setIsPopupVisible(false);
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <h3>ポイント {point.properties.pointId}</h3>
                      <p>損傷スコア: {point.properties.damageScore}/5</p>
                      {imageUrl && (
                        <button 
                          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          onClick={() => handleShowImageClick(imageUrl)}
                        >
                          画像を表示
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* ラインは常に表示（プロット表示ON/OFFに関わらず） */}
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
                  eventHandlers={{
                    click: () => {
                      // 画像ポップアップを閉じる（他の要素をクリックしたとき）
                      setIsPopupVisible(false);
                    }
                  }}
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

        {/* 色付けされた道路を表示 */}
        {coloredRoads.length > 0 && showPlots && (
          <GeoJSON
            data={{ type: "FeatureCollection", features: coloredRoads } as GeoJsonObject}
            style={(feature) => {
              return {
                color: getColor(feature?.properties?.damageScore || 0),
                weight: 5,
                opacity: 0.7
              };
            }}
            onEachFeature={(feature, layer) => {
              // AIレポート（選択処理）
              layer.on({
                click: () => {
                  const roadProps = feature.properties;
                  const road = {
                    ...roadProps,
                    coordinates: feature.geometry.coordinates,
                    score: feature.properties.damageScore
                  };
                  onSelectRoad(road);
                }
              });
              
              const p = feature.properties || {};
              const popupContent = `
              <div style="font-size: 13px; line-height: 1.4">
                <strong>道路名:</strong> ${p.roadName || "(名称なし)"}<br />
                <strong>損傷スコア:</strong> ${typeof p.damageScore === 'number' ? p.damageScore.toFixed(2) : "-"}<br />
                <strong>最終更新:</strong> ${p.lastUpdated || "-"}<br />
              </div>
              `;
              layer.bindPopup(popupContent);
            }}
          />
        )}
      </MapContainer>

      {/* 画像ポップアップ */}
      {isPopupVisible && hoveredImageUrl && (
        <YoloImagePopup
          imageUrl={hoveredImageUrl}
          position={popupPosition}
          onClose={() => setIsPopupVisible(false)}
          visible={isPopupVisible}
        />
      )}

      {/* 凡例 */}
      <MapLegend />
    </div>
  );
};

export default MapView;
