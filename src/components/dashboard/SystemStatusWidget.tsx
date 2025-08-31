
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Activity, Database, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SystemStatus {
  security: 'good' | 'warning' | 'error';
  performance: 'good' | 'warning' | 'error';
  connectivity: 'good' | 'warning' | 'error';
  backup: 'good' | 'warning' | 'error';
}

const SystemStatusWidget: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    security: 'good',
    performance: 'good',
    connectivity: 'good',
    backup: 'good',
  });
  const { subscription } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkSystemStatus();
  }, [subscription]);

  const checkSystemStatus = () => {
    // Simulate system status checks
    const newStatus: SystemStatus = {
      security: subscription?.status === 'active' ? 'good' : 'warning',
      performance: Math.random() > 0.8 ? 'warning' : 'good',
      connectivity: navigator.onLine ? 'good' : 'error',
      backup: 'good',
    };

    setStatus(newStatus);
  };

  const getStatusIcon = (statusType: string) => {
    switch (statusType) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (statusType: string) => {
    switch (statusType) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOverallStatus = () => {
    const statuses = Object.values(status);
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('warning')) return 'warning';
    return 'good';
  };

  const overallStatus = getOverallStatus();

  const statusItems = [
    {
      name: 'Segurança',
      status: status.security,
      icon: Shield,
      description: 'Sistema de segurança e backup',
    },
    {
      name: 'Performance',
      status: status.performance,
      icon: Activity,
      description: 'Velocidade e responsividade',
    },
    {
      name: 'Conectividade',
      status: status.connectivity,
      icon: Wifi,
      description: 'Conexão com a internet',
    },
    {
      name: 'Backup',
      status: status.backup,
      icon: Database,
      description: 'Backup automático dos dados',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(overallStatus)}
              Status do Sistema
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real
            </CardDescription>
          </div>
          <Badge className={getStatusColor(overallStatus)}>
            {overallStatus === 'good' ? 'Tudo OK' : 
             overallStatus === 'warning' ? 'Atenção' : 'Problemas'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {statusItems.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ItemIcon className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-600">{item.description}</p>
                  </div>
                </div>
                {getStatusIcon(item.status)}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/security-dashboard')}
          >
            Ver Detalhes Completos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemStatusWidget;
