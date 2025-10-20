
import React from 'react';
<<<<<<< HEAD
import { Bell, User, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
=======
import { Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';

const FixedHeader = () => {
  const { signOut, user } = useAuth();
<<<<<<< HEAD
  const { isMobile, toggleSidebar } = useSidebar();
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
<<<<<<< HEAD
      <div className="flex items-center justify-between px-3 sm:px-6 py-3">
        <div className="flex items-center space-x-2 sm:space-x-4">
          {isMobile && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleSidebar}
              className="p-2"
            >
              <Menu size={18} />
            </Button>
          )}
          <Logo size="sm" />
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Button variant="ghost" size="sm" className="p-2">
=======
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center space-x-4">
          <Logo size="sm" />
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm">
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
            <Bell size={18} />
          </Button>
          <div className="flex items-center space-x-2 text-sm">
            <User size={16} />
<<<<<<< HEAD
            <span className="hidden md:inline truncate max-w-32">{user?.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="p-2">
=======
            <span className="hidden md:inline">{user?.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default FixedHeader;
