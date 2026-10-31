import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const PageNotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas text-foreground flex items-center justify-center px-4 py-16 transition-colors mt-12">
      <div className="max-w-4xl w-full bg-surface border border-border-subtle rounded-2xl shadow-warm-lg overflow-hidden flex flex-col md:flex-row">
        {/* Left visual section */}
        <div className="md:w-2/5 bg-surface-dark p-8 md:p-10 flex flex-col justify-between text-foreground-inverse">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-action-primary/20 text-action-primary border border-action-primary/30 rounded-lg flex items-center justify-center font-bold">
              AX
            </div>
            <span className="ml-3 text-foreground-inverse font-semibold text-xl tracking-tight font-display">
              Auction X
            </span>
          </div>
          
          <div className="my-10 md:my-0">
            <span className="text-xs uppercase tracking-wider font-semibold text-action-primary block mb-2">
              Error 404
            </span>
            <h1 className="text-foreground-inverse text-6xl md:text-7xl font-bold tracking-tighter tabular-nums font-display">
              404
            </h1>
            <div className="h-1 w-16 bg-action-primary rounded-full mt-4" />
          </div>
          
          <div className="text-muted text-xs">
            &copy; {new Date().getFullYear()} Auction X Marketplace.
            <br />All rights reserved.
          </div>
        </div>
        
        {/* Right content section */}
        <div className="md:w-3/5 p-8 md:p-12 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
              Page Not Found
            </h2>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              We couldn't find the page you're looking for. The auction listing may have ended, been removed by the seller, or the URL may be mistyped.
            </p>
            
            <div className="mt-8 space-y-3">
              <Button 
                variant="primary" 
                size="md" 
                className="w-full justify-center py-2.5 rounded-lg"
                onClick={() => navigate('/')}
              >
                Return to Homepage
              </Button>
              
              <Button 
                variant="outline" 
                size="md" 
                className="w-full justify-center py-2.5 rounded-lg"
                onClick={() => navigate('/bid')}
              >
                Browse Active Auctions
              </Button>
              
              <Button 
                variant="secondary" 
                size="md" 
                className="w-full justify-center py-2.5 rounded-lg"
                onClick={() => navigate('/category/all')}
              >
                Explore Catalog Categories
              </Button>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-border-subtle">
            <div className="flex items-center text-xs text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-action-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="ml-2">
                Need assistance? Visit our{" "}
                <button 
                  type="button" 
                  onClick={() => navigate('/helpsupport')} 
                  className="text-action-primary font-medium hover:underline inline cursor-pointer"
                >
                  Help & Support Center
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageNotFound;