import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Database, RefreshCw, Terminal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SystemCheck = () => {
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);

  const checkTables = async () => {
    setLoading(true);
    const results: any = {};
    
    const tables = ['ingredients', 'expenses', 'agent_activity_logs', 'waiters', 'products'];
    
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('count').limit(1).single();
        results[table] = !error;
      } catch (e) {
        results[table] = false;
      }
    }
    
    setStatus(results);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Verificação do Sistema
          </CardTitle>
          <CardDescription>
            Verifique se todas as tabelas necessárias estão criadas no banco de dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(status).map(([table, exists]) => (
              <div key={table} className={`p-4 rounded-lg border flex items-center justify-between ${exists ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <span className="font-medium">{table}</span>
                {exists ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-4 mt-4">
            <Button variant="outline" onClick={checkTables} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Verificar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Instruções para Correção</AlertTitle>
        <AlertDescription>
          Se alguma tabela estiver faltando (vermelho), você precisa rodar o script SQL de migração no seu painel do Supabase.
          <br /><br />
          1. Vá para o painel do Supabase (SQL Editor)
          <br />
          2. Copie o conteúdo do arquivo <code>supabase/migrations/20240523000000_create_agent_tables.sql</code>
          <br />
          3. Cole e execute no SQL Editor.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SystemCheck;
