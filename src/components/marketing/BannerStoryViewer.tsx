import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, ShoppingBag, X } from 'lucide-react';

export interface StoryBanner {
  id: string;
  imageUrl: string;
  title: string;
  description?: string;
  link?: string;
  bannerType?: 'wide' | 'tile';
  productId?: string | null;
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

const isVideoAsset = (value?: string) => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || '').trim());

const formatBRL = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const isVideo = isVideoAsset(currentBanner?.imageUrl);

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
    if (!open || !currentBanner || isVideo) return;

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
  }, [open, currentBanner, isVideo, currentIndex]);

  useEffect(() => {
    if (!open || !currentBanner || !isVideo || !videoRef.current) return;
    const video = videoRef.current;
    setProgress(0);
    video.currentTime = 0;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
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
                <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                  <img src={linkedProduct?.imageUrl || currentBanner.imageUrl} alt={currentBanner.title} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white/80">
                    Story {currentIndex + 1} de {totalStories}
                  </div>
                  <div className="truncate text-lg font-bold">{currentBanner.title}</div>
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
            {isVideo ? (
              <video
                ref={videoRef}
                src={currentBanner.imageUrl}
                className="h-full w-full object-contain"
                autoPlay
                playsInline
                muted
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  const nextProgress = video.duration ? (video.currentTime / video.duration) * 100 : 0;
                  setProgress(Math.min(100, nextProgress));
                }}
                onEnded={goNext}
              />
            ) : (
              <img src={currentBanner.imageUrl} alt={currentBanner.title} className="h-full w-full object-contain" />
            )}
          </div>

          <button
            type="button"
            className="absolute inset-y-0 left-0 z-20 w-1/3 cursor-pointer bg-transparent"
            onClick={goPrevious}
            aria-label="Story anterior"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 z-20 w-1/3 cursor-pointer bg-transparent"
            onClick={goNext}
            aria-label="Próximo story"
          />

          <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-6">
            <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-black/45 p-4 backdrop-blur-xl sm:p-5">
              {currentBanner.description ? (
                <p className="text-sm leading-6 text-white/80 sm:text-base">{currentBanner.description}</p>
              ) : null}
              {linkedProduct ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Produto vinculado</div>
                      <div className="mt-1 truncate text-lg font-bold">{linkedProduct.name}</div>
                      {linkedProduct.description ? (
                        <div className="mt-1 line-clamp-2 text-sm text-white/70">{linkedProduct.description}</div>
                      ) : null}
                    </div>
                    <div className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
                      {formatBRL(linkedProduct.price)}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className="h-11 flex-1 rounded-2xl bg-white text-slate-900 hover:bg-white/90"
                      onClick={handleQuickAdd}
                      disabled={runningAction !== null}
                    >
                      {runningAction === 'quick-add' ? (
                        'Adicionando...'
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar ao carrinho
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                      onClick={handleOpenProduct}
                      disabled={runningAction !== null}
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Ver produto
                    </Button>
                  </div>
                </div>
              ) : currentBanner.link ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    className="h-11 w-full rounded-2xl bg-white text-slate-900 hover:bg-white/90"
                    onClick={handleOpenLink}
                    disabled={runningAction !== null}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir oferta
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

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
