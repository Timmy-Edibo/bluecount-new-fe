'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { CloseSessionModal } from '@/components/CloseSessionModal';
import { useSession } from '@/contexts/SessionContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const session = useSession();

  return (
    <div className="flex min-h-screen">
      <AppSidebar onCloseSession={() => setShowCloseModal(true)} />
      <main className="flex-1 min-w-0 p-4 md:p-6">
        {children}
      </main>
      {showCloseModal && session.currentSession && (
        <CloseSessionModal
          sessionId={session.currentSession.id}
          openingBalance={session.currentSession.openingBalance}
          onClose={(closingBalance) =>
            session.closeSession(session.currentSession!.id, closingBalance)
          }
          onDismiss={() => setShowCloseModal(false)}
        />
      )}
    </div>
  );
}
