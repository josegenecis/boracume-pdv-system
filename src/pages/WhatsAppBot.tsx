
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import WhatsAppChatbot from '@/components/chat/WhatsAppChatbot';

const WhatsAppBot = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <WhatsAppChatbot />
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppBot;
