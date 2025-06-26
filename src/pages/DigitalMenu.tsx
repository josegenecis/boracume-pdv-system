
import React from 'react';
import { useParams } from 'react-router-dom';
import { DigitalMenuContainer } from '@/components/menu/DigitalMenuContainer';
import { DigitalMenuErrorStates } from '@/components/menu/DigitalMenuErrorStates';

const DigitalMenu = () => {
  const { userId } = useParams();

  if (!userId) {
    return <DigitalMenuErrorStates type="no-user" />;
  }

  return <DigitalMenuContainer userId={userId} />;
};

export default DigitalMenu;
