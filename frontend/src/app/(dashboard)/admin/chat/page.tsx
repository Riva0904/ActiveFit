'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DirectMessagesPage } from '@/components/chat/DirectMessagesPage';
import { AdminSupportChat } from '@/components/chat/AdminSupportChat';

type Tab = 'gym' | 'support';

/**
 * Two separate things: private messages with people at this gym, and the gym's
 * own line to ActiveBoost. The old "every member conversation" inbox is gone —
 * a thread now belongs to the two people on it.
 */
export default function AdminChatPage() {
  const [tab, setTab] = useState<Tab>('gym');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['gym', 'Messages'], ['support', 'ActiveBoost support']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium border',
              tab === value
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'gym' ? <DirectMessagesPage /> : <AdminSupportChat />}
    </div>
  );
}
