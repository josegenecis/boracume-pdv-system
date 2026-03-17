import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';

type MarketingSettings = {
  google_tag_id: string | null;
  facebook_pixel_id: string | null;
};

function normalizeId(value: any) {
  const v = String(value || '').trim();
  return v || null;
}

export default function MarketingPixels({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);

  useEffect(() => {
    const uid = String(userId || '').trim();
    if (!uid) {
      setSettings(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const { data } = await supabase
          .from('marketing_settings')
          .select('google_tag_id,facebook_pixel_id')
          .eq('user_id', uid)
          .maybeSingle();
        if (cancelled) return;
        setSettings({
          google_tag_id: normalizeId(data?.google_tag_id),
          facebook_pixel_id: normalizeId(data?.facebook_pixel_id)
        });
      } catch {
        if (!cancelled) setSettings(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const googleId = normalizeId(settings?.google_tag_id);
  const fbPixelId = normalizeId(settings?.facebook_pixel_id);

  const isGtm = Boolean(googleId && googleId.toUpperCase().startsWith('GTM-'));
  const isGtag = Boolean(googleId && !isGtm);

  const gtmScript = useMemo(() => {
    if (!isGtm || !googleId) return '';
    return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${googleId}');`;
  }, [googleId, isGtm]);

  const gtagInit = useMemo(() => {
    if (!isGtag || !googleId) return '';
    return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${googleId}');`;
  }, [googleId, isGtag]);

  const fbInit = useMemo(() => {
    if (!fbPixelId) return '';
    return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixelId}');fbq('track','PageView');`;
  }, [fbPixelId]);

  if (!googleId && !fbPixelId) return null;

  return (
    <>
      <Helmet>
        {isGtag && googleId ? <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleId}`} /> : null}
        {isGtm && googleId ? <script dangerouslySetInnerHTML={{ __html: gtmScript }} /> : null}
        {isGtag && googleId ? <script dangerouslySetInnerHTML={{ __html: gtagInit }} /> : null}
        {fbPixelId ? <script dangerouslySetInnerHTML={{ __html: fbInit }} /> : null}
      </Helmet>
      {isGtm && googleId ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${googleId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ) : null}
      {fbPixelId ? (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1`}
          />
        </noscript>
      ) : null}
    </>
  );
}

