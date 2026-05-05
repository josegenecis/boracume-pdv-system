import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SupportChat from '@/components/support/SupportChat';
import { SupportChatProvider } from '@/contexts/SupportChatContext';

export default function SupportSettings() {
  return (
    <SupportChatProvider>
      <Card>
        <CardHeader>
          <CardTitle>Suporte</CardTitle>
        </CardHeader>
        <CardContent>
          <SupportChat />
        </CardContent>
      </Card>
    </SupportChatProvider>
  );
}
