
import React from 'react';
import { Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const FixedHeader = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-boracume-orange rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-boracume-orange">BoraCumê</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm">
            <Bell size={18} />
          </Button>
          
          <div className="flex items-center space-x-2 text-sm">
            <User size={16} />
            <span className="hidden md:inline">{user?.email}</span>
          </div>
          
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default FixedHeader;
