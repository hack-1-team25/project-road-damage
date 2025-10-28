// API設定
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const API_ENDPOINTS = {
  dangerSpots: `${API_BASE_URL}/danger-spots`,
  videos: `${API_BASE_URL}/videos`,
} as const;
