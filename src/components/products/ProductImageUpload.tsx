
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Upload, X, Image, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ensureStorageSetup } from '@/utils/storageSetup';


interface ProductImageUploadProps {
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
}

const ProductImageUpload: React.FC<ProductImageUploadProps> = ({
  onImageUploaded,
  currentImageUrl
}) => {
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(currentImageUrl || '');

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const { toast } = useToast();

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);

      setUploadProgress(0);
      setUploadSuccess(false);
      
      // Simular progresso inicial
      setUploadProgress(10);
      
      // Garantir que o storage está configurado
      console.log('🚀 Iniciando processo de upload...');
      const setupResult = await ensureStorageSetup();
      
      if (!setupResult.success) {
        console.error('❌ Erro no setup do storage:', setupResult.message);
        
        // Implementar fallback direto: tentar criar bucket via API direta
        console.log('🔄 Tentando fallback direto...');
        try {
          const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
          
          if (bucketsError) {
            console.error('❌ Erro ao acessar storage:', bucketsError);
            throw new Error('Erro ao acessar o storage. Verifique a configuração do Supabase.');
          }

          const bucketExists = buckets?.some(bucket => bucket.id === 'product-images');
          console.log(`📋 Bucket existe no fallback: ${bucketExists}`);
          
          if (!bucketExists) {
            console.log('🚀 Tentando criar bucket via fallback direto...');
            const { error: createError } = await supabase.storage.createBucket('product-images', {
              public: true,
              fileSizeLimit: 5242880, // 5MB
              allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            });

            if (createError) {
              console.error('❌ Fallback direto falhou:', createError);
              throw new Error('Não foi possível configurar o storage automaticamente. Entre em contato com o administrador.');
            }
            console.log('✅ Bucket criado via fallback direto!');
          }
        } catch (fallbackError: any) {
          console.error('💥 Erro no fallback:', fallbackError);
          throw new Error(fallbackError.message || 'Erro crítico na configuração do storage.');
        }
      } else {
        console.log('✅ Storage configurado com sucesso!');
      }

      setUploadProgress(30);
      
      setUploadProgress(50);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      setUploadProgress(70);


      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {

        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      setUploadProgress(90);


      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onImageUploaded(data.publicUrl);
      setImagePreview(data.publicUrl);

      setUploadProgress(100);
      setUploadSuccess(true);
      
      // Mostrar sucesso por 2 segundos
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 2000);

      
      toast({
        title: "Sucesso",
        description: "Imagem enviada com sucesso!",
      });

    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      
      let errorMessage = "Erro ao fazer upload da imagem.";
      let errorDetails = "";
      
      if (error.message?.includes('bucket') || error.message?.includes('storage')) {
        errorMessage = "Storage não configurado";
        errorDetails = "Não foi possível configurar o storage automaticamente. Tente novamente ou contate o administrador.";
      } else if (error.message?.includes('policy')) {
        errorMessage = "Sem permissão para upload";
        errorDetails = "Você precisa estar logado para fazer upload de imagens.";
      } else if (error.message?.includes('size')) {
        errorMessage = "Arquivo muito grande";
        errorDetails = "O arquivo deve ter no máximo 5MB.";
      } else if (error.message?.includes('mime') || error.message?.includes('type')) {
        errorMessage = "Tipo de arquivo inválido";
        errorDetails = "Apenas imagens JPEG, PNG, WebP e GIF são permitidas.";
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = "Erro de conexão";
        errorDetails = "Verifique sua conexão com a internet e tente novamente.";
      }
      
      toast({
        title: errorMessage,
        description: errorDetails || error.message,
        variant: "destructive"
      });
      
      setUploadProgress(0);
      setUploadSuccess(false);

    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {

      // Validar tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Apenas imagens JPEG, PNG, WebP e GIF são permitidas.",
          variant: "destructive"
        });
        return;
      }
      
      // Validar tamanho do arquivo
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 5MB.",

          variant: "destructive"
        });
        return;
      }
      
      uploadImage(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    onImageUploaded('');

    setUploadProgress(0);
    setUploadSuccess(false);

  };

  return (
    <div className="space-y-4">

      <Label htmlFor="image-upload">Imagem do Produto</Label>
      
      {imagePreview ? (
        <div className="relative">
          <img
            src={imagePreview}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-lg border"

          />
          <Button
            type="button"
            variant="destructive"
            size="sm"

            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={removeImage}
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </Button>
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
              <div className="text-white text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <div className="text-sm">{uploadProgress}%</div>
              </div>
            </div>
          )}
          {uploadSuccess && (
            <div className="absolute inset-0 bg-green-500 bg-opacity-80 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="space-y-2">
            <div className="mx-auto w-12 h-12 text-gray-400">
              {uploading ? (
                <Loader2 className="h-12 w-12 animate-spin" />
              ) : (
                <Image className="h-12 w-12" />
              )}
            </div>
            <div className="text-sm text-gray-600">
              {uploading ? (
                <div>
                  <div>Enviando imagem...</div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs mt-1">{uploadProgress}%</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div>Clique para selecionar uma imagem</div>
                  <div className="text-xs text-gray-500 mt-1">
                    JPEG, PNG, WebP ou GIF (máx. 5MB)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <Input
        id="image-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />
      
      <Button
        type="button"
        variant="outline"
        onClick={() => document.getElementById('image-upload')?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Enviando... {uploadProgress}%
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {imagePreview ? 'Alterar Imagem' : 'Selecionar Imagem'}
          </>
        )}
      </Button>

    </div>
  );
};

export default ProductImageUpload;
