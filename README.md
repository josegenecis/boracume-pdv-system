<<<<<<< HEAD
# BoraCumê - Sistema de Gestão de Restaurante

Sistema completo de gestão para restaurantes com funcionalidades de PDV, gestão de pedidos, cardápio digital e muito mais.

## 🚀 Funcionalidades

- **PDV (Ponto de Venda)**: Sistema completo para vendas no balcão
- **Gestão de Pedidos**: Controle total dos pedidos com status em tempo real
- **Cardápio Digital**: Interface moderna para visualização do menu
- **Sistema de Entregadores**: Gestão completa de entregadores e entregas
- **Controle Financeiro**: Relatórios e controle de vendas
- **Gestão de Produtos**: CRUD completo de produtos e categorias
- **Sistema de Notificações**: Toasts e notificações em tempo real
- **Áreas de Entrega**: Configuração de bairros e taxas de entrega

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + Shadcn/ui
- **Backend**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Estado**: React Query + Context API
- **Roteamento**: React Router DOM
- **Notificações**: React Hot Toast + Radix UI Toast
- **Ícones**: Lucide React

## 📦 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd BORACUME
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Configure suas credenciais do Supabase no arquivo `.env`:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_KEY=sua_chave_de_servico
```

5. Execute o projeto:
```bash
npm run dev
```

## 🗄️ Estrutura do Banco de Dados

O projeto utiliza Supabase com as seguintes tabelas principais:

- `orders` - Pedidos
- `order_items` - Itens dos pedidos
- `products` - Produtos
- `categories` - Categorias
- `delivery_areas` - Áreas de entrega
- `delivery_drivers` - Entregadores
- `kitchen_orders` - Pedidos na cozinha (KDS)
- `notification_settings` - Configurações de notificação

## 🔧 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Gera o build de produção
- `npm run preview` - Visualiza o build de produção
- `npm run lint` - Executa o linter

## 📱 Funcionalidades Principais

### PDV (Ponto de Venda)
- Interface intuitiva para vendas
- Cálculo automático de totais
- Integração com sistema de pagamento

### Gestão de Pedidos
- Visualização em tempo real
- Controle de status (Pendente, Aceito, Em Preparo, Pronto, Entregue)
- Integração com KDS (Kitchen Display System)

### Cardápio Digital
- Interface responsiva
- Categorização de produtos
- Imagens e descrições detalhadas

### Sistema de Entregas
- Gestão de entregadores
- Controle de áreas de entrega
- Cálculo automático de taxas

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor, abra uma issue ou envie um pull request.

## 📄 Licença

Este projeto está sob a licença MIT.

## 📞 Suporte

Para suporte, entre em contato através do email: suporte@boracume.com

---

**BoraCumê** - Desenvolvido com ❤️ para revolucionar a gestão de restaurantes.
=======
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/411cc844-ef39-4277-a88e-574f3069317f

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/411cc844-ef39-4277-a88e-574f3069317f) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/411cc844-ef39-4277-a88e-574f3069317f) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
