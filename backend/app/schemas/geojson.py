"""
GeoJSON レスポンススキーマ（GeoJSON 仕様 RFC 7946 に準拠）
"""
from typing import List, Dict, Any, Literal, Optional
from pydantic import BaseModel, Field


class LineStringGeometry(BaseModel):
    """道路フィーチャー向けの LineString ジオメトリ"""
    type: Literal["LineString"] = "LineString"
    coordinates: List[List[float]] = Field(
        ...,
        description="Array of [longitude, latitude] coordinate pairs",
        min_items=2
    )


class RoadProperties(BaseModel):
    """道路フィーチャーに紐づくプロパティ"""
    id: int = Field(..., description="Road unique identifier")
    name: Optional[str] = Field(None, description="Road name")
    
    # 既存データからの任意の追加プロパティ
    highway: Optional[str] = Field(None, description="Highway classification")
    damage_severity: Optional[str] = Field(None, alias="Damage Severity")
    confidence_level: Optional[float] = Field(None, alias="Confidence Level")
    type_of_pavement: Optional[str] = Field(None, alias="Type of Pavement")
    road_repair_history: Optional[int] = Field(None, alias="Road Repair History")
    year_of_construction: Optional[int] = Field(None, alias="Year of Construction")
    presence_of_water_pipe: Optional[int] = Field(None, alias="Presence of Water Pipe")
    presence_of_gas_pipe: Optional[int] = Field(None, alias="Presence of Gas Pipe")
    traffic_volume: Optional[str] = Field(None, alias="Traffic Volume")
    drainage_performance: Optional[str] = Field(None, alias="Drainage Performance")
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "国道20号線",
                "highway": "primary",
                "Damage Severity": "S00",
                "Confidence Level": 0.0
            }
        }


class RoadFeature(BaseModel):
    """単一の道路を表す GeoJSON Feature"""
    type: Literal["Feature"] = "Feature"
    geometry: LineStringGeometry
    properties: RoadProperties


class RoadFeatureCollection(BaseModel):
    """複数の道路フィーチャーを含む GeoJSON FeatureCollection"""
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[RoadFeature] = Field(
        default_factory=list,
        description="Array of road features"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [139.7452763, 35.7296523],
                                [139.745291, 35.7296358],
                                [139.7453141, 35.72961]
                            ]
                        },
                        "properties": {
                            "id": 1,
                            "name": "国道20号線"
                        }
                    }
                ]
            }
        }
