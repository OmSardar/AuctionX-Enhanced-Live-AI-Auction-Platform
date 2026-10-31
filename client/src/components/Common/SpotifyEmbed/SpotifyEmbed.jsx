import React, { useState } from 'react';

const SpotifyEmbed = () => {
  // State to track auto-play setting
  const [autoPlay, setAutoPlay] = useState(true);
  // Key to force iframe refresh when toggling autoplay
  const [iframeKey, setIframeKey] = useState(0);
  
  // Toggle auto-play and refresh iframe
  const toggleAutoPlay = () => {
    setAutoPlay(!autoPlay);
    setIframeKey(prevKey => prevKey + 1);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-gray-900 rounded-lg shadow-xl">
      {/* Title and autoplay toggle */}
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold text-green-400">Spotify Playlist Player</h2>
        <p className="text-gray-400">Full Playlist Experience</p>
        <div className="mt-2 flex items-center justify-center">
          <span className="text-gray-400 mr-2">Auto-play:</span>
          <button 
            onClick={toggleAutoPlay}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${autoPlay ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            {autoPlay ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      
      {/* Playlist iframe with shadow */}
      <div className="shadow-lg rounded-lg overflow-hidden">
        <iframe
          key={iframeKey}
          style={{ borderRadius: "12px" }}
          src={`https://open.spotify.com/embed/playlist/5WToK4EWSLTg7V5lYZQEUX?utm_source=generator${autoPlay ? '&autoplay=1' : ''}&theme=0`}
          width="100%"
          height="352"
          frameBorder="0"
          allowFullScreen=""
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        ></iframe>
      </div>
      
      {/* Playlist info */}
      <div className="mt-4 text-center">
        <div className="bg-gray-800 rounded-full px-4 py-2 text-sm text-gray-300 inline-block">
          🎵 Full playlist with native Spotify controls
        </div>
      </div>
      
      {/* Features info */}
      <div className="mt-4 bg-gray-800 rounded-lg p-4">
        <h3 className="text-green-400 font-semibold mb-2">Features:</h3>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• Native Spotify playlist navigation</li>
          <li>• Shuffle and repeat controls</li>
          <li>• Full track information display</li>
          <li>• Seamless track transitions</li>
        </ul>
      </div>
    </div>
  );
};

export default SpotifyEmbed;