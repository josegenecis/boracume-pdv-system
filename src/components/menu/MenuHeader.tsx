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
    <div className="relative">
      <div className="h-40 w-full bg-gradient-to-r from-orange-100 to-orange-50" />
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative -mt-10">
          <div className="flex items-center gap-4">
            {profile?.logo_url && (
              <img
                src={profile.logo_url}
                alt="Logo"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl bg-white"
              />
            )}
            <div className="bg-white rounded-xl shadow-sm border p-4 flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profile?.restaurant_name || 'Restaurante'}
                  </h1>
                  {profile?.description && (
                    <p className="text-gray-600 mt-1">{profile.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">{profile.phone}</span>
                  </div>
                )}
                {profile?.opening_hours && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">{profile.opening_hours}</span>
                  </div>
                )}
                {profile?.address && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">{profile.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
