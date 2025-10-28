'use client';

import dynamic from 'next/dynamic';
import { UploadPanel } from '@/features/upload-video';

const MapView = dynamic(
  () => import('@/widgets/map').then(mod => ({ default: mod.MapView })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">地図を読み込み中...</p>
      </div>
    )
  }
);

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            路面損傷検出システム
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            AIによる路面損傷の自動検出と可視化
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-1 overflow-y-auto">
              <UploadPanel />
            </div>

            <div className="lg:col-span-2 h-[600px] lg:h-full">
              <div className="h-full bg-white rounded-lg shadow overflow-hidden">
                <MapView autoRefresh={true} refreshInterval={30000} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
