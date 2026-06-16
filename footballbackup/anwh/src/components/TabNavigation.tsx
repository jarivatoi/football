import React, { useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { Calendar, Settings, Database, Server, User } from 'lucide-react';

interface Tab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: 'calendar' | 'settings' | 'data' | 'roster' | 'profile') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  // Add CSS animations for icons
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes iconPulse {
        0%, 100% {
          transform: scale(1);
          opacity: 0.7;
        }
        50% {
          transform: scale(1.05);
          opacity: 1;
        }
      }
      
      @keyframes iconBounce {
        0%, 20%, 50%, 80%, 100% {
          transform: translateY(0);
        }
        40% {
          transform: translateY(-2px);
        }
        60% {
          transform: translateY(-1px);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [localActiveTab, setLocalActiveTab] = useState<string>(activeTab);
  
  // Update local state when prop changes
  useEffect(() => {
    setLocalActiveTab(activeTab);
  }, [activeTab]);
  
  const handleTabClick = (tabId: 'calendar' | 'settings' | 'data' | 'roster' | 'profile') => {
    // Always allow tab changes for instant responsiveness
    if (tabId === localActiveTab) return;
    
    // Add click animation to the clicked tab icon
    const clickedTabButton = document.querySelector(`[data-tab-id="${tabId}"] .tab-icon`);
    if (clickedTabButton) {
      gsap.to(clickedTabButton, {
        scale: 1.2,
        duration: 0.15,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        force3D: true
      });
    }
    
    // Animate background transition
    const background = document.querySelector('.tab-background');
    if (background) {
      gsap.to(background, {
        scale: 0.95,
        opacity: 0.7,
        duration: 0.1,
        ease: "power2.out",
        force3D: true,
        onComplete: () => {
          // Update state after brief animation
          setLocalActiveTab(tabId);
          
          // Animate background back
          gsap.to(background, {
            scale: 1,
            opacity: 1,
            duration: 0.2,
            ease: "power2.out",
            force3D: true
          });
        }
      });
    } else {
      // Fallback if background not found
      setLocalActiveTab(tabId);
    }
    
    // Call parent handler with slight delay for smoother UX
    // Remove delay for instant response
    onTabChange(tabId);
  };
  
  const handleTouchStart = (tabId: 'calendar' | 'settings' | 'data' | 'roster' | 'profile') => {
    // Always allow tab changes for instant responsiveness
    if (tabId === localActiveTab) return;
    
    // Mobile-optimized touch animation
    const touchedTabButton = document.querySelector(`[data-tab-id="${tabId}"] .tab-icon`);
    if (touchedTabButton) {
      gsap.to(touchedTabButton, {
        scale: 1.15,
        duration: 0.1,
        ease: "power2.out",
        force3D: true,
        onComplete: () => {
          gsap.to(touchedTabButton, {
            scale: 1,
            duration: 0.15,
            ease: "power2.out",
            force3D: true
          });
        }
      });
    }
    
    // Update state immediately for mobile responsiveness
    setLocalActiveTab(tabId);
    onTabChange(tabId);
  };
  
const tabs: Tab[] = [
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'data', icon: Database, label: 'Data' },
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'roster', icon: Server, label: 'Roster' }
];

  const getTabIndex = (tabId: string) => tabs.findIndex(tab => tab.id === tabId);
  const activeIndex = getTabIndex(activeTab);
  
  // Show background only for active tab
  const backgroundIndex = activeIndex;
  const showBackground = backgroundIndex !== -1;

  return (
    <div className="w-full">
      <div className="relative bg-white/90 backdrop-blur-md shadow-lg border-b border-gray-200/50 p-2 w-full">
        {/* Tab buttons container */}
        <div className="relative grid grid-cols-5 w-full">
          {/* Single background that moves between tabs */}
          {showBackground && (
            <div 
              className="tab-background absolute inset-y-0 bg-blue-500/10 rounded-xl transition-all duration-300 ease-out"
              style={{
                width: 'calc(20% - 8px)',
                left: `calc(${backgroundIndex * 20}% + 4px)`,
                top: '0px',
                bottom: '0px'
              }}
            />
          )}
          
          {/* Top indicator line - only for active tab */}
          {activeIndex !== -1 && (
            <div 
              className="absolute top-1 h-0.5 bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{
                width: 'calc(20% - 48px)',
                left: `calc(${activeIndex * 20}% + 24px)`
              }}
            />
          )}

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            const isHovered = hoveredTab === tab.id;
            const showText = isActive || isHovered;
            
            return (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => handleTabClick(tab.id as 'calendar' | 'settings' | 'data' | 'roster' | 'profile')}
                onTouchStart={() => handleTouchStart(tab.id as 'calendar' | 'settings' | 'data' | 'roster' | 'profile')}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className="relative h-14 flex flex-col items-center justify-center transition-all duration-200 rounded-xl overflow-hidden px-2"
                style={{
                  // Critical: Fix touch events for mobile
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                {/* Container for icon and text - vertical layout */}
                <div className="flex flex-col items-center justify-center w-full h-full transition-all duration-300">
                  {/* Icon - always visible */}
                  <Icon 
                    className={`tab-icon w-5 h-5 transition-all duration-300 flex-shrink-0 hover:scale-[1.4] active:scale-95 ${
                      isActive ? 'text-blue-600' : isHovered ? 'text-blue-500' : 'text-gray-600'
                    }`}
                  />
                  
                  <span 
                      className={`text-[10px] font-medium mt-0.5 transition-all duration-300 ${
                        isActive || isHovered ? 'opacity-100' : 'opacity-70'
                      } ${
                        isActive ? 'text-blue-600' : isHovered ? 'text-blue-500' : 'text-gray-600'
                      }`}
                    >
                      {tab.label}
                    </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;