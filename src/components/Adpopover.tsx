import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface AdPopoverProps {
  imageUrl: string;
  linkUrl: string;
  width?: number;
  height?: number;
}

const AdPopover = ({ imageUrl, linkUrl, width = 300, height = 160 }: AdPopoverProps) => {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <>
      {isVisible && (
        <div className="md:fixed md:bottom-12 md:right-12  mx-4 mx-auto max-w-[400px] 
          md:w-auto z-50 shadow-xl bg-[#1c1d22]/30 bg-opacity-20 border border-white/5 
          rounded-lg md:overflow-hidden z-[10]">
          {/* 关闭按钮 */}
          <div className="relative w-full flex justify-end p-2">
            <button 
              onClick={() => setIsVisible(false)}
              className="bg-gray-800/70 hover:bg-gray-800 
                rounded-full w-6 h-6 flex items-center justify-center text-white"
            >
              ×
            </button>
          </div>
          
          {/* 广告内容 */}
          <Link href={linkUrl} target="_blank" rel="noopener noreferrer">
            <Image
              src={imageUrl}
              alt="Advertisement"
              width={width}
              height={height}
              className="w-full md:w-auto object-cover"
            />
          </Link>
        </div>
      )}
    </>
  );
};

export default AdPopover;
