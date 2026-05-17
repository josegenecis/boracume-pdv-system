import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { enforceMutedAutoplay } from '@/utils/videoAutoplay';

type AutoplayVideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & {
  src: string;
};

const AutoplayVideo = React.forwardRef<HTMLVideoElement, AutoplayVideoProps>(({ src, className, loop = true, ...props }, forwardedRef) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement, []);

  useEffect(() => {
    return enforceMutedAutoplay(videoRef.current);
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      {...props}
      autoPlay
      loop={loop}
      muted
      playsInline
      preload="auto"
    />
  );
});

AutoplayVideo.displayName = 'AutoplayVideo';

export default AutoplayVideo;
