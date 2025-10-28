// バックエンドのAPIレスポンスに対応する型定義

export interface DangerSpot {
  id: string;
  image_id: string;
  latitude: number;
  longitude: number;
  danger_score: number;
  damage_class: string | null;
  confidence: number | null;
  detected_at: string;
  image?: ImageSummary;
}

export interface ImageSummary {
  id: string;
  filename: string;
  frame_index: number;
  extracted_at: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  damage_score: number | null;
  primary_damage_class: string | null;
  confidence: number | null;
}

export interface DangerSpotListResponse {
  spots: DangerSpot[];
  total: number;
  limit: number;
  offset: number;
}

export interface VideoResponse {
  id: string;
  filename: string;
  storage_path: string;
  frame_interval: number;
  status: string;
  job_id: string;
  extracted_frames: number;
  created_at: string;
}

export interface VideoDetailResponse extends VideoResponse {
  duration_seconds: number | null;
  frame_rate: number | null;
  total_frames: number | null;
  images: ImageSummary[];
}

export interface UploadVideoRequest {
  video_file: File;
  gps_log_file: File;
  frame_interval?: number;
}

export interface GetDangerSpotsParams {
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
  min_score?: number;
  damage_class?: string;
  limit?: number;
  offset?: number;
}

// 損傷クラスの説明マッピング
export const damageClassDescriptions: Record<string, string> = {
  D00: '縦方向ひび割れ',
  D10: '横方向ひび割れ',
  D20: 'ワニ皮状ひび割れ',
  D40: 'ポットホール（穴ぼこ）',
  D43: '白線のぼやけ',
  D44: '横断歩道のぼやけ',
  D50: 'マンホールカバー'
};
