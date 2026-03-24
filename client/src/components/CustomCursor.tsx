import React, { useState, useEffect } from 'react';

export const CustomCursor = () => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.closest('button') || 
        target.closest('a') ||
        target.classList.contains('cursor-pointer')
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <>
      <div 
        className={`fixed top-0 left-0 w-8 h-8 pointer-events-none z-[9999] transition-transform duration-100 ease-out flex items-center justify-center`}
        style={{ 
          transform: `translate(${position.x - 16}px, ${position.y - 16}px) scale(${isHovering ? 1.6 : 1}) ${isClicking ? 'scale(0.8)' : ''}`,
        }}
      >
        {/* Contrasting Core */}
        <div className={`w-3 h-3 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.9)] transition-all duration-300 ${isHovering ? 'scale-125' : ''}`} />
        
        {/* Holographic Ring */}
        <div className={`absolute inset-0 border-2 border-secondary/40 rounded-full animate-[spin_3s_linear_infinite] ${isHovering ? 'scale-110 opacity-100' : 'scale-90 opacity-50'}`} />
        <div className={`absolute inset-0 border border-primary/40 rounded-full animate-[spin_5s_linear_reverse_infinite] ${isHovering ? 'scale-125 opacity-100' : 'scale-75 opacity-30'}`} />
      </div>
      
      {/* Outer Contrast Trail */}
      <div 
        className="fixed top-0 left-0 w-[180px] h-[180px] pointer-events-none z-[9998] bg-white/[0.03] rounded-full blur-[50px] transition-transform duration-300 ease-out"
        style={{ 
          transform: `translate(${position.x - 90}px, ${position.y - 90}px)`,
        }}
      />
    </>
  );
};
