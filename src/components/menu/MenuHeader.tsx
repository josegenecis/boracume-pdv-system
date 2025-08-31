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
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4">
          {profile?.logo_url && (
            <img 
              src={profile.logo_url} 
              alt="Logo"
              className="w-20 h-20 rounded-full object-cover border-4 border-gray-100 shadow-md"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {profile?.restaurant_name || 'Restaurante'}
            </h1>
            {profile?.description && (
              <p className="text-gray-600 mt-1 text-lg">{profile.description}</p>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-6 text-sm">
          {profile?.phone && (
            <div className="flex items-center gap-2 text-gray-700">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-medium">{profile.phone}</span>
            </div>
          )}
          {profile?.opening_hours && (
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">{profile.opening_hours}</span>
            </div>
          )}
          {profile?.address && (
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">{profile.address}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};