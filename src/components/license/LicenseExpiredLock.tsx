import React from 'react';
import { MessageCircle, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const BLOCKED_EMAIL = 'altavariedades@outlook.com';
const SUPPORT_PHONE = '5585992918273';
const SUPPORT_MESSAGE = 'Ola, preciso regularizar a licenca do PopSystem.';

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/reset-password',
  '/landing',
  '/auth/callback',
  '/menu',
  '/menu-digital',
  '/checklist',
  '/totem',
  '/track',
  '/mp',
  '/waiter-login',
  '/waiter-dashboard',
  '/waiter-session',
  '/funcionario-login',
  '/funcionario-ponto',
];

const isPublicRoute = (pathname: string) => {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

const LicenseExpiredLock: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const email = String(user?.email || '').trim().toLowerCase();
  const shouldBlock = !loading && email === BLOCKED_EMAIL && !isPublicRoute(location.pathname);

  if (!shouldBlock) return null;

  const supportUrl = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-[#062d22]/95 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-[#063f30] via-[#075640] to-[#0b6b4f] px-7 py-8 text-white">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/20">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#bdeaa3]">Acesso temporariamente bloqueado</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">Licenca expirada</h1>
          <p className="mt-3 text-base font-medium leading-relaxed text-white/86">
            Para continuar usando o PopSystem, regularize a licenca desta conta com o suporte.
          </p>
        </div>

        <div className="space-y-5 px-7 py-7">
          <div className="rounded-2xl border border-[#e7dfd2] bg-[#fffaf2] p-4 text-sm font-semibold leading-relaxed text-[#234438]">
            Esta tela aparece apenas para esta conta. O sistema sera liberado assim que a regularizacao for confirmada.
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e5eee8] bg-[#f7fbf8] p-5">
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#dfe9e2]">
              <QRCodeSVG value={supportUrl} size={164} />
            </div>
            <p className="text-center text-sm font-semibold text-[#55746a]">
              Escaneie ou toque no botao abaixo para falar com o suporte.
            </p>
          </div>

          <a
            href={supportUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#18a957] px-5 text-base font-black text-white shadow-lg shadow-[#18a957]/25 transition hover:bg-[#118847] focus:outline-none focus:ring-4 focus:ring-[#18a957]/30"
          >
            <MessageCircle className="h-5 w-5" />
            Falar com o suporte
          </a>
        </div>
      </div>
    </div>
  );
};

export default LicenseExpiredLock;
