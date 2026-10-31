import React from "react";
import { useState, useEffect } from "react";

const LoadingSpinner = () => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 15) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="relative">
        {/* Outer spinning circle */}
        <div
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
          style={{ transform: `rotate(${rotation}deg)` }}
        ></div>

        {/* Inner spinning circle (opposite direction) */}
        <div
          className="absolute top-2 left-2 w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full"
          style={{ transform: `rotate(${-rotation * 1.5}deg)` }}
        ></div>

        {/* MERN letters */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs font-bold text-white flex space-x-1">
            <span className="text-blue-500">A</span>
            <span className="text-green-500">U</span>
            <span className="text-yellow-500">C</span>
            <span className="text-red-500">T</span>
            <span className="text-blue-500">I</span>
            <span className="text-green-500">O</span>
            <span className="text-blue-500">N</span>
            <span className="text-green-500">X</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
