import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SpotifyEmbed from "../../../SpotifyEmbed/SpotifyEmbed";
import axios from "axios";
import { formatCurrency } from "../../../../../lib/utils";
import { toast } from "react-hot-toast";

const FanbookPage = () => {
  const navigate = useNavigate();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [activeTab, setActiveTab] = useState("featured");
  const [scrollPosition, setScrollPosition] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;

  // Sample playlist data (keeping as is per your request)
  const playlists = [
    {
      id: 1,
      name: "Auction X Store Vibes",
      description: "The soundtrack to our physical stores",
      image: "/store-playlist-cover.svg",
      songs: [
        { title: "Retro Wave", artist: "Neon Dreams" },
        { title: "Urban Pulse", artist: "City Lights" },
        { title: "Vintage Groove", artist: "The Collectors" },
      ],
    },
    {
      id: 2,
      name: "New Collection Energy",
      description: "Tracks that inspired our latest designs",
      image: "/store-playlist-cover.svg",
      songs: [
        { title: "Fashion Forward", artist: "Trend Setters" },
        { title: "Runway Ready", artist: "Model Behavior" },
        { title: "Design Process", artist: "Creative Flow" },
      ],
    },
  ];

  // Fetch products from the API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/goodies/`);

        // Transform the backend data to match our component's expected format
        const transformedProducts = response.data.map((item) => ({
          id: item._id,
          name: item.name,
          price: formatCurrency(item.price),
          description: item.description,
          image:
            item.images[0] || "/lot-placeholder.svg", // Use first image or fallback
          trending: item.stock < 10, // Assume low stock items are trending
          category: item.category.toLowerCase(),
        }));

        setProducts(transformedProducts);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError("Failed to load products. Please try again later.");
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredProducts =
    activeTab === "featured"
      ? products
      : activeTab === "trending"
      ? products.filter((product) => product.trending)
      : products.filter((product) => product.category === activeTab);

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      {/* Header */}
      <header
        className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md shadow-warm-xs border-b border-border transition-all duration-300"
        style={{
          height: scrollPosition > 100 ? "60px" : "80px",
          opacity: scrollPosition > 500 ? 0.95 : 1,
        }}
      >
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold font-display text-primary">
              Auction X
            </h1>
            <span className="ml-2 text-lg font-light text-muted-foreground">
              Fanbook
            </span>
          </div>
          <nav className="hidden md:flex space-x-6">
            <a
              href="#products"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              T-Shirts
            </a>
            <a
              href="#music"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              Music
            </a>
            <a
              href="#about"
              className="text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              About
            </a>
          </nav>
          <div className="flex items-center space-x-4">
            <button className="rounded-full bg-canvas-subtle p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
            <button className="rounded-full bg-canvas-subtle p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-96 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-espresso/80 via-primary-950/70 to-espresso/80 z-10"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/api/placeholder/1200/600"
            alt="Collection Cover"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white text-center px-4">
          <h2
            className="text-4xl md:text-6xl font-bold font-display mb-4"
            style={{
              transform: `translateY(-${scrollPosition * 0.2}px)`,
              opacity: 1 - scrollPosition * 0.003,
            }}
          >
            Spring Collection 2025
          </h2>
          <p
            className="text-xl md:text-2xl max-w-2xl text-sand font-medium"
            style={{
              transform: `translateY(-${scrollPosition * 0.1}px)`,
              opacity: 1 - scrollPosition * 0.003,
            }}
          >
            Explore our latest T-shirt designs while listening to curated
            playlists
          </p>
          <button className="mt-8 px-8 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-full shadow-warm-md transition-all transform hover:scale-105 cursor-pointer">
            Shop Now
          </button>
        </div>
      </section>

      {/* T-shirt Collection */}
      <section id="products" className="py-16 bg-canvas">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold font-display text-center mb-12 text-foreground">
            Our T-Shirt Collection
          </h2>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center mb-12 space-x-2 space-y-2 md:space-y-0">
            {["featured", "trending", "graphic", "streetwear"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-full capitalize font-semibold transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-primary text-white shadow-warm-xs"
                    : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Loading and Error States */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-center max-w-md mx-auto font-medium">
              {error}
            </div>
          )}

          {/* Products Grid */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-surface rounded-2xl overflow-hidden shadow-warm-xs hover:shadow-warm-md border border-border hover:border-primary/40 transition-all duration-300 group"
                  >
                    <div className="h-80 overflow-hidden bg-canvas-subtle">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/api/placeholder/400/400";
                        }}
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold font-display text-foreground">
                          {product.name}
                        </h3>
                        <span className="text-lg font-bold text-primary">
                          {product.price}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium shadow-warm-xs transition-colors cursor-pointer text-sm">
                          Add to Cart
                        </button>
                        {product.trending && (
                          <span className="px-3 py-1 bg-accent/15 text-accent-dark border border-accent/25 rounded-full text-xs font-bold">
                            Trending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-10">
                  <p className="text-muted-foreground font-medium">
                    No products found in this category.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Music Section - SpotifyEmbedded Component */}
      <section
        id="music"
        className="py-16 bg-canvas border-t border-border"
      >
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold font-display text-center mb-12 text-foreground">
            Our Soundtrack
          </h2>
          <div className="mb-10">
            <SpotifyEmbed />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-surface rounded-2xl border border-border overflow-hidden shadow-warm-xs"
              >
                <div className="p-6 flex space-x-4">
                  <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0">
                    <img
                      src={playlist.image}
                      alt={playlist.name}
                      className="w-full h-full object-cover rounded-xl shadow-warm-xs"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/api/placeholder/128/128";
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold font-display mb-2 text-foreground">
                      {playlist.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {playlist.description}
                    </p>

                    <div className="space-y-2">
                      {playlist.songs.map((song, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-2 hover:bg-canvas-subtle rounded-xl transition-colors cursor-pointer"
                        >
                          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer shadow-warm-xs">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                          </button>
                          <div>
                            <p className="font-semibold text-sm text-foreground">
                              {song.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {song.artist}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground text-sm mb-4 font-medium">
              Follow our complete playlists on Spotify
            </p>
            <a
              href="https://open.spotify.com/playlist/5WToK4EWSLTg7V5lYZQEUX?si=YEs8LFAzR-ONbJENBiQ3uA"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="px-6 py-3 bg-action-primary hover:bg-action-primary-hover text-white font-semibold rounded-lg shadow-warm-xs transition-colors cursor-pointer text-sm">
                Follow on Spotify
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 bg-canvas border-t border-border-subtle">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center bg-surface border border-border-subtle rounded-2xl p-8 shadow-warm-xs">
            <h2 className="text-3xl font-bold font-display mb-4 text-foreground">
              About Auction X
            </h2>
            <p className="text-base text-muted leading-relaxed mb-8 max-w-2xl mx-auto">
              Auction X is more than just a marketplace. We're a lifestyle, a
              movement, a community of creative individuals who express
              themselves through curated items, fashion and music. Our designs are inspired by
              the rhythm and spirit of collecting.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button 
                type="button"
                onClick={() => navigate("/our-story")}
                className="px-6 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors cursor-pointer"
              >
                Our Story
              </button>
              <button 
                type="button"
                onClick={() => navigate("/contact")}
                className="px-6 py-2.5 border border-border-subtle bg-surface hover:bg-surface-subtle text-foreground font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-12 bg-surface-subtle border-t border-border-subtle">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-surface border border-border-subtle rounded-2xl p-8 shadow-warm-xs">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="md:w-1/2">
                <h3 className="text-2xl font-bold font-display mb-2 text-foreground">
                  Stay in the Loop
                </h3>
                <p className="text-muted text-sm">
                  Subscribe to our newsletter for exclusive offers, new
                  releases, and playlists.
                </p>
              </div>
              <div className="md:w-1/2 w-full">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newsletterEmail || !newsletterEmail.includes("@")) {
                      toast.error("Please enter a valid email address.");
                      return;
                    }
                    toast.success("Thank you for subscribing to the Auction X Fanbook newsletter!");
                    setNewsletterEmail("");
                  }}
                  className="flex"
                >
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="flex-1 px-4 py-2.5 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-action-primary/20 bg-surface text-foreground placeholder:text-muted border border-border-subtle text-sm"
                  />
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-r-lg transition-colors cursor-pointer shadow-warm-xs"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FanbookPage;
