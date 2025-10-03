import React from 'react';
import { Loader as Road } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Road className="h-8 w-8 text-blue-600" />
            <h1 className="ml-2 text-lg font-semibold text-gray-900">路面損傷評価マップ</h1>
            <span className="ml-2 px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
              文京区限定MVP
            </span>
          </div>
          <div className="hidden md:block">
            <span className="inline-flex rounded-md shadow-sm">
              <a
                href="https://www.city.bunkyo.lg.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                文京区公式サイト
              </a>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;