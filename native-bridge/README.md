BoraCumê Native Bridge

O Native Bridge permite imprimir em impressoras térmicas (USB, Bluetooth clássico e rede TCP 9100) e ler balanças via Serial/USB, usando Node.js no computador local.

Pré‑requisitos
- Node.js 18+
- Impressora suportando ESC/POS (ex.: Epson TM‑T20/T88, Bematech, Daruma, Elgin)

Instalação
1. Abra o terminal nesta pasta `native-bridge/`
2. Instale as dependências:
   npm install
3. Inicie o servidor:
   npm run start

Por padrão o servidor abre em `ws://localhost:8766`.

Conexão da impressora
- Rede (TCP 9100): defina o IP da impressora ao conectar pelo app (ex.: 192.168.0.50)
- USB: requer módulos do sistema instalados; plugue a impressora via USB
- Bluetooth clássico: emparelhe a impressora no sistema operacional antes

Testes
- Na aplicação BoraCumê, abra Configurações → Dispositivos, escaneie e conecte na “Bridge Printer (Local)”, clique “Imprimir teste”.

Observações
- Em ambiente web, o app se conecta ao Native Bridge via WebSocket e envia os dados do cupom.
- Se você usa uma impressora de rede, este é o caminho mais simples e confiável.

