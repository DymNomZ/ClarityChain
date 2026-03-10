'use client'

interface FeedSkeletonProps {
    backgroundColor?: string;
    borderColor?: string;
    secondaryColor?: string;
    tertiaryColor?: string;
}

export const FeedSkeleton = ({ backgroundColor = "bg-gray-900", borderColor = "border-gray-700", secondaryColor = "bg-gray-700", tertiaryColor = "bg-gray-800" }: FeedSkeletonProps) => (
  <div className={`rounded-xl border-l-4 ${borderColor} ${backgroundColor} p-4 space-y-2 animate-pulse`}>
    <div className="flex justify-between">
      <div className={`h-4 w-36 ${secondaryColor} rounded`} />
      <div className={`h-3 w-20 ${tertiaryColor} rounded`} />
    </div>
    <div className={`h-3 w-64 ${tertiaryColor} rounded`} />
    <div className={`h-3 w-48 ${tertiaryColor} rounded`} />
  </div>
);

export const FeedModalSkeleton = () => <FeedSkeleton backgroundColor="bg-gray-800" secondaryColor="bg-gray-600" tertiaryColor="bg-gray-700" />