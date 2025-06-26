
import React from 'react';
import { Phone } from 'lucide-react';

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  description?: string;
  logo_url?: string;
}

interface DigitalMenuHeaderProps {
  profile: Profile;
}

export const DigitalMenuHeader: React.FC<DigitalMenuHeaderProps> = ({ profile }) => {
  return (
    <div className="bg-white border-b shadow-sm">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4">
          {profile.logo_url && (
            <img src={profile.logo_url} alt="Logo" className="w-16 h-16 rounded-full object-cover" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{profile.restaurant_name || 'Restaurante'}</h1>
            {profile.description && <p className="text-gray-600">{profile.description}</p>}
            {profile.phone && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{profile.phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
