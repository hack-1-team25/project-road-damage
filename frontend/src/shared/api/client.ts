import axios from 'axios';
import type {
  DangerSpotListResponse,
  GetDangerSpotsParams,
  VideoResponse,
  VideoDetailResponse,
  UploadVideoRequest
} from '../types';
import { API_ENDPOINTS } from '../lib/config';

const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// 危険箇所一覧を取得
export async function getDangerSpots(
  params?: GetDangerSpotsParams
): Promise<DangerSpotListResponse> {
  const response = await apiClient.get<DangerSpotListResponse>(
    API_ENDPOINTS.dangerSpots,
    { params }
  );
  return response.data;
}

// 動画をアップロード
export async function uploadVideo(
  request: UploadVideoRequest
): Promise<VideoResponse> {
  const formData = new FormData();
  formData.append('video_file', request.video_file);
  formData.append('gps_log_file', request.gps_log_file);
  if (request.frame_interval !== undefined) {
    formData.append('frame_interval', request.frame_interval.toString());
  }

  const response = await apiClient.post<VideoResponse>(
    API_ENDPOINTS.videos,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

// 動画の詳細を取得
export async function getVideo(videoId: string): Promise<VideoDetailResponse> {
  const response = await apiClient.get<VideoDetailResponse>(
    `${API_ENDPOINTS.videos}/${videoId}`
  );
  return response.data;
}
