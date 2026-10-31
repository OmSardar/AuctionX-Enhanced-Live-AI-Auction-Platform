import React from "react";

const specialties = [
  {
    name: "Fine Art & Sculpture",
    category: "Visual Arts",
    href: "#fine-art",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    name: "Haute Horlogerie",
    category: "Timepieces",
    href: "#horology",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="7" />
        <polyline points="12 9 12 12 14 14" />
        <path d="M12 5V2M12 22v-3M16.2 3.8l-1.5 2.6M9.3 17.6l-1.5 2.6M19.8 8.8l-2.6 1.5M6.8 13.7l-2.6 1.5" />
      </svg>
    ),
  },
  {
    name: "Sports Memorabilia",
    category: "Historic Relics",
    href: "#sports",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
        <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-6 6h0a6 6 0 0 1-6-6V6a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    name: "Rare Coins & Medals",
    category: "Numismatics",
    href: "#numismatics",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" strokeDasharray="3 2" />
        <path d="M12 9v6M9.5 10.5h5" />
      </svg>
    ),
  },
  {
    name: "Fine Jewelry & Gems",
    category: "Haute Joaillerie",
    href: "#jewelry",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
        <path d="M2 9h20M10 3l2 6-2 12M14 3l-2 6 2 12" />
      </svg>
    ),
  },
  {
    name: "Ancient Antiquities",
    category: "Artifacts",
    href: "#antiquities",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2h8M9 2v4M15 2v4M6 6h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6z" />
        <path d="M6 10c-2 0-3 1.5-3 3s1.5 3 3 3M18 10c2 0 3 1.5 3 3s-1.5 3-3 3" />
      </svg>
    ),
  },
  {
    name: "Classic Automobilia",
    category: "Motor Heritage",
    href: "#automobilia",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      </svg>
    ),
  },
  {
    name: "Rare Books & Manuscripts",
    category: "Literature",
    href: "#literature",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    name: "Championship Trophies",
    category: "Historic Honors",
    href: "#trophies",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
        <path d="M7 6H4a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1M17 6h3a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1" />
      </svg>
    ),
  },
  {
    name: "Curated Relics",
    category: "Special Editions",
    href: "#curated",
    icon: (
      <svg className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

const SmoothHovering = () => {
  return (
    <div className="py-20 transition-all duration-500 bg-canvas border-y border-border/40">
      {/* Header */}
      <div className="pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-display mb-4 transition-colors duration-300 text-espresso">
          Discover Auction Specialties
        </h1>
        <p className="text-lg md:text-xl transition-colors duration-300 text-text-secondary">
          Explore verified auction lots across our premier specialty departments
        </p>
      </div>

      {/* Specialty Grid */}
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
          {specialties.map((item, index) => (
            <a
              key={item.name}
              href={item.href}
              className="group relative block p-8 rounded-2xl transition-all duration-500 ease-out transform hover:scale-105 hover:-translate-y-1.5 bg-surface hover:bg-surface-elevated shadow-warm-sm hover:shadow-warm-lg backdrop-blur-sm border border-border/60 hover:border-primary/40"
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-primary/10 to-secondary/15" />

              {/* Specialty Content Container */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-warm-xs group-hover:bg-primary group-hover:shadow-warm-md transition-all duration-500 group-hover:scale-110">
                  {item.icon}
                </div>

                {/* Specialty Name */}
                <h3 className="text-sm font-semibold text-center transition-all duration-300 group-hover:text-base text-espresso group-hover:text-primary">
                  {item.name}
                </h3>

                {/* Category Badge */}
                <span className="mt-2 px-3 py-1 text-xs rounded-full font-medium transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 bg-sand/30 text-espresso">
                  {item.category}
                </span>
              </div>

              {/* Animated Border */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"
                style={{
                  background: "linear-gradient(45deg, #C65D3A, #D4A373, #7F3828)",
                  backgroundSize: "200% 200%",
                  animation: "gradient 3s ease infinite",
                  padding: "2px",
                  zIndex: -1,
                }}
              >
                <div className="w-full h-full rounded-2xl bg-surface" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center">
        <p className="text-sm transition-colors duration-300 text-text-muted">
          Click on any specialty to explore curated live auctions
        </p>
      </div>

      <style jsx>{`
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
};

export default SmoothHovering;