import React, { useState, useEffect } from "react";

const EntryLoader = ({ onFinish }) => {
  const [showFirstText, setShowFirstText] = useState(true);
  const [showSecondText, setShowSecondText] = useState(false);

  useEffect(() => {
    const firstTextTimeout = setTimeout(() => {
      setShowFirstText(false);
      setShowSecondText(true);
    }, 2000);

    const finishTimeout = setTimeout(() => {
      onFinish();
    }, 4000);

    return () => {
      clearTimeout(firstTextTimeout);
      clearTimeout(finishTimeout);
    };
  }, [onFinish]);

  return (
    <div className="fixed top-0 left-0 w-screen h-screen flex justify-center items-center bg-white overflow-hidden z-50">
      {/* First "Auction X" with blinking animation */}
      {showFirstText && (
        <div className="text-black text-7xl font-bold animate-pulse">
          Auction X
        </div>
      )}

      {/* Second "Auction X" with zoom-in animation */}
      {showSecondText && (
        <div className="flex gap-3">
          {["A", "u", "c", "t", "i", "o", "n", " ", "X"].map(
            (letter, index) => (
              <div
                key={index}
                className="text-7xl font-bold text-black zoom-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {letter}
              </div>
            )
          )}
        </div>
      )}

      {/* Inline CSS without 'jsx' */}
      <style>
        {`
          @keyframes pulse {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
            100% {
              opacity: 1;
            }
          }

          @keyframes zoomIn {
            0% {
              transform: scale(0);
              opacity: 0;
            }
            100% {
              transform: scale(1.5);
              opacity: 1;
            }
          }

          .animate-pulse {
            animation: pulse 1.5s infinite ease-in-out;
          }

          .zoom-in {
            animation: zoomIn 0.5s ease-out forwards;
            transform-origin: center;
          }
        `}
      </style>
    </div>
  );
};

export default EntryLoader;