import React, { useEffect, useRef } from "react";

const BackgroundAnimated = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let lines = [];
    const lineCount = 10;
    const waveHeight = 30;
    const waveWidth = window.innerWidth;
    const speed = 0.005;
    let animationProgress = 3;

    const waveConfig = {
      verticalOffset: 200,
      verticalSpread: 100,
      centeringFactor: 0.5,
    };

    function initializeWaves() {
      lines = [];
      for (let i = 0; i < lineCount; i++) {
        const baseVerticalOffset =
          (i - (lineCount - 1) * waveConfig.centeringFactor) *
          waveConfig.verticalSpread;

        lines.push({
          frequency: 0.015 + i * 0.005,
          amplitude: waveHeight - i * 10,
          phase: (i * Math.PI) / 200,
          verticalOffset: baseVerticalOffset + waveConfig.verticalOffset,
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationProgress += speed;

      lines.forEach((line, index) => {
        const gradient = ctx.createLinearGradient(0, 0, waveWidth, 0);
        gradient.addColorStop(0, `rgba(198, 93, 58, ${0.7 - index * 0.08})`);
        gradient.addColorStop(1, `rgba(212, 163, 115, ${0.15 - index * 0.02})`);

        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = gradient;

        for (let x = 0; x <= waveWidth; x += 2) {
          const mergeMultiplier = 1 - (x / waveWidth) * 0.8;
          const yOffset =
            line.verticalOffset * mergeMultiplier * (x / waveWidth);
          const y =
            canvas.height / 2 +
            yOffset +
            Math.sin(x * line.frequency + animationProgress + line.phase) *
              (line.amplitude * mergeMultiplier);

          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      requestAnimationFrame(animate);
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initializeWaves();
    }

    function initWaveAnimation() {
      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();
      animate();
    }

    initWaveAnimation();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div className="bg-espresso text-canvas relative min-h-[550px] overflow-hidden border-y border-sand/20">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-70 z-0"
      />

      <div className="relative max-w-full mx-auto z-20 container mx-auto px-6 lg:px-12 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="flex items-center space-x-4 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={48}
                height={48}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-secondary opacity-90"
              >
                <rect x={2} y={2} width={20} height={8} rx={2} ry={2} />
                <rect x={2} y={14} width={20} height={8} rx={2} ry={2} />
                <line x1={6} y1={6} x2="6.01" y2={6} />
                <line x1={6} y1={18} x2="6.01" y2={18} />
              </svg>
              <h2 className="text-xl font-mono text-sand tracking-widest uppercase">
                Enterprise Auction Technology
              </h2>
            </div>

            <h1 className="text-4xl xl:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-canvas via-sand to-secondary font-display">
              Real-Time Bidding Infrastructure
            </h1>

            <p className="text-lg text-sand/80 leading-relaxed max-w-xl">
              High-frequency WebSocket auction mechanics with sub-millisecond bidding precision, automated reserve enforcement, and cryptographic authenticity verification.
            </p>

            <div className="flex space-x-4 pt-6">
              <button className="group relative px-8 py-3.5 rounded-full bg-primary hover:bg-primary-600 text-white font-medium shadow-warm-md hover:shadow-warm-lg transition-all duration-300 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="mr-2 group-hover:animate-pulse"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Launch Auction
                <div className="absolute inset-0 rounded-full border-2 border-primary-300/40 animate-ping group-hover:opacity-0 transition-opacity" />
              </button>

              <button className="border border-sand/30 hover:bg-sand/15 text-canvas px-8 py-3.5 rounded-full transition-all font-medium flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="mr-2"
                >
                  <rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Learn Architecture
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackgroundAnimated;
