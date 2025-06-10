
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Search, Settings, User, LogOut, Crown, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

const DashboardHeader: React.FC = () => {
  const { user, subscription, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getSubscriptionBadge = () => {
    if (!subscription) return null;

    if (subscription.status === 'trial' || subscription.status === 'trialing') {
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
          <Crown className="w-3 h-3 mr-1" />
          Trial
        </Badge>
      );
    }

    if (subscription.status === 'active') {
      const planName = subscription.plan?.name || 'Pro';
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
          <Crown className="w-3 h-3 mr-1" />
          {planName}
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        Inativo
      </Badge>
    );
  };

  const hasActiveSubscription = () => {
    return subscription?.status === 'active' || subscription?.status === 'trial' || subscription?.status === 'trialing';
  };

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar produtos, pedidos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Subscription Status */}
          <div className="flex items-center gap-2">
            {getSubscriptionBadge()}
            {!hasActiveSubscription() && (
              <Button
                size="sm"
                onClick={() => navigate('/subscription')}
                className="bg-boracume-orange hover:bg-orange-600"
              >
                <Crown className="w-4 h-4 mr-1" />
                Fazer Upgrade
              </Button>
            )}
          </div>

          {/* Security Status */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/configuracoes')}
            className="text-green-600 hover:bg-green-50"
          >
            <Shield className="w-4 h-4 mr-1" />
            Seguro
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0 text-xs">
              3
            </Badge>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-boracume-orange rounded-full flex items-center justify-center text-white font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">
                    {profile?.restaurant_name || 'Restaurante'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.email}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/subscription')}>
                <Crown className="mr-2 h-4 w-4" />
                Planos & Cobrança
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
