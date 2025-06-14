import React from 'react';
import { Clock, MapPin, Phone } from 'lucide-react';

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  description?: string;
  logo_url?: string;
}

interface MenuHeaderProps {
  profile: Profile;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({ profile }) => {
  return (
    <div className="bg-primary text-primary-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          {profile?.logo_url && (
            <img 
              src={profile.logo_url} 
              alt="Logo"
              className="w-16 h-16 rounded-full object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {profile?.restaurant_name || 'Restaurante'}
            </h1>
            {profile?.description && (
              <p className="text-primary-foreground/80">{profile.description}</p>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {profile?.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {profile.phone}
            </div>
          )}
          {profile?.opening_hours && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {profile.opening_hours}
            </div>
          )}
          {profile?.address && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {profile.address}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};