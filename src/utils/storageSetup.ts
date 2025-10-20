import { supabase } from '@/integrations/supabase/client';

export interface StorageSetupResult {
  success: boolean;
  message: string;
}

/**
 * Cria automaticamente o bucket product-images no Supabase Storage
 */
export async function setupProductImagesBucket(): Promise<StorageSetupResult> {
  try {
    console.log('🔧 Iniciando setup do bucket product-images...');
    
    // Primeiro, tentar criar o bucket usando RPC
    console.log('📦 Tentando criar bucket via RPC...');
    const { data: bucketResult, error: bucketError } = await supabase
      .rpc('create_product_images_bucket');

    if (bucketError) {
      console.error('❌ Erro ao criar bucket via RPC:', bucketError);
      
      // Fallback: verificar se bucket já existe
      console.log('🔍 Verificando se bucket já existe...');
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('❌ Erro ao acessar storage:', listError);
        throw new Error(`Erro ao acessar storage: ${listError.message}`);
      }

      const bucketExists = buckets?.some(bucket => bucket.id === 'product-images');
      console.log(`📋 Bucket existe: ${bucketExists}`);
      
      if (!bucketExists) {
        console.log('🚀 Tentando criar bucket diretamente...');
        // Tentar criar bucket usando a API direta (pode não funcionar devido a permissões)
        const { error: createError } = await supabase.storage.createBucket('product-images', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        });

        if (createError) {
          console.error('❌ Erro ao criar bucket diretamente:', createError);
          throw new Error(`Erro ao criar bucket: ${createError.message}`);
        }
        console.log('✅ Bucket criado diretamente com sucesso!');
      } else {
        console.log('✅ Bucket já existe!');
      }
    } else {
      console.log('✅ Bucket criado via RPC:', bucketResult);
    }

    // Criar políticas de segurança
    console.log('🔐 Tentando criar políticas de segurança...');
    const { data: policiesResult, error: policiesError } = await supabase
      .rpc('create_product_images_policies');

    if (policiesError) {
      console.error('⚠️ Erro ao criar políticas via RPC:', policiesError);
      // Continuar mesmo se as políticas falharem, pois o bucket pode estar funcional
      console.log('⚠️ Continuando sem políticas - bucket pode estar funcional');
    } else {
      console.log('✅ Políticas criadas:', policiesResult);
    }

    console.log('🎉 Setup do storage concluído com sucesso!');
    return {
      success: true,
      message: 'Storage configurado com sucesso!'
    };

  } catch (error: any) {
    console.error('💥 Erro no setup do storage:', error);
    
    return {
      success: false,
      message: error.message || 'Erro desconhecido ao configurar storage'
    };
  }
}

/**
 * Verifica se o bucket product-images existe
 */
export async function checkBucketExists(): Promise<boolean> {
  try {
    console.log('🔍 Verificando existência do bucket product-images...');
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Erro ao verificar buckets:', error);
      return false;
    }

    const exists = buckets?.some(bucket => bucket.id === 'product-images') || false;
    console.log(`📋 Bucket product-images existe: ${exists}`);
    
    if (buckets && buckets.length > 0) {
      console.log('📦 Buckets disponíveis:', buckets.map(b => b.id));
    }
    
    return exists;
  } catch (error) {
    console.error('💥 Erro ao verificar bucket:', error);
    return false;
  }
}

/**
 * Setup completo do storage com retry
 */
export async function ensureStorageSetup(): Promise<StorageSetupResult> {
  console.log('🚀 Iniciando verificação e setup do storage...');
  
  // Primeiro verificar se já existe
  const bucketExists = await checkBucketExists();
  
  if (bucketExists) {
    console.log('✅ Storage já configurado - bucket encontrado!');
    return {
      success: true,
      message: 'Storage já configurado'
    };
  }

  console.log('⚙️ Bucket não encontrado, iniciando setup...');
  
  // Tentar configurar
  const setupResult = await setupProductImagesBucket();
  
  if (!setupResult.success) {
    console.log('🔄 Primeira tentativa falhou, tentando novamente em 1 segundo...');
    // Retry uma vez
    await new Promise(resolve => setTimeout(resolve, 1000));
    const retryResult = await setupProductImagesBucket();
    
    if (!retryResult.success) {
      console.error('💥 Falha após retry - storage não pôde ser configurado');
    }
    
    return retryResult;
  }

  console.log('🎉 Setup do storage concluído com sucesso!');
  return setupResult;
}