import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink, Instagram, Plus, X } from 'lucide-react';
import AutoplayVideo from '@/components/media/AutoplayVideo';
import { enforceMutedAutoplay, isVideoAsset } from '@/utils/videoAutoplay';

export interface StoryBanner {
  id: string;
  imageUrl: string;
  title: string;
  description?: string;
  link?: string;
  bannerType?: 'wide' | 'tile';
  productId?: string | null;
  mediaSource?: 'file' | 'instagram';
  externalVideoUrl?: string | null;
}

export interface StoryLinkedProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
}

interface BannerStoryViewerProps {
  open: boolean;
  banners: StoryBanner[];
  initialIndex: number;
  linkedProducts?: Record<string, StoryLinkedProduct>;
  onClose: () => void;
  onOpenProduct?: (productId: string) => void;
  onQuickAddProduct?: (productId: string) => Promise<void> | void;
  onOpenLink?: (href: string) => void;
}

const IMAGE_STORY_DURATION = 5000;

const isInstagramStory = (banner?: StoryBanner | null) => {
  if (!banner) return false;
  return banner.mediaSource === 'instagram' || Boolean(String(banner.externalVideoUrl || '').trim());
};

const getInstagramEmbedUrl = (value?: string | null) => {
  try {
    const raw = String(value || '').trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return '';
    const match = url.pathname.match(/(?:^|\/)(reel|p|tv)\/([^/?#]+)/i);
    if (!match) return '';
    return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed`;
  } catch {
    return '';
  }
};

const BannerStoryViewer: React.FC<BannerStoryViewerProps> = ({
  open,
  banners,
  initialIndex,
  linkedProducts = {},
  onClose,
  onOpenProduct,
  onQuickAddProduct,
  onOpenLink,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [runningAction, setRunningAction] = useState<'quick-add' | 'open-product' | 'link' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(Math.min(Math.max(initialIndex, 0), Math.max(0, banners.length - 1)));
    setProgress(0);
    setRunningAction(null);
  }, [open, initialIndex, banners.length]);

  const currentBanner = banners[currentIndex] || null;
  const linkedProduct = currentBanner?.productId ? linkedProducts[String(currentBanner.productId)] : undefined;
  const totalStories = banners.length;
  const isInstagram = isInstagramStory(currentBanner);
  const isVideo = isVideoAsset(currentBanner?.imageUrl);
  const mediaImageUrl = linkedProduct?.imageUrl || currentBanner?.imageUrl || '';
  const instagramEmbedUrl = isInstagram ? getInstagramEmbedUrl(currentBanner?.externalVideoUrl || currentBanner?.link) : '';
  const displayTitle = currentBanner?.title?.trim() || 'Banner promocional';

  const progressSegments = useMemo(() => {
    return banners.map((_, index) => {
      if (index < currentIndex) return 100;
      if (index > currentIndex) return 0;
      return progress;
    });
  }, [banners, currentIndex, progress]);

  const goToIndex = (index: number) => {
    const safeIndex = Math.min(Math.max(index, 0), Math.max(0, banners.length - 1));
    setCurrentIndex(safeIndex);
    setProgress(0);
  };

  const goNext = () => {
    if (currentIndex >= banners.length - 1) {
      onClose();
      return;
    }
    goToIndex(currentIndex + 1);
  };

  const goPrevious = () => {
    if (currentIndex <= 0) {
      goToIndex(0);
      return;
    }
    goToIndex(currentIndex - 1);
  };

  useEffect(() => {
    if (!open || !currentBanner || isVideo || isInstagram) return;

    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const nextProgress = Math.min(100, ((now - startedAt) / IMAGE_STORY_DURATION) * 100);
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        goNext();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [open, currentBanner, isVideo, isInstagram, currentIndex]);

  useEffect(() => {
    if (!open || !currentBanner || !isVideo || !videoRef.current) return;
    const video = videoRef.current;
    const cleanup = enforceMutedAutoplay(video);
    setProgress(0);
    video.currentTime = 0;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
    return cleanup;
  }, [open, currentBanner, isVideo, currentIndex]);

  if (!currentBanner) return null;

  const handleQuickAdd = async () => {
    const productId = String(currentBanner.productId || '').trim();
    if (!productId || !onQuickAddProduct) return;
    try {
      setRunningAction('quick-add');
      await onQuickAddProduct(productId);
      onClose();
    } finally {
      setRunningAction(null);
    }
  };

  const handleOpenProduct = async () => {
    const productId = String(currentBanner.productId || '').trim();
    if (!productId || !onOpenProduct) return;
    try {
      setRunningAction('open-product');
      onOpenProduct(productId);
      onClose();
    } finally {
      setRunningAction(null);
    }
  };

  const handleOpenLink = async () => {
    const href = String(currentBanner.link || '').trim();
    if (!href || !onOpenLink) return;
    try {
      setRunningAction('link');
      onOpenLink(href);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-[100vw] h-[100dvh] w-[100vw] rounded-none border-0 bg-black p-0 text-white sm:max-w-[100vw]">
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />
          <div className="absolute inset-x-0 top-0 z-20 p-4 sm:p-5">
            <div className="mb-4 flex gap-1.5">
              {progressSegments.map((value, index) => (
                <div key={banners[index].id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white transition-all duration-100" style={{ width: `${value}%` }} />
                </div>
              ))}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {mediaImageUrl ? (
                  <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                    <img src={mediaImageUrl} alt={displayTitle} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                    <Instagram className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/80">
                    Story {currentIndex + 1} de {totalStories}
                  </div>
                  {currentBanner.title?.trim() ? (
                    <div className="truncate text-lg font-bold">{currentBanner.title}</div>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="relative z-10 flex h-full w-full items-center justify-center">
            {isInstagram ? (
              instagramEmbedUrl ? (
                <div className="flex h-full w-full items-center justify-center px-3 pb-20 pt-24 sm:px-6">
                  <iframe
                    title={displayTitle}
                    src={instagramEmbedUrl}
                    className="h-[min(78dvh,760px)] w-full max-w-[540px] rounded-2xl border-0 bg-white"
                    loading="lazy"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] px-8 text-center">
                  <Instagram className="mb-4 h-16 w-16" />
                  {currentBanner.title?.trim() ? (
                    <div className="max-w-[320px] text-xl font-bold">{currentBanner.title}</div>
                  ) : null}
                  {currentBanner.description ? (
                    <div className="mt-2 max-w-[320px] text-sm text-white/85">{currentBanner.description}</div>
                  ) : null}
                  <div className="mt-5 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white">
                    Story do Instagram abre pelo botão abaixo
                  </div>
                </div>
              )
            ) : isVideo ? (
              <AutoplayVideo
                ref={videoRef}
                src={currentBanner.imageUrl}
                className="h-full w-full object-contain"
                loop={false}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  const nextProgress = video.duration ? (video.currentTime / video.duration) * 100 : 0;
                  setProgress(Math.min(100, nextProgress));
                }}
                onEnded={goNext}
              />
            ) : (
              <img src={currentBanner.imageUrl} alt={displayTitle} className="h-full w-full object-contain" />
            )}
          </div>

          {!isInstagram ? (
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-20 w-1/3 cursor-pointer bg-transparent"
              onClick={goPrevious}
              aria-label="Story anterior"
            />
          ) : null}
          {!isInstagram ? (
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-20 w-1/3 cursor-pointer bg-transparent"
              onClick={goNext}
              aria-label="Próximo story"
            />
          ) : null}

          {(linkedProduct || (!isInstagram && currentBanner.link)) ? (
            <div className="absolute bottom-5 right-4 z-20 sm:bottom-6 sm:right-6">
              <Button
                type="button"
                className="h-10 rounded-full bg-white/92 px-2.5 pr-3 text-xs font-semibold text-slate-900 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.75)] hover:bg-white"
                onClick={linkedProduct ? handleQuickAdd : handleOpenLink}
                disabled={runningAction !== null}
              >
                {linkedProduct && linkedProduct.imageUrl ? (
                  <img src={linkedProduct.imageUrl} alt="" className="mr-2 h-7 w-7 rounded-full object-cover" />
                ) : linkedProduct ? (
                  <Plus className="mr-1.5 h-4 w-4" />
                ) : (
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                )}
                {runningAction === 'quick-add'
                  ? 'Adicionando...'
                  : linkedProduct
                    ? 'Adicionar'
                    : 'Abrir'}
              </Button>
            </div>
          ) : null}

          {isInstagram && currentBanner.link ? (
            <div className="absolute bottom-5 left-4 z-20 sm:bottom-6 sm:left-6">
              <Button
                type="button"
                className="h-10 rounded-full bg-white/92 px-3 text-xs font-semibold text-slate-900 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.75)] hover:bg-white"
                onClick={handleOpenLink}
                disabled={runningAction !== null}
              >
                <Instagram className="mr-1.5 h-4 w-4" />
                Instagram
              </Button>
            </div>
          ) : null}

          {totalStories > 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:flex"
                onClick={goPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:flex"
                onClick={goNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BannerStoryViewer;
