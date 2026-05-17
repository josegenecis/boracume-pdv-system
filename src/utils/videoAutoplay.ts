export const isVideoAsset = (value?: string | null) =>
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(value || '').trim());

export const enforceMutedAutoplay = (video: HTMLVideoElement | null) => {
  if (!video) return () => {};

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('preload', 'auto');

  const play = () => {
    if (!video.isConnected) return;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
  };

  const playWhenVisible = () => {
    if (document.visibilityState === 'visible') play();
  };

  video.addEventListener('loadedmetadata', play);
  video.addEventListener('canplay', play);
  document.addEventListener('visibilitychange', playWhenVisible);

  const frame = window.requestAnimationFrame(play);
  const timer = window.setTimeout(play, 250);

  return () => {
    video.removeEventListener('loadedmetadata', play);
    video.removeEventListener('canplay', play);
    document.removeEventListener('visibilitychange', playWhenVisible);
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
};
