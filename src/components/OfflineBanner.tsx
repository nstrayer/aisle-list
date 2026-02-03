interface OfflineBannerProps {
  isOnline: boolean;
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 text-center py-2 px-4 text-sm font-medium">
      You're offline. Your list is saved locally.
    </div>
  );
}
