export function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start mb-3">
      <div
        className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6366F1] to-[#A78BFA] flex-shrink-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <svg width="14" height="14" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
        </svg>
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
