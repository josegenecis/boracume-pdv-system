
import React from 'react';
import SecurityMonitor from '@/components/security/SecurityMonitor';
import PerformanceMonitor from '@/components/performance/PerformanceMonitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

const SecurityDashboard: React.FC = () => {
  const { hasAccess } = useSubscriptionGuard({
    feature: 'o dashboard de segurança e performance',
    allowTrial: true,
  });

  if (!hasAccess) {
    return null; // Component will redirect automatically
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Segurança & Performance</h1>
      
      <Tabs defaultValue="security" className="w-full">
        <TabsList>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="security">
          <SecurityMonitor />
        </TabsContent>
        
        <TabsContent value="performance">
          <PerformanceMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;
