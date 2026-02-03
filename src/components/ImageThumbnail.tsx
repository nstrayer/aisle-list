import { useState } from "react";

interface ImageThumbnailProps {
  imageDataUrl: string;
}

export function ImageThumbnail({ imageDataUrl }: ImageThumbnailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-14 h-14 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 transition flex-shrink-0"
        title="View original image"
      >
        <img
          src={imageDataUrl}
          alt="Uploaded grocery list"
          className="w-full h-full object-cover"
        />
      </button>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute -top-12 right-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-white hover:text-gray-300 text-2xl font-bold"
              aria-label="Close"
            >
              x
            </button>
            <img
              src={imageDataUrl}
              alt="Uploaded grocery list"
              className="max-w-full max-h-[90vh] mx-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
