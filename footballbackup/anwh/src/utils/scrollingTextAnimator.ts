import { gsap } from 'gsap';

export interface ScrollingTextOptions {
  container: HTMLElement;
  textElement: HTMLElement;
  text: string;
  pauseDuration?: number;
  scrollDuration?: number;
  easing?: string;
  leftOffset?: number; // Offset to account for prefix elements like markers
}

export class ScrollingTextAnimator {
  private timeline: gsap.core.Timeline | null = null;
  private options: ScrollingTextOptions & { pauseDuration: number; scrollDuration: number; easing: string; leftOffset: number };
  private isPaused: boolean = false;
  private scrollTimeout: NodeJS.Timeout | null = null;

  constructor(options: ScrollingTextOptions) {
    this.options = {
      pauseDuration: 1,
      scrollDuration: 2.5,
      easing: 'power2.inOut',
      leftOffset: 0,
      ...options
    };
  }

  pause(): void {
    if (this.timeline && !this.isPaused) {
      this.timeline.pause();
      this.isPaused = true;
    }
  }

  resume(): void {
    if (this.timeline && this.isPaused) {
      this.timeline.resume();
      this.isPaused = false;
    }
  }

  handleScrollStart(): void {
    this.pause();
    
    // Clear any existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // Set timeout to resume after scroll stops
    this.scrollTimeout = setTimeout(() => {
      this.resume();
      this.scrollTimeout = null;
    }, 150); // Resume 150ms after scroll stops
  }

  start(): void {
    this.stop(); // Clear any existing animation
    
    const { container, textElement, pauseDuration, scrollDuration, easing, leftOffset = 0 } = this.options;
    
    // Reset position
    gsap.set(textElement, { x: 0 });
    
    // Force layout recalculation
    container.offsetWidth;
    textElement.offsetWidth;
    
    const containerWidth = container.offsetWidth;
    const textWidth = textElement.scrollWidth;
    
    // Calculate effective container width (accounting for prefix offset)
    const effectiveContainerWidth = containerWidth - leftOffset;
    
    if (textWidth <= effectiveContainerWidth) {
      return;
    }
    
    // Calculate scroll distance with offset consideration
    const scrollDistance = textWidth - effectiveContainerWidth;
    
    // Create TweenMax timeline for longer text with spaces
    this.timeline = gsap.timeline({ 
      repeat: -1,
      ease: easing
    });
    
    // Enhanced animation sequence for better readability
    this.timeline
      // Initial pause at start (longer for reading)
      .to(textElement, {
        duration: pauseDuration,
        x: 0,
        ease: 'none'
      })
      // Smooth scroll to end (slower for longer text)
      .to(textElement, {
        duration: scrollDuration,
        x: -scrollDistance,
        ease: easing
      })
      // Pause at end (longer for reading end of text)
      .to(textElement, {
        duration: pauseDuration,
        x: -scrollDistance,
        ease: 'none'
      })
      // Smooth scroll back to start
      .to(textElement, {
        duration: scrollDuration,
        x: 0,
        ease: easing
      });
    
  }

  stop(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }

  updateText(newText: string): void {
    this.options.text = newText;
    this.start(); // Restart animation with new text
  }

  // Static method for quick setup
  static create(options: ScrollingTextOptions): ScrollingTextAnimator {
    const animator = new ScrollingTextAnimator(options);
    animator.start();
    return animator;
  }
}