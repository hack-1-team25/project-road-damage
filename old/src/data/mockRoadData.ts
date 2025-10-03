// Mock GeoJSON data for Bunkyo ward roads
const mockRoadData = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "roadName": "本郷通り",
        "damageScore": 1,
        "lastUpdated": "2025-05-20"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7516, 35.7080],
          [139.7586, 35.7120],
          [139.7626, 35.7150]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "春日通り",
        "damageScore": 3,
        "lastUpdated": "2025-05-19"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7450, 35.7060],
          [139.7516, 35.7080],
          [139.7570, 35.7095]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "白山通り",
        "damageScore": 4,
        "lastUpdated": "2025-05-18"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7400, 35.7200],
          [139.7450, 35.7150],
          [139.7500, 35.7100]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "不忍通り",
        "damageScore": 2,
        "lastUpdated": "2025-05-21"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7600, 35.7180],
          [139.7650, 35.7150],
          [139.7700, 35.7120]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "目白通り",
        "damageScore": 0,
        "lastUpdated": "2025-05-17"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7350, 35.7250],
          [139.7400, 35.7200],
          [139.7450, 35.7150]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "千川通り",
        "damageScore": 5,
        "lastUpdated": "2025-05-16"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7520, 35.7250],
          [139.7550, 35.7200],
          [139.7580, 35.7150]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "護国寺通り",
        "damageScore": 1,
        "lastUpdated": "2025-05-15"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7280, 35.7130],
          [139.7320, 35.7100],
          [139.7360, 35.7070]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "文京区道123号",
        "damageScore": 3,
        "lastUpdated": "2025-05-14"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7620, 35.7050],
          [139.7650, 35.7080],
          [139.7680, 35.7110]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "文京区道456号",
        "damageScore": 2,
        "lastUpdated": "2025-05-13"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7400, 35.7000],
          [139.7450, 35.7030],
          [139.7500, 35.7060]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "roadName": "文京区道789号",
        "damageScore": 4,
        "lastUpdated": "2025-05-12"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7720, 35.7220],
          [139.7750, 35.7180],
          [139.7780, 35.7140]
        ]
      }
    }
  ]
};

export default mockRoadData;