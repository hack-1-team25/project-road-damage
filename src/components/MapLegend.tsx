import React from 'react';

const MapLegend: React.FC = () => {
  const legendItems = [
    { color: '#3b82f6', label: '損傷なし (0)' },
    { color: '#22c55e', label: '軽微 (1-2)' },
    { color: '#eab308', label: '中程度 (3-4)' },
    { color: '#ef4444', label: '重度 (5)' },
  ];

  return (
    <div className="absolute bottom-6 left-4 bg-white p-2 rounded-md shadow-md z-[1000]">
      <h4 className="text-sm font-medium mb-2">損傷スコア</h4>
      <div className="space-y-1">
        {legendItems.map((item, index) => (
          <div key={index} className="flex items-center">
            <div
              className="w-6 h-3 mr-2"
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;