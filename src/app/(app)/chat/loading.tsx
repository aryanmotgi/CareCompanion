import { Skeleton } from '@/components/Skeleton'

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* AI message */}
        <div className="flex gap-2 items-end">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-16 w-3/4 rounded-2xl rounded-bl-md" />
        </div>
        {/* User message */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-2/3 rounded-2xl rounded-br-md" />
        </div>
        {/* AI message */}
        <div className="flex gap-2 items-end">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-24 w-4/5 rounded-2xl rounded-bl-md" />
        </div>
        {/* User message */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-1/2 rounded-2xl rounded-br-md" />
        </div>
      </div>
      {/* Input bar */}
      <div className="px-4 pb-2">
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    </div>
  )
}
