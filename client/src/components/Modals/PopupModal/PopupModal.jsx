import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImPriceTags } from 'react-icons/im';
import { MdOutlineDescription } from 'react-icons/md';
import { RiMapPinTimeFill } from 'react-icons/ri';
import {
  parseAuctionDates,
  calculateAuctionTime,
} from '../../../utils/auctionTimer';

const PopupModal = ({ product, onClose }) => {
  const navigate = useNavigate();
  
  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });
  const [isBiddingStarted, setIsBiddingStarted] = useState(false);
  const [isBiddingEnded, setIsBiddingEnded] = useState(false);

  useEffect(() => {
    if (!product) return;

    const { startDate, endDate } = parseAuctionDates(
      product.biddingStartDate,
      product.biddingStartTime,
      product.biddingEndTime
    );

    const updateTimer = () => {
      const calc = calculateAuctionTime(startDate, endDate, product.status || "Active");
      setTimeLeft(calc.timeLeft);
      setIsBiddingStarted(calc.isStarted);
      setIsBiddingEnded(calc.isEnded);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [product]);

  if (!product) return null;

  // Safely extract product properties with fallbacks
  const productName = typeof product?.name === 'string' ? product.name : 'Product Name';
  const productDescription = typeof product?.description === 'string' ? product.description : 'No description available';
  const productPrice = typeof product?.biddingStartPrice === 'number' 
    ? product.biddingStartPrice 
    : 0;
  const imageUrl = product?.images?.[0]?.secure_url || '';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* Dimmed Background with Warm Espresso Overlay */}
      <div className="absolute inset-0 bg-surface-overlay backdrop-blur-xs"></div>
      
      {/* Popup Content */}
      <div 
        className="relative bg-surface text-foreground p-6 rounded-xl border border-border-subtle shadow-modal z-50 w-full max-w-4xl mx-auto flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          aria-label="Close modal"
          className="btn-canonical btn-canonical-icon-sm btn-canonical-ghost absolute top-3 right-3 text-foreground-muted hover:text-foreground text-lg"
          onClick={onClose}
        >
          ✕
        </button>

        {/* Left Content - Product Details */}
        <div className="md:w-1/2 p-2 sm:p-4 flex flex-col justify-between">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 break-words">{productName}</h2>
            <p className="flex items-center text-foreground-secondary mb-2 font-medium">
              <ImPriceTags className="mr-2 text-action-primary" /> Price: 
              <span className="font-numeric font-bold text-action-primary text-xl ml-1.5">₹{productPrice.toLocaleString()}</span>
            </p>
            <p className="flex items-start text-foreground-secondary mb-4 text-sm leading-relaxed">
              <MdOutlineDescription className="mr-2 mt-0.5 shrink-0 text-foreground-muted text-base" />
              <span>{productDescription}</span>
            </p>
          </div>
          
          {/* Timer Section */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <h3 className="flex items-center text-base font-semibold text-foreground mb-3">
              BID{" "}
              {isBiddingStarted
                ? isBiddingEnded
                  ? "HAS ENDED"
                  : "ENDS IN "
                : "STARTS IN "}
              <RiMapPinTimeFill className="ml-2 text-action-primary" />
            </h3>
            
            {/* Timer Boxes */}
            <div className="flex space-x-2 mb-4">
              <div className="bg-surface-subtle border border-border-subtle text-foreground rounded-lg p-2 text-center w-16">
                <span className="block text-xl font-bold font-numeric text-action-primary">{timeLeft.days}</span>
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">DAYS</span>
              </div>
              <div className="bg-surface-subtle border border-border-subtle text-foreground rounded-lg p-2 text-center w-16">
                <span className="block text-xl font-bold font-numeric text-action-primary">{timeLeft.hours}</span>
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">HOURS</span>
              </div>
              <div className="bg-surface-subtle border border-border-subtle text-foreground rounded-lg p-2 text-center w-16">
                <span className="block text-xl font-bold font-numeric text-action-primary">{timeLeft.minutes}</span>
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">MIN</span>
              </div>
              <div className="bg-surface-subtle border border-border-subtle text-foreground rounded-lg p-2 text-center w-16">
                <span className="block text-xl font-bold font-numeric text-action-primary">{timeLeft.seconds}</span>
                <span className="text-[10px] uppercase font-semibold text-foreground-muted">SEC</span>
              </div>
            </div>
            
            {/* View Item Button */}
            <button
              onClick={() => navigate(`/product/${product._id}`)}
              className="btn-canonical btn-canonical-lg btn-canonical-primary w-full mt-2"
            >
              View Full Auction Details
            </button>
          </div>
        </div>
        
        {/* Right Content - Product Image */}
        <div className="md:w-1/2 p-2 sm:p-4 flex items-center justify-center bg-surface-subtle/50 rounded-lg mt-4 md:mt-0">
          <img
            src={imageUrl}
            alt={productName}
            className="w-full h-64 md:h-96 object-contain rounded-lg"
            onError={(e) => {
              e.target.src = '/lot-placeholder.svg';
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PopupModal;