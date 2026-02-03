import { useState, useRef, ReactNode } from "react";

interface SwipeableItemProps {
  children: ReactNode;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 80;
const DELETE_BUTTON_WIDTH = 80;

export function SwipeableItem({ children, onDelete }: SwipeableItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;

    // If already open, offset the diff by the button width
    const startOffset = isOpen ? -DELETE_BUTTON_WIDTH : 0;
    let newTranslate = startOffset + diff;

    // Limit swipe: can only go left (negative), max DELETE_BUTTON_WIDTH
    if (newTranslate > 0) {
      newTranslate = 0;
    } else if (newTranslate < -DELETE_BUTTON_WIDTH) {
      newTranslate = -DELETE_BUTTON_WIDTH;
    }

    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Decide if we should snap open or closed
    if (translateX < -SWIPE_THRESHOLD / 2) {
      setTranslateX(-DELETE_BUTTON_WIDTH);
      setIsOpen(true);
    } else {
      setTranslateX(0);
      setIsOpen(false);
    }
  };

  const handleDeleteClick = () => {
    onDelete();
  };

  const closeSwipe = () => {
    setTranslateX(0);
    setIsOpen(false);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white font-semibold"
        style={{ width: DELETE_BUTTON_WIDTH }}
      >
        <button
          onClick={handleDeleteClick}
          className="w-full h-full flex items-center justify-center min-h-[44px]"
        >
          Delete
        </button>
      </div>

      {/* Main content */}
      <div
        className="relative bg-white dark:bg-gray-800 transition-transform duration-150 ease-out"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging.current ? "none" : "transform 150ms ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isOpen ? closeSwipe : undefined}
      >
        {children}
      </div>
    </div>
  );
}
