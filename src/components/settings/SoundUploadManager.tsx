import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Play, Trash2, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SoundUploadManagerProps {
  customUrls: {
    custom_bell_url?: string;
    custom_chime_url?: string;
    custom_ding_url?: string;
    custom_notification_url?: string;
  };
  onSoundUploaded: (soundType: string, url: string | null) => void;
}

const SoundUploadManager: React.FC<SoundUploadManagerProps> = ({ customUrls, onSoundUploaded }) => {
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRefs = {
    bell: useRef<HTMLInputElement>(null),
    chime: useRef<HTMLInputElement>(null),
    ding: useRef<HTMLInputElement>(null),
    notification: useRef<HTMLInputElement>(null),
  };

  const soundTypes = [
    { key: 'bell', label: 'Sino', urlKey: 'custom_bell_url' as const },
    { key: 'chime', label: 'Carrilhão', urlKey: 'custom_chime_url' as const },
    { key: 'ding', label: 'Ding', urlKey: 'custom_ding_url' as const },
    { key: 'notification', label: 'Notificação', urlKey: 'custom_notification_url' as const },
  ];

  const handleFileUpload = async (soundType: string, file: File) => {
    if (!user) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo de áudio (MP3, WAV, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(soundType);

    try {
      const fileName = `${user.id}/${soundType}.${file.name.split('.').pop()}`;

      // Fazer upload do arquivo
      const { error: uploadError } = await supabase.storage
        .from('user-sounds')
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data } = supabase.storage
        .from('user-sounds')
        .getPublicUrl(fileName);

      // Atualizar estado local
      onSoundUploaded(soundType, data.publicUrl);

      // Salvar automaticamente no banco de dados
      await saveCustomSoundToDatabase(soundType, data.publicUrl);

      toast({
        title: "Som personalizado ativo!",
        description: `Som personalizado para ${soundTypes.find(s => s.key === soundType)?.label} foi salvo e está ativo.`,
      });
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const saveCustomSoundToDatabase = async (soundType: string, url: string) => {
    if (!user) return;

    try {
      const urlKey = `custom_${soundType}_url`;
      
      // Verificar se já existe configuração
      const { data: existingData } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const updateData = {
        [urlKey]: url,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        await supabase
          .from('notification_settings')
          .update(updateData)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('notification_settings')
          .insert({
            user_id: user.id,
            ...updateData
          });
      }
    } catch (error) {
      console.error('Erro ao salvar no banco:', error);
    }
  };

  const handleDelete = async (soundType: string) => {
    if (!user) return;

    try {
      // Remover arquivo do storage
      const { error } = await supabase.storage
        .from('user-sounds')
        .remove([`${user.id}/${soundType}`]);

      if (error) console.warn('Erro ao remover arquivo:', error);

      // Atualizar estado local
      onSoundUploaded(soundType, null);

      // Salvar automaticamente no banco de dados
      await saveCustomSoundToDatabase(soundType, null);

      toast({
        title: "Som removido",
        description: `Som personalizado removido. Voltando ao som padrão.`,
      });
    } catch (error) {
      console.error('Erro ao deletar:', error);
    }
  };

  const playSound = (soundType: string) => {
    const soundTypeData = soundTypes.find(s => s.key === soundType);
    if (!soundTypeData) return;

    const customUrl = customUrls[soundTypeData.urlKey];
    const audio = new Audio(customUrl || `/sounds/${soundType}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(console.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music size={24} />
          Sons Personalizados
        </CardTitle>
        <CardDescription>
          Envie seus próprios arquivos de som para personalizar as notificações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {soundTypes.map((soundType) => {
          const hasCustomSound = !!customUrls[soundType.urlKey];
          const isUploading = uploading === soundType.key;

          return (
            <div key={soundType.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <Label className="font-medium">{soundType.label}</Label>
                  <span className="text-sm text-muted-foreground">
                    {hasCustomSound ? 'Som personalizado' : 'Som padrão'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playSound(soundType.key)}
                  disabled={isUploading}
                >
                  <Play size={16} />
                </Button>

                {hasCustomSound ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(soundType.key)}
                    disabled={isUploading}
                  >
                    <Trash2 size={16} />
                  </Button>
                ) : (
                  <>
                    <Input
                      ref={fileInputRefs[soundType.key as keyof typeof fileInputRefs]}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(soundType.key, file);
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs[soundType.key as keyof typeof fileInputRefs].current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        'Enviando...'
                      ) : (
                        <>
                          <Upload size={16} className="mr-1" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="text-xs text-muted-foreground mt-4">
          <p>• Formatos aceitos: MP3, WAV, OGG</p>
          <p>• Tamanho máximo: 2MB por arquivo</p>
          <p>• Os sons personalizados substituem os sons padrão</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SoundUploadManager;