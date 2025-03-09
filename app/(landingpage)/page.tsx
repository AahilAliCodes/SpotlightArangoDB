import Link from 'next/link';
import React from 'react';
import { LogIn } from 'lucide-react';

export default function LandingPage(): React.JSX.Element {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Navigation */}
      <nav className="absolute top-0 w-full flex justify-between items-center p-6 z-10 border-b-4 border-white">
        <div className="text-5xl font-bold text-white">
          <span>Sp</span>
          <span className="relative">
            <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">o</span>
          </span>
          <span>tlight</span>
        </div>
        <Link 
          href="/sign-in"
          className="flex items-center gap-2 bg-transparent hover:bg-emerald-600 text-white px-6 py-2 rounded-lg text-2xl font-medium transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20"
        >
          <LogIn size={30} />
          Login
        </Link>
      </nav>

      {/* Main Content */}
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div 
          id="cursor-boundary"
          className="text-center space-y-6 mix-blend-difference relative"
          style={{
            cursor: 'none'
          }}
        >
          <h1 className="text-[12rem] font-bold text-white leading-none text-left tracking-tight">
            Empowering Aid,<br />Illuminating Change
          </h1>
        </div>

        {/* Custom Cursor */}
        <div 
          id="custom-cursor"
          className="pointer-events-none fixed w-[400px] h-[400px] rounded-full bg-white mix-blend-difference"
          style={{
            transform: 'translate(-50%, -50%)',
            display: 'none',
            backgroundColor: '#ffffff'
          }}
        />
      </div>

      {/* Cursor Effect Script */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.addEventListener('DOMContentLoaded', () => {
            const cursor = document.getElementById('custom-cursor');
            const boundary = document.getElementById('cursor-boundary');
            let isMouseMoving = false;
            let mouseX = 0;
            let mouseY = 0;
            let cursorX = 0;
            let cursorY = 0;

            boundary.addEventListener('mousemove', (e) => {
              const rect = boundary.getBoundingClientRect();
              isMouseMoving = true;
              
              // Calculate mouse position relative to the boundary
              mouseX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
              mouseY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
              
              // Update absolute cursor position
              cursorX = mouseX + rect.left;
              cursorY = mouseY + rect.top;
              
              cursor.style.display = 'block';
            });

            boundary.addEventListener('mouseleave', () => {
              cursor.style.display = 'none';
            });

            function updateCursor() {
              if (isMouseMoving) {
                cursor.style.left = cursorX + 'px';
                cursor.style.top = cursorY + 'px';
              }
              requestAnimationFrame(updateCursor);
            }

            updateCursor();
          });
        `
      }} />
    </div>
  );
}