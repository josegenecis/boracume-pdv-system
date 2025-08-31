import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

async function tryDockerPostgres() {
  console.log('🐳 Tentando usar Docker para conectar ao PostgreSQL do Supabase...\n');

  // Informações de conexão do Supabase
  const host = 'db.gcfyrcpugmducptktjic.supabase.co';
  const port = '5432';
  const database = 'postgres';
  const username = 'postgres';
  // A senha seria necessária, mas não temos acesso a ela

  console.log('📋 OPÇÕES DISPONÍVEIS:\n');

  console.log('1. 🌐 MÉTODO RECOMENDADO - Painel Web do Supabase:');
  console.log('   • Acesse: https://supabase.com/dashboard/project/gcfyrcpugmducptktjic/sql');
  console.log('   • Cole e execute o conteúdo do arquivo "complete-kds-setup.sql"');
  console.log('   • Este arquivo contém TUDO que precisa ser executado\n');

  console.log('2. 🐳 Docker + psql (se você tiver a senha do banco):');
  console.log('   docker run --rm -it postgres:15 psql \\');
  console.log(`     -h ${host} \\`);
  console.log(`     -p ${port} \\`);
  console.log(`     -U ${username} \\`);
  console.log(`     -d ${database} \\`);
  console.log('     -f /path/to/complete-kds-setup.sql\n');

  console.log('3. 🔧 Verificar se Docker está funcionando:');
  
  try {
    const { stdout } = await execAsync('docker --version');
    console.log('   ✅ Docker está instalado:', stdout.trim());
    
    // Tentar verificar se há containers PostgreSQL rodando
    try {
      const { stdout: containers } = await execAsync('docker ps --filter "ancestor=postgres" --format "table {{.Names}}\\t{{.Status}}"');
      if (containers.trim()) {
        console.log('   📦 Containers PostgreSQL encontrados:');
        console.log('  ', containers);
      } else {
        console.log('   📦 Nenhum container PostgreSQL rodando');
      }
    } catch (err) {
      console.log('   ⚠️  Erro ao verificar containers:', err.message);
    }

  } catch (error) {
    console.log('   ❌ Docker não está disponível:', error.message);
  }

  console.log('\n4. 📁 Arquivos criados para você:');
  console.log('   • complete-kds-setup.sql - Script completo para executar no Supabase');
  console.log('   • fix-kitchen-orders-table.sql - Apenas para adicionar campos');
  console.log('   • create-kds-trigger-remote.sql - Apenas para criar trigger');
  console.log('   • setup-complete-kds.js - Para testar após configuração\n');

  console.log('🎯 PRÓXIMOS PASSOS:');
  console.log('1. Abra o painel do Supabase SQL');
  console.log('2. Execute o arquivo "complete-kds-setup.sql"');
  console.log('3. Teste com: node setup-complete-kds.js');
  console.log('4. Se funcionar, o KDS estará 100% configurado! 🎉');

  // Verificar se os arquivos existem
  const files = [
    'complete-kds-setup.sql',
    'fix-kitchen-orders-table.sql', 
    'create-kds-trigger-remote.sql',
    'setup-complete-kds.js'
  ];

  console.log('\n📂 Verificando arquivos:');
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`   ✅ ${file} (${stats.size} bytes)`);
      } else {
        console.log(`   ❌ ${file} - não encontrado`);
      }
    } catch (err) {
      console.log(`   ❌ ${file} - erro: ${err.message}`);
    }
  }
}

tryDockerPostgres();