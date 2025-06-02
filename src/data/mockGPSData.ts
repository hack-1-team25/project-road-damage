// src/data/mockGPSData.ts
export interface GPSData {
    timestamp: string;
    latitude: number;
    longitude: number;
  }
  
  export const mockGPSData: GPSData[] = [
    {
      timestamp: "2025-05-31T12:00:00Z",
      latitude: 35.7081,
      longitude: 139.7516,
    },
    {
      timestamp: "2025-05-31T12:00:10Z",
      latitude: 35.7083,
      longitude: 139.7520,
    },
    {
      timestamp: "2025-05-31T12:00:20Z",
      latitude: 35.7085,
      longitude: 139.7525,
    },
    // ... more as needed
  ];
  