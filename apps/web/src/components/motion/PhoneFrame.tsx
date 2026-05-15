'use client';

import type { ReactNode } from 'react';

interface PhoneFrameProps {
  children: ReactNode;
  statusBarTitle?: string;
}

export function PhoneFrame({ children, statusBarTitle }: PhoneFrameProps) {
  return (
    <div
      className="mx-auto overflow-hidden"
      style={{
        width: 280,
        height: 560,
        borderRadius: 36,
        background: '#000',
        border: '8px solid #1C1C1E',
        boxShadow: 'var(--glow-soft-blue)',
      }}
    >
      <div
        className="flex h-7 items-center justify-between px-4 text-[10px]"
        style={{ background: '#1C1C1E', color: '#fff' }}
      >
        <span>9:41</span>
        <span style={{ fontWeight: 600 }}>{statusBarTitle ?? ''}</span>
        <span>100%</span>
      </div>
      <div className="h-[calc(100%-1.75rem)] overflow-hidden" style={{ background: '#0B0B0F' }}>
        {children}
      </div>
    </div>
  );
}
