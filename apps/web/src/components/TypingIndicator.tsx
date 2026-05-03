export function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start mb-3">
      <div
        className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
        aria-hidden="true"
      >
        AI
      </div>
      <div
        className="bg-white/[0.06] border border-white/[0.08] rounded-[4px_16px_16px_16px] px-4 py-3"
        role="status"
        aria-label="CareCompanion is thinking"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-[#A78BFA] rounded-full typing-dot" />
          <div className="w-2 h-2 bg-[#A78BFA] rounded-full typing-dot" />
          <div className="w-2 h-2 bg-[#A78BFA] rounded-full typing-dot" />
        </div>
      </div>
    </div>
  );
}
