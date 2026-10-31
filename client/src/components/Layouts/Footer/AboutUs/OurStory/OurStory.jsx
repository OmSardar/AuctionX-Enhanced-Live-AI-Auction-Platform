import React from "react";
import storyImageSrc from "../../../../../assets/images/FooterElements/AboutUs/our-story.png";
import fashionImageSrc from "../../../../../assets/images/FooterElements/AboutUs/our-story-innovation.jpg";

function OurStory() {
  return (
    <div className="bg-canvas text-foreground font-sans w-full min-h-screen pt-24 pb-16 overflow-y-auto transition-colors">
      {/* Our Story Section */}
      <div className="flex justify-center mb-16">
        <div className="w-full max-w-4xl px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-action-primary relative inline-block mb-10">
            Our Story
            <span className="absolute bottom-0 left-0 w-20 h-1 bg-action-primary rounded-full"></span>
          </h1>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-full md:w-1/2">
              {storyImageSrc ? (
                <img
                  src={storyImageSrc}
                  alt="Story Illustration"
                  className="w-full h-auto rounded-xl shadow-warm-lg border border-border-subtle object-cover"
                />
              ) : (
                <p className="text-foreground-muted">Image not available</p>
              )}
            </div>
            <div className="w-full md:w-1/2 text-center md:text-left">
              <p className="text-xl text-foreground font-medium mb-4">
                Our story starts with the vision of <strong>AuctionX</strong>.
              </p>
              <p className="text-base text-foreground-secondary mb-4 leading-relaxed">
                AuctionX was born to break the mold—a bold idea built around real-time competitive bidding.
                Where conventional marketplaces feel static and transactional, AuctionX introduces dynamic, transparent, and verified lot auctions.
              </p>
              <p className="text-base text-foreground-secondary leading-relaxed">
                It's not just an auction platform—it's a demonstration of modern engineering. Built on cryptographic session verification, settlement safeguards, and genuine seller integrity, every bid tells a story of architectural precision.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Section */}
      <div className="bg-surface-subtle border-y border-border-subtle py-16">
        <div className="container mx-auto text-center px-6">
          <h2 className="text-2xl md:text-3xl text-foreground leading-relaxed max-w-3xl mx-auto">
            Demonstrating engineering excellence through{" "}
            <span className="font-bold text-action-primary">concurrency safety, transparency,</span> and{" "}
            <span className="font-bold text-action-primary">settlement safeguards</span>.
          </h2>
        </div>
      </div>

      {/* Mission Statement Section */}
      <div className="container max-w-4xl mx-auto text-center my-14 px-6">
        <p className="text-lg text-foreground-secondary mb-4">
          For us, AuctionX is about showcasing full-stack capabilities at scale.
        </p>
        <p className="text-lg text-foreground-secondary mb-4">
          Established as an engineering showcase, our platform demonstrates how modern state machines and distributed architecture create optimal value.
        </p>
        <p className="text-lg text-foreground font-semibold">
          AuctionX connects enthusiasts through live bidding updates, turning every lot into an engaging demonstration of real-time software design.
        </p>
      </div>

      {/* Distinctive Platform Section */}
      <div className="my-14 px-6">
        <div className="container mx-auto text-center">
          {fashionImageSrc ? (
            <img
              src={fashionImageSrc}
              alt="Innovation Illustration"
              className="w-full max-w-5xl h-[420px] mx-auto rounded-xl shadow-warm-lg border border-border-subtle object-cover"
            />
          ) : (
            <p className="text-foreground-muted">AuctionX image not available</p>
          )}
          <h2 className="text-3xl font-bold text-foreground mt-8">
            AuctionX Platform Showcase
          </h2>
          <h3 className="text-xl font-medium text-action-primary mt-2">
            Distinctive live auction demonstration for collectors, developers, and evaluators
          </h3>
          <p className="text-base text-foreground-secondary mt-4 max-w-2xl mx-auto">
            Engineered with real-time WebSockets, verified seller authentication, structured settlement safeguards, and intelligent recommendation rankings.
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-surface border-y border-border-subtle py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="py-4">
              <h3 className="text-3xl font-bold text-action-primary mb-2">40+</h3>
              <p className="text-sm text-foreground-secondary font-medium">Product Categories</p>
            </div>
            <div className="py-4">
              <h3 className="text-3xl font-bold text-action-primary mb-2">89</h3>
              <p className="text-sm text-foreground-secondary font-medium">Documented Audits</p>
            </div>
            <div className="py-4">
              <h3 className="text-3xl font-bold text-action-primary mb-2">360+</h3>
              <p className="text-sm text-foreground-secondary font-medium">Automated Tests</p>
            </div>
            <div className="py-4">
              <h3 className="text-3xl font-bold text-action-primary mb-2">Real-Time</h3>
              <p className="text-sm text-foreground-secondary font-medium">Bid Synchronization</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OurStory;