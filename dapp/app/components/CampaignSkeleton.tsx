export default function CampaignSkeleton(): React.ReactNode {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4 animate-pulse">
        <div className="flex justify-between">
            <div className="space-y-2">
                <div className="h-5 w-48 bg-gray-700 rounded" />
                <div className="h-3 w-72 bg-gray-800 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-700 rounded-full" />
        </div>
        <div className="space-y-1">
            <div className="flex justify-between">
                <div className="h-3 w-32 bg-gray-800 rounded" />
                <div className="h-3 w-24 bg-gray-800 rounded" />
            </div>
            <div className="h-2 w-full bg-gray-700 rounded-full" />
        </div>
    </div>
  )
}