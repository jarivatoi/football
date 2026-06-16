import React, { useRef, useEffect, useState } from 'react';
import { ScrollingTextAnimator } from '../utils/scrollingTextAnimator';

interface ScrollingTextProps {
  text?: string;
  className?: string;
  children?: React.ReactNode;
  pauseDuration?: number;
  scrollDuration?: number;
  easing?: string;
  onReset?: () => void; // Callback when animation is reset
  style?: React.CSSProperties; // Optional inline styles
  leftOffset?: number; // Offset in pixels to compensate for elements like markers
}

export const ScrollingText: React.FC<ScrollingTextProps> = ({ 
  text, 
  className = '', 
  children,
  pauseDuration = 1.5,
  scrollDuration = 3,
  easing = 'power2.inOut',
  onReset,
  style,
  leftOffset = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [needsScrolling, setNeedsScrolling] = useState(false);
  const animatorRef = useRef<ScrollingTextAnimator | null>(null);
  const scrollListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let animationFrameId: number | null = null;
    
    const checkAndAnimate = () => {
      if (!containerRef.current || !textRef.current) return;

      const container = containerRef.current;
      const textElement = textRef.current;
      
      // Ensure initial state is set correctly
      textElement.style.willChange = 'transform';
      
      // Stop any existing animation
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
      
      // Remove existing scroll listener
      if (scrollListenerRef.current) {
        window.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        document.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        scrollListenerRef.current = null;
      }
      
      // Force layout recalculation
      container.offsetWidth;
      textElement.offsetWidth;
      
      // Get actual container width (without offset for animator calculations)
      const actualContainerWidth = container.offsetWidth;
      // Reduced width for overflow detection (accounts for prefix like asterisk)
      const effectiveContainerWidth = actualContainerWidth - leftOffset;
      const textWidth = textElement.scrollWidth;
      
      const currentText = text || 'children content';
      const hasSpaces = currentText.includes(' ');
      const isLongText = currentText.length > 30;
      
      // Only log if actually needs scrolling (reduce console spam)
      const shouldLog = textWidth > effectiveContainerWidth;
      if (shouldLog) {
        // Logging removed to reduce console output
      }
      
      if (textWidth > effectiveContainerWidth) {
        setNeedsScrolling(true);
        
        // Use enhanced timing for longer text with spaces
        const enhancedPauseDuration = (hasSpaces && isLongText) ? pauseDuration + 1 : pauseDuration;
        const enhancedScrollDuration = (hasSpaces && isLongText) ? scrollDuration + 1 : scrollDuration;
        const enhancedEasing = (hasSpaces && isLongText) ? 'power1.inOut' : easing;
        
        // Create animator with leftOffset to account for prefix elements
        animatorRef.current = ScrollingTextAnimator.create({
          container,
          textElement,
          text: currentText,
          pauseDuration: enhancedPauseDuration,
          scrollDuration: enhancedScrollDuration,
          easing: enhancedEasing,
          leftOffset: leftOffset  // Pass offset to account for markers/prefixes
        });
        
        // Add scroll detection
        const handleScroll = () => {
          if (animatorRef.current) {
            animatorRef.current!.handleScrollStart();
          }
        };
        
        // Listen to both window and document scroll events
        window.addEventListener('scroll', handleScroll, { passive: true });
        document.addEventListener('scroll', handleScroll, { passive: true });
        
        // Also listen to scroll events on scrollable parents
        let parent = container.parentElement;
        while (parent) {
          if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
            parent.addEventListener('scroll', handleScroll, { passive: true });
          }
          parent = parent.parentElement;
        }
        
        scrollListenerRef.current = handleScroll;
      } else {
        setNeedsScrolling(false);
        
        // Smoothly reset the text position to the left when text no longer overflows
        if (textElement.style.transform !== 'translateX(0px)') {
          textElement.style.transition = 'transform 0.3s ease-out';
          textElement.style.transform = 'translateX(0px)';
          
          // Remove transition after animation completes
          timeoutId = setTimeout(() => {
            textElement.style.transition = '';
            // Notify that reset occurred
            if (onReset) {
              onReset();
            }
          }, 300);
        }
        
        // Stop any existing animation
        if (animatorRef.current) {
          (animatorRef.current as ScrollingTextAnimator).stop();
          animatorRef.current = null;
        }
      }
    };

    // Initial check with delay to ensure DOM is ready
    timeoutId = setTimeout(checkAndAnimate, 50);
    
    // Recheck on window resize with debounce
    let resizeTimeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(checkAndAnimate, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Recheck when content changes with smarter handling for add/remove scenarios
    const observer = new MutationObserver((mutations) => {
      // Clear any existing timeout to debounce multiple rapid changes
      clearTimeout(timeoutId);
      
      // Detect if this is likely an add/remove item scenario
      const isContentChange = mutations.some(mutation => 
        mutation.type === 'childList' || 
        mutation.type === 'characterData'
      );
      
      if (isContentChange) {
        // When content changes (add/remove items), smoothly reset and restart
        if (animatorRef.current) {
          (animatorRef.current as ScrollingTextAnimator).stop();
          animatorRef.current = null;
        }
        
        // Smoothly reset transform to initial state for clean restart
        if (textRef.current) {
          // Use CSS transition for smooth reset
          textRef.current.style.transition = 'transform 0.2s ease-out';
          textRef.current.style.transform = 'translateX(0px)';
          
          // Remove transition after animation completes
          timeoutId = setTimeout(() => {
            if (textRef.current) {
              textRef.current.style.transition = '';
            }
            // Notify that reset occurred
            if (onReset) {
              onReset();
            }
          }, 200);
        }
        
        // Restart animation after a brief delay to handle rapid updates
        timeoutId = setTimeout(checkAndAnimate, 300);
      }
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    
    return () => {
      clearTimeout(timeoutId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      
      // Clean up scroll listener
      if (scrollListenerRef.current) {
        window.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        document.removeEventListener('scroll', scrollListenerRef.current, { passive: true } as any);
        scrollListenerRef.current = null;
      }
      
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, [text, pauseDuration, scrollDuration, easing]); // Removed children from dependencies

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      // Clean up scroll listener on unmount
      if (scrollListenerRef.current) {
        // Remove the filtered scroll handler
        const filteredScrollHandler = scrollListenerRef.current;
        window.removeEventListener('scroll', filteredScrollHandler as any, { passive: true } as any);
        
        // Remove scroll listeners from parent elements
        let parent = containerRef.current?.parentElement;
        while (parent && parent !== document.body) {
          parent.removeEventListener('scroll', scrollListenerRef.current as any, { passive: true } as any);
          parent = parent.parentElement;
        }
        
        scrollListenerRef.current = null;
      }
      
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`w-full ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden', // Contain text within parent boundaries
        minWidth: 0, // Allow container to shrink on small screens
        ...style // Merge custom styles (including responsive fontSize)
      }}
    >
      <div 
        ref={textRef}
        className="whitespace-nowrap"
        style={{
          display: 'inline-block',
          minWidth: '100%',
          maxWidth: 'none',
          overflow: 'visible', // Allow text to expand for proper measurement
          textOverflow: 'clip', // Don't show ellipsis, let it overflow for measurement
          lineHeight: 1.2, // Better line height for small screens
          ...style // Merge custom styles
        }}
      >
        {children || text}
      </div>
    </div>
  );
};