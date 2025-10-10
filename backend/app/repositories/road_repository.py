"""
道路リポジトリ（データベース操作）
`roads` テーブルに関する全ての DB クエリを扱います
"""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from geoalchemy2.functions import ST_AsGeoJSON
from app.models import Road


class RoadRepository:
    """道路関連のデータベース操作を担当するリポジトリ"""
    
    def __init__(self, session: AsyncSession):
        """
        データベースセッションでリポジトリを初期化します

        Args:
            session: 非同期の DB セッション (AsyncSession)
        """
        self.session = session
    
    async def get_all_roads(self) -> List[dict]:
        """
        データベースから全道路を取得し、ジオメトリを GeoJSON 文字列で返します

        Returns:
            GeoJSON ジオメトリを含む辞書のリスト

        返却例:
            [
                {
                    'id': 1,
                    'name': '国道20号線',
                    'geom_json': '{"type":"LineString","coordinates":[[139.745,35.729],...]}',
                    'created_at': datetime(...),
                    'updated_at': datetime(...)
                },
                ...
            ]
        """
        # PostGIS の ST_AsGeoJSON を利用してジオメトリを GeoJSON 文字列に変換
        query = select(
            Road.id,
            Road.name,
            ST_AsGeoJSON(Road.geom).label('geom_json'),
            Road.created_at,
            Road.updated_at
        )
        
        result = await self.session.execute(query)
        roads = result.all()
        
    # 実行結果の行を辞書に変換する
        return [
            {
                'id': road.id,
                'name': road.name,
                'geom_json': road.geom_json,
                'created_at': road.created_at,
                'updated_at': road.updated_at
            }
            for road in roads
        ]
    
    async def get_road_by_id(self, road_id: int) -> Optional[dict]:
        """
        指定 ID の道路を取得します

        Args:
            road_id: 道路の一意な識別子

        Returns:
            道路データの辞書、見つからない場合は None
        """
        query = select(
            Road.id,
            Road.name,
            ST_AsGeoJSON(Road.geom).label('geom_json'),
            Road.created_at,
            Road.updated_at
        ).where(Road.id == road_id)
        
        result = await self.session.execute(query)
        road = result.first()
        
        if road is None:
            return None
        
        return {
            'id': road.id,
            'name': road.name,
            'geom_json': road.geom_json,
            'created_at': road.created_at,
            'updated_at': road.updated_at
        }
    
    async def count_roads(self) -> int:
        """
        データベース内の道路数をカウントします

        Returns:
            道路の総数 (整数)
        """
        query = select(func.count(Road.id))
        result = await self.session.execute(query)
        return result.scalar() or 0
