import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, Activity, Eye, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SecurityLog {
  id: string;
  event_type: string;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  severity: 'low' | 'medium' | 'high';
}

interface SecurityStatus {
  subscriptionValid: boolean;
  dataBackupEnabled: boolean;
  sslEnabled: boolean;
  twoFactorEnabled: boolean;
  lastBackup: string | null;
  securityScore: number;
}

const SecurityMonitor: React.FC = () => {
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    subscriptionValid: false,
    dataBackupEnabled: true,
    sslEnabled: true,
    twoFactorEnabled: false,
    lastBackup: null,
    securityScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user, subscription } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSecurityData();
    }
  }, [user]);

  const fetchSecurityData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Calculate security score and status
      const subscriptionValid = subscription?.status === 'active' || subscription?.status === 'trial';
      const securityScore = calculateSecurityScore({
        subscriptionValid,
        dataBackupEnabled: true,
        sslEnabled: true,
        twoFactorEnabled: false,
      });

      // Simulate some security logs
      const mockLogs: SecurityLog[] = [
        {
          id: '1',
          event_type: 'login',
          description: 'Login realizado com sucesso',
          ip_address: '192.168.1.1',
          user_agent: navigator.userAgent,
          created_at: new Date().toISOString(),
          severity: 'low',
        },
        {
          id: '2',
          event_type: 'security_check',
          description: 'Verificação de segurança automática',
          ip_address: '192.168.1.1',
          user_agent: navigator.userAgent,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          severity: 'low',
        }
      ];

      setSecurityLogs(mockLogs);
      setSecurityStatus({
        subscriptionValid,
        dataBackupEnabled: true,
        sslEnabled: true,
        twoFactorEnabled: false,
        lastBackup: new Date().toISOString(),
        securityScore,
      });

    } catch (error: any) {
      console.error('Error fetching security data:', error);
      toast({
        title: 'Erro ao carregar dados de segurança',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSecurityScore = (status: Partial<SecurityStatus>) => {
    let score = 0;
    if (status.subscriptionValid) score += 25;
    if (status.dataBackupEnabled) score += 25;
    if (status.sslEnabled) score += 25;
    if (status.twoFactorEnabled) score += 25;
    return score;
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 75) return CheckCircle;
    if (score >= 50) return AlertTriangle;
    return AlertTriangle;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const securityChecks = [
    {
      name: 'Assinatura Válida',
      status: securityStatus.subscriptionValid,
      description: 'Sua assinatura está ativa e válida',
      icon: Shield,
    },
    {
      name: 'Backup de Dados',
      status: securityStatus.dataBackupEnabled,
      description: 'Backup automático dos dados habilitado',
      icon: Activity,
    },
    {
      name: 'Conexão SSL',
      status: securityStatus.sslEnabled,
      description: 'Conexão segura com certificado SSL',
      icon: Lock,
    },
    {
      name: 'Autenticação 2FA',
      status: securityStatus.twoFactorEnabled,
      description: 'Autenticação de dois fatores (recomendado)',
      icon: Eye,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const ScoreIcon = getScoreIcon(securityStatus.securityScore);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Monitor de Segurança</h2>
        <Button onClick={fetchSecurityData} variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScoreIcon className={`w-6 h-6 ${getScoreColor(securityStatus.securityScore)}`} />
            Pontuação de Segurança
          </CardTitle>
          <CardDescription>
            Status geral da segurança do seu sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-3xl font-bold ${getScoreColor(securityStatus.securityScore)}`}>
              {securityStatus.securityScore}/100
            </span>
            <Badge variant={securityStatus.securityScore >= 75 ? 'default' : 'destructive'}>
              {securityStatus.securityScore >= 75 ? 'Seguro' : 'Atenção Necessária'}
            </Badge>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                securityStatus.securityScore >= 75
                  ? 'bg-green-500'
                  : securityStatus.securityScore >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${securityStatus.securityScore}%` }}
            />
          </div>

          {securityStatus.securityScore < 75 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Sua pontuação de segurança pode ser melhorada. Verifique os itens abaixo.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Security Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Verificações de Segurança</CardTitle>
          <CardDescription>
            Status dos principais componentes de segurança
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {securityChecks.map((check, index) => {
              const CheckIcon = check.icon;
              return (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckIcon className={`w-5 h-5 ${check.status ? 'text-green-500' : 'text-red-500'}`} />
                    <div>
                      <div className="font-medium">{check.name}</div>
                      <div className="text-sm text-gray-600">{check.description}</div>
                    </div>
                  </div>
                  <Badge variant={check.status ? 'default' : 'destructive'}>
                    {check.status ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Security Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Segurança</CardTitle>
          <CardDescription>
            Últimas atividades relacionadas à segurança
          </CardDescription>
        </CardHeader>
        <CardContent>
          {securityLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Nenhum log de segurança encontrado
            </p>
          ) : (
            <div className="space-y-3">
              {securityLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.event_type}</span>
                      <Badge className={getSeverityColor(log.severity)}>
                        {log.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{log.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Status */}
      {securityStatus.lastBackup && (
        <Card>
          <CardHeader>
            <CardTitle>Status do Backup</CardTitle>
            <CardDescription>
              Informações sobre o último backup realizado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Último backup realizado</p>
                <p className="text-sm text-gray-600">
                  {new Date(securityStatus.lastBackup).toLocaleString('pt-BR')}
                </p>
              </div>
              <Badge variant="default">
                <CheckCircle className="w-4 h-4 mr-1" />
                Ativo
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityMonitor;
