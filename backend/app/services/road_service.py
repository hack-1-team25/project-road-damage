"""
道路サービス（ビジネスロジック）
DB モデルと API スキーマ間の変換を扱います
"""
import json
from typing import List
from app.repositories.road_repository import RoadRepository
from app.schemas.geojson import (
    RoadFeatureCollection,
    RoadFeature,
    LineStringGeometry,
    RoadProperties
)


class RoadService:
    """道路関連のビジネスロジックを扱うサービス層"""
    
    def __init__(self, repository: RoadRepository):
        """
        リポジトリを使ってサービスを初期化します

        Args:
            repository: データアクセス用の RoadRepository インスタンス
        """
        self.repository = repository
    
    async def get_all_roads_geojson(self) -> RoadFeatureCollection:
        """
        すべての道路を GeoJSON の FeatureCollection として取得します

        処理の流れ:
        1. リポジトリ経由で DB から道路データを取得
        2. PostGIS のジオメトリ文字列を GeoJSON に変換
        3. GeoJSON FeatureCollection 構造に整形して返却

        Returns:
            GeoJSON RFC 7946 準拠の RoadFeatureCollection
        """
        # DB から生データを取得
        roads = await self.repository.get_all_roads()
        
        # DB レコードを GeoJSON のフィーチャーに変換
        features = []
        for road in roads:
            # Parse GeoJSON string from PostGIS
            geometry_dict = json.loads(road['geom_json'])
            
            # Create LineString geometry
            geometry = LineStringGeometry(
                type=geometry_dict['type'],
                coordinates=geometry_dict['coordinates']
            )
            
            # Create feature properties
            # Include only non-null values to keep response clean
            properties = RoadProperties(
                id=road['id'],
                name=road['name']
            )
            
            # Create GeoJSON feature
            feature = RoadFeature(
                type="Feature",
                geometry=geometry,
                properties=properties
            )
            
            features.append(feature)
        
        # Return complete FeatureCollection
        return RoadFeatureCollection(
            type="FeatureCollection",
            features=features
        )
    
    async def get_roads_count(self) -> int:
        """
        Get total count of roads
        
        Returns:
            Total number of roads in database
        """
        return await self.repository.count_roads()
