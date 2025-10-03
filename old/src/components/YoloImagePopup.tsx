import React from 'react';

interface YoloImagePopupProps {
  imageUrl: string;
  visible: boolean;
  position: { x: number; y: number };
  onClose?: () => void; // 閉じるためのコールバック関数（オプショナル）
}

const YoloImagePopup: React.FC<YoloImagePopupProps> = ({ imageUrl, visible, position, onClose }) => {
  if (!visible || !imageUrl) return null;

  // 背景クリックで閉じる処理
  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClose) {
      onClose();
    }
  };

  // ポップアップ内クリックでの伝播を止める
  const handlePopupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* 背景オーバーレイ - クリックで閉じる */}
      <div 
        className="fixed inset-0 z-40 bg-black bg-opacity-30"
        style={{ display: visible ? 'block' : 'none' }}
        onClick={handleBackdropClick}
      />
      
      {/* ポップアップコンテンツ */}
      <div 
        className="fixed z-50 bg-white rounded-lg shadow-xl p-4 border border-gray-300"
        style={{ 
          left: `${position.x + 20}px`, 
          top: `${position.y - 120}px`,
          maxWidth: '400px',
          maxHeight: '450px',
          display: visible ? 'block' : 'none',
          zIndex: 10000
        }}
        onClick={handlePopupClick}
      >
        {/* ヘッダー部分 */}
        <div className="flex justify-between items-center mb-3">
          <div className="text-lg font-semibold text-gray-800">画像表示</div>
          {onClose && (
            <button 
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              onClick={onClose}
            >
              ✕
            </button>
          )}
        </div>
        
        {/* 画像表示部分 */}
        <img 
          src={imageUrl} 
          alt="道路損傷画像" 
          className="w-full h-auto rounded-md"
          style={{ maxHeight: '350px', objectFit: 'contain' }}
        />
      </div>
    </>
  );
};

export default YoloImagePopup;
