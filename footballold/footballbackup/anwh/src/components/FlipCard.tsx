import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';

interface FlipCardProps {
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
  shouldFlip: boolean;
  flipDuration?: number;
  flipDelay?: number;
  className?: string;
}

/**
 * GSAP FLIP CARD COMPONENT
 * ========================
 * 
 * Creates a smooth 3D flip animation using GSAP
 */
const FlipCard: React.FC<FlipCardProps> = ({
  frontContent,
  backContent,
  shouldFlip,
  flipDuration = 0.6,
  flipDelay = 2,
  className = ''
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!cardRef.current || !frontRef.current || !backRef.current) return;

    const card = cardRef.current;
    const front = frontRef.current;
    const back = backRef.current;

    // Check if parent has CSS animations that might interfere
    const parentElement = card.parentElement;
    const hasParentAnimation = parentElement && (
      parentElement.classList.contains('animate-bounce') ||
      parentElement.classList.contains('animate-subtle-shake') ||
      parentElement.classList.contains('animate-pulse') ||
      parentElement.classList.contains('animate-wobble') ||
      parentElement.classList.contains('animate-high-debt-bounce') ||
      parentElement.classList.contains('animate-returnables-shake')
    );

    // Set initial 3D perspective and positioning
    gsap.set(card, {
      transformStyle: "preserve-3d",
      perspective: 1000,
      // iOS Safari specific fixes
      WebkitTransformStyle: "preserve-3d",
      WebkitPerspective: 1000,
      // Override any parent transforms that might interfere
      position: "relative",
      isolation: "isolate", // Create new stacking context
      // Force hardware acceleration for iPhone 7
      transform: "translateZ(0)",
      WebkitTransform: "translateZ(0)"
    });

    gsap.set(front, {
      rotationX: 0,
      backfaceVisibility: "hidden",
      transformStyle: "preserve-3d",
      WebkitBackfaceVisibility: "hidden",
      WebkitTransformStyle: "preserve-3d",
      position: "relative",
      zIndex: 2,
      // iPhone 7 specific fixes - EXACTLY like Goldenstrenew
      transform: "rotateX(0deg) translateZ(1px)",
      WebkitTransform: "rotateX(0deg) translateZ(1px)",
      transformOrigin: "center center",
      WebkitTransformOrigin: "center center"
    });

    gsap.set(back, {
      rotationX: -180,
      backfaceVisibility: "hidden",
      transformStyle: "preserve-3d",
      WebkitBackfaceVisibility: "hidden",
      WebkitTransformStyle: "preserve-3d",
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      transformOrigin: "center center",
      WebkitTransformOrigin: "center center",
      zIndex: 1,
      // iPhone 7 specific fixes - EXACTLY like Goldenstrenew
      transform: "rotateX(-180deg) translateZ(1px)",
      WebkitTransform: "rotateX(-180deg) translateZ(1px)"
    });

    // Create flip animation timeline
    const createFlipTimeline = () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }

      // Use different animation approach for cards with parent animations
      const animationDuration = hasParentAnimation ? flipDuration * 0.8 : flipDuration;
      const animationEase = hasParentAnimation ? "power2.inOut" : "power1.inOut";

      timelineRef.current = gsap.timeline({ 
        repeat: shouldFlip ? -1 : 0,
        delay: flipDelay,
        yoyo: true,
        repeatDelay: flipDelay,
        // Override any parent timeline interference
        overwrite: "auto"
      });

      // iOS-specific: Use opacity-based visibility switching with yoyo support
      // When front is visible, back is hidden (opacity 0), and vice versa
      timelineRef.current
        // First flip: Show back (shift marker)
        .to([front, back], {
          rotationX: "+=180",
          duration: animationDuration,
          ease: animationEase,
          transformOrigin: "50% 50%",
          WebkitTransformOrigin: "50% 50%",
          force3D: true,
          transform: "rotateX(+=180deg) translateZ(0px)",
          WebkitTransform: "rotateX(+=180deg) translateZ(0px)",
          overwrite: "auto",
          onComplete: () => setIsFlipped(prev => !prev)
        }, 0)
        // Swap opacity DURING the flip (not at start) to prevent double-display on iOS
        .set(front, { opacity: 0 }, ">-=" + (animationDuration * 0.5))
        .set(back, { opacity: 1 }, ">-=" + (animationDuration * 0.5));

      return timelineRef.current;
    };

    if (shouldFlip) {
      // Ensure front is visible initially before timeline starts (before delay)
      gsap.set(front, { rotationX: 0, opacity: 1 });
      gsap.set(back, { rotationX: -180, opacity: 0 });
      setIsFlipped(false);
      
      createFlipTimeline();
    } else {
      // Reset to front if flip is disabled
      gsap.set([front, back], { 
        rotationX: 0,
        force3D: true,
        transform: "rotateX(0deg) translateZ(1px)",
        WebkitTransform: "rotateX(0deg) translateZ(1px)"
      });
      gsap.set(back, { 
        rotationX: -180,
        force3D: true,
        transform: "rotateX(-180deg) translateZ(1px)",
        WebkitTransform: "rotateX(-180deg) translateZ(1px)"
      });

      setIsFlipped(false);
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [shouldFlip, flipDuration, flipDelay]);

  return (
    <div 
      ref={cardRef}
      className={`relative flex justify-start ${className}`}
      style={{
        transformStyle: "preserve-3d",
        WebkitTransformStyle: "preserve-3d",
        textAlign: "left",
        display: "flex",
        justifyContent: "flex-start",
        verticalAlign: "top",
        // iPhone 7 specific optimizations
        WebkitPerspective: "1000px",
        perspective: "1000px",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden"
      }}
    >
      {/* Front Side */}
      <div 
        ref={frontRef}
        className="w-full h-full flex items-center justify-center"
        style={{
          backfaceVisibility: "hidden",
          transformStyle: "preserve-3d",
          WebkitBackfaceVisibility: "hidden",
          WebkitTransformStyle: "preserve-3d",
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "0px"
        }}
      >
        {frontContent}
      </div>

      {/* Back Side */}
      <div 
        ref={backRef}
        className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
        style={{
          backfaceVisibility: "hidden",
          transformStyle: "preserve-3d",
          WebkitBackfaceVisibility: "hidden",
          WebkitTransformStyle: "preserve-3d",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: "rotateX(-180deg)",
          WebkitTransform: "rotateX(-180deg)",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: "0px"
        }}
      >
        {backContent}
      </div>
    </div>
  );
};

export default FlipCard;

// Add global CSS to force backface visibility hiding on mobile
const style = document.createElement('style');
style.textContent = `
  [class*="FlipCard"] * {
    -webkit-backface-visibility: hidden !important;
    backface-visibility: hidden !important;
    -webkit-transform-style: preserve-3d !important;
    transform-style: preserve-3d !important;
  }
`;
document.head.appendChild(style);
