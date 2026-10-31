import React, { useState, useEffect, lazy, Suspense } from "react";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import { useParams, useNavigate } from "react-router-dom";
import { MdAccountBalanceWallet } from "react-icons/md";
import { RiMapPinTimeFill } from "react-icons/ri";
import { IoPerson } from "react-icons/io5";
import { ImHammer2 } from "react-icons/im";
import { FaChevronLeft, FaChevronRight, FaClock } from "react-icons/fa";
import io from "socket.io-client";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import ShareMenu from "../../../components/Common/MiniComponent/ShareMenu/ShareMenu";
import {
  parseAuctionDates,
  calculateAuctionTime,
} from "../../../utils/auctionTimer";
import {
  getOptimizedDetailImage,
  getResponsiveSrcSet,
  getOptimizedThumbnail,
} from "../../../utils/imageOptimizer";

const ScheduleBidModal = lazy(() =>
  import("../../../components/Modals/ScheduleBidModal/ScheduleBidModal")
);

const ProductDetails = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const { id } = useParams();
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [currentBid, setCurrentBid] = useState(0);
  const [bidderName, setBidderName] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [userMoney, setUserMoney] = useState(0);
  const [userWallet, setUserWallet] = useState({
    totalBalance: 0,
    reservedBalance: 0,
    availableBalance: 0,
  });
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [productDeleted, setProductDeleted] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [carData, setCarData] = useState({
    images: [],
    name: "",
    biddingStartPrice: 0,
    email: "",
    description: "",
  });
  const API_URL = import.meta.env.VITE_API_URL || "";

  const [socket, setSocket] = useState(null);
  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });
  const [isBiddingStarted, setIsBiddingStarted] = useState(false);
  const [isBiddingEnded, setIsBiddingEnded] = useState(false);
  const [biddingEndTime, setBiddingEndTime] = useState(null);
  const [auctionDates, setAuctionDates] = useState({
    startDate: null,
    endDate: null,
    status: "Active",
  });
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [loadedIndices, setLoadedIndices] = useState(() => new Set([0]));

  useEffect(() => {
    setLoadedIndices((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, [index]);

  // Get user data from Redux safely without creating new object reference
  const authUser = useSelector((state) => state.auth?.user);
  const userEmail = authUser?.email;
  const userName = authUser?.name;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const socketInstance = io(API_URL || undefined, {
      withCredentials: true,
    });
    setSocket(socketInstance);

    socketInstance.emit("joinProductRoom", id);
    socketInstance.on("productData", (productData) => {
      if (productData.productId === id) {
        setCurrentBid(productData.currentBid);
        setBidderName(productData.bidderName);
        if (productData.biddingEndTime) {
          const newEnd = new Date(productData.biddingEndTime);
          if (!isNaN(newEnd.getTime())) {
            setBiddingEndTime(newEnd);
            setAuctionDates((prev) => ({ ...prev, endDate: newEnd }));
          }
        }
      }
    });

    socketInstance.on("auctionStarted", (data) => {
      if (data.productId === id) {
        fetchProductData(true);
      }
    });

    socketInstance.on("auctionEnded", (data) => {
      if (data.productId === id) {
        fetchProductData(true);
      }
    });

    socketInstance.on("outbid", (data) => {
      if (data.productId === id) {
        toast.error(
          `You have been outbid! ₹${data.releasedAmount || ""} has been returned to your available balance.`
        );
        fetchAmount();
      }
    });

    socketInstance.on("walletBalanceUpdated", (data) => {
      if (data.availableBalance !== undefined) {
        setUserWallet({
          totalBalance: data.totalBalance,
          reservedBalance: data.reservedBalance,
          availableBalance: data.availableBalance,
        });
        setUserMoney(data.availableBalance);
      } else {
        fetchAmount();
      }
    });

    socketInstance.on("auctionStatusChanged", (data) => {
      if (data.productId === id) {
        fetchProductData(true);
      }
    });

    // Handle socket errors
    socketInstance.on("error", (err) => {
      console.error("Socket error:", err.message);
    });

    // Handle reconnection
    socketInstance.on("reconnect", () => {
      socketInstance.emit("joinProductRoom", id);
    });

    return () => socketInstance.disconnect();
  }, [id]);

  const fetchProductData = async (forceFresh = false) => {
    try {
      const response = forceFresh
        ? await axiosWithAuth.get(`/products/${id}`, { cacheTtl: 0 })
        : await axiosWithAuth.get(`/products/${id}`);
      const { success, product } = response.data;
      const {
        biddingStartDate,
        biddingStartTime,
        biddingEndTime: rawEndTime,
        tempuseremail,
        tempname,
        images = [],
        status = "Active",
        ...restData
      } = product;

      setCarData({
        images,
        status,
        ...restData,
      });

      if (tempuseremail) setBidderName(tempname);
      setCurrentBid(product.biddingStartPrice || 0);

      const { startDate, endDate } = parseAuctionDates(product);

      setAuctionDates({
        startDate,
        endDate,
        status,
      });
      setBiddingEndTime(endDate);

      const initialCalc = calculateAuctionTime(startDate, endDate, status);
      setTimeLeft(initialCalc.timeLeft);
      setIsBiddingStarted(initialCalc.isStarted);
      setIsBiddingEnded(initialCalc.isEnded);

      setLoading(false);
      setServerDown(false);
    } catch (error) {
      console.error("Error fetching product data:", error);
      setLoading(false);
      setServerDown(true);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProductData();
    }
  }, [id]);

  useEffect(() => {
    if (!auctionDates.startDate && !auctionDates.endDate) return;

    const tick = () => {
      const calc = calculateAuctionTime(
        auctionDates.startDate,
        auctionDates.endDate,
        auctionDates.status
      );
      setTimeLeft(calc.timeLeft);
      setIsBiddingStarted(calc.isStarted);
      setIsBiddingEnded(calc.isEnded);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [auctionDates]);

  useEffect(() => {
    if (isBiddingEnded) handleBiddingEnd();
  }, [isBiddingEnded]);

  const handleBiddingEnd = async () => {
    try {
      // Server-authoritative lifecycle transition: client simply refreshes authoritative product state
      await fetchProductData(true);
    } catch (error) {
      console.error("Error refreshing auction state on completion:", error);
    }
  };
  useEffect(() => {
    if (!userEmail) {
      setUserMoney(0);
      return;
    }
    const fetchAmount = async () => {
      try {
        const response = await axiosWithAuth.get("/auth/get-amount");
        if (response.data && response.data.amount !== undefined) {
          const total = Number(response.data.totalBalance ?? response.data.amount) || 0;
          const reserved = Number(response.data.reservedBalance) || 0;
          const available = Number(response.data.availableBalance ?? (total - reserved)) || 0;
          setUserWallet({
            totalBalance: total,
            reservedBalance: reserved,
            availableBalance: available,
          });
          setUserMoney(available);
        }
      } catch (error) {
        console.error("Error fetching amount:", error);
      }
    };

    fetchAmount();
  }, [userEmail]);

  const fetchProfilePic = async () => {
    try {
      if (!carData.email) return;
      const response = await axiosWithAuth.get("/auth/seller/profile-pic", {
        params: { email: carData.email },
      });

      if (response.data.profilePic) {
        setProfilePicUrl(response.data.profilePic);
      }
      if (response.data.name) {
        setSellerName(response.data.name);
      }
    } catch (error) {
      console.log("Error fetching profile picture");
    }
  };

  useEffect(() => {
    if (carData?.email) fetchProfilePic();
  }, [carData?.email]);

  const isUpcoming = !isBiddingStarted && !isBiddingEnded;
  const isAuctionActive = isBiddingStarted && !isBiddingEnded;

  const handleSelect = (selectedIndex) => setIndex(selectedIndex);
  const toggleDropdown = () => {
    if (isAuctionActive && userEmail) {
      setDropdownVisible(!isDropdownVisible);
    }
  };

  const handleBidSubmit = async () => {
    if (!isAuctionActive) {
      setAlertMessage("Bidding is not active for this product.");
      return;
    }

    try {
      const enteredAmount = parseFloat(bidAmount);
      const minIncrement = carData.minIncrement || 50;
      const minimumAmount =
        currentBid > 0
          ? currentBid + minIncrement
          : carData.startingPrice || carData.biddingStartPrice || 0;

      const isCurrentHighestBidder =
        carData.tempuseremail &&
        userEmail &&
        carData.tempuseremail.toLowerCase() === userEmail.toLowerCase();

      const requiredAvailable = isCurrentHighestBidder
        ? Math.max(0, enteredAmount - currentBid)
        : enteredAmount;

      if (userWallet.availableBalance < requiredAvailable) {
        setAlertMessage(
          `Insufficient available balance. You need ₹${requiredAvailable.toLocaleString()} available in your wallet to place this bid (Available: ₹${userWallet.availableBalance.toLocaleString()}).`
        );
        return;
      }

      if (isNaN(enteredAmount) || enteredAmount < minimumAmount) {
        setAlertMessage(
          `Invalid amount. Your bid must be at least ₹${minimumAmount}.`
        );
        return;
      }

      // Authoritative Bid Placement via secure backend endpoint
      const response = await axiosWithAuth.post(`/products/${id}/bid`, {
        amount: enteredAmount,
      });

      if (response.data && response.data.success) {
        setAlertMessage("Bid placed successfully!");
        setCurrentBid(response.data.data.currentPrice);
      }
    } catch (error) {
      console.error("Error placing bid:", error);
      const serverMsg =
        error.response?.data?.message || "Failed to place bid. Please try again.";
      setAlertMessage(serverMsg);
    } finally {
      setBidAmount("");
      setDropdownVisible(false);
    }
  };

  useEffect(() => {
    let interval;
    if (isHovered && carData.images?.length > 0) {
      interval = setInterval(() => {
        setIndex((prevIndex) => (prevIndex + 1) % carData.images.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isHovered, carData.images]);

  const SkeletonLoading = () => {
    return (
      <div className="min-h-screen py-8 bg-canvas text-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-8 gap-6">
            {/* Left Column */}
            <div className="col-span-5">
              {/* Main Image Container */}
              <div className="bg-surface border border-border-subtle rounded-lg shadow-card overflow-hidden mb-6">
                <div className="relative">
                  <div className="carousel">
                    <div className="carousel-item">
                      <div className="w-full h-96 bg-surface-subtle animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thumbnail Container */}
              <div className="bg-surface border border-border-subtle rounded-lg shadow-card p-4">
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[...Array(4)].map((_, idx) => (
                    <div
                      key={idx}
                      className="w-24 h-16 bg-surface-subtle animate-pulse rounded-lg"
                    ></div>
                  ))}
                </div>
              </div>

              {/* Description Container */}
              <div className="mt-6">
                <div className="bg-surface border border-border-subtle rounded-lg shadow-card p-6">
                  <h4 className="text-xl font-bold mb-4 text-foreground">Description</h4>
                  <div className="h-4 bg-surface-subtle animate-pulse rounded w-full"></div>
                  <div className="h-4 bg-surface-subtle animate-pulse rounded w-3/4 mt-2"></div>
                  <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2 mt-2"></div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col-span-3">
              {/* Bidding and Seller Info */}
              <div className="bg-surface border border-border-subtle rounded-lg shadow-card p-6">
                <h3 className="text-2xl font-bold mb-4">
                  <div className="h-6 bg-surface-subtle animate-pulse rounded w-3/4"></div>
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                  </div>
                  <div className="timer">
                    <h2 className="text-xl font-bold flex items-center space-x-2">
                      <div className="h-6 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                    </h2>
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {[...Array(4)].map((_, idx) => (
                        <div key={idx} className="text-center">
                          <div className="h-8 bg-surface-subtle animate-pulse rounded w-full"></div>
                          <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2 mt-1"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 bg-surface border border-border-subtle rounded-lg shadow-card p-6">
                <div className="flex items-center space-x-2">
                  <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                </div>
              </div>
              <div className="mt-6 bg-surface border border-border-subtle rounded-lg shadow-card p-6">
                <h5 className="text-xl font-bold mb-4">
                  <div className="h-6 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                </h5>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-surface-subtle animate-pulse rounded-full"></div>
                  <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                </div>
                <div className="mt-4">
                  <h6 className="text-lg font-semibold">
                    <div className="h-6 bg-surface-subtle animate-pulse rounded w-1/2"></div>
                  </h6>
                  <div className="h-4 bg-surface-subtle animate-pulse rounded w-1/2 mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return serverDown ? (
      <div className="pt-32 pb-32 text-center bg-canvas text-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          Server Unavailable
        </h2>
        <p className="text-foreground-secondary mt-2">
          Please try again later.
        </p>
      </div>
    ) : (
      <SkeletonLoading />
    );
  }

  if (productDeleted) {
    return (
      <div className="pt-32 pb-32 text-center bg-canvas text-foreground">
        <h2 className="text-2xl font-bold text-foreground">
          Product No Longer Available
        </h2>
        <p className="text-foreground-secondary mt-2">
          This product has been sold.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 px-4 py-2 bg-action-primary text-action-primary-fg rounded hover:bg-action-primary-hover font-medium transition"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 bg-canvas text-foreground">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-8 gap-6">
          {/* Left Column */}
          <div className="col-span-5">
            {/* Main Image Container */}
            <div className="bg-surface border border-border-subtle rounded-lg shadow-card overflow-hidden mb-6">
              <div
                className="relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div className="carousel">
                  {carData.images?.length > 0 ? (
                    carData.images.map((image, idx) => {
                      const isCurrent = index === idx;
                      const isLoaded = loadedIndices.has(idx);
                      return (
                        <div
                          key={idx}
                          className={`carousel-item ${
                            isCurrent ? "block" : "hidden"
                          }`}
                        >
                          {isLoaded ? (
                            <img
                              src={getOptimizedDetailImage(image.secure_url)}
                              srcSet={getResponsiveSrcSet(image.secure_url, [450, 800, 1200])}
                              sizes="(max-width: 768px) 100vw, 800px"
                              alt={`${carData.name || "Product"} - Slide ${idx + 1}`}
                              loading={idx === 0 ? "eager" : "lazy"}
                              fetchpriority={idx === 0 ? "high" : "auto"}
                              decoding={idx === 0 ? "sync" : "async"}
                              className="w-full h-96 object-contain bg-surface-subtle"
                            />
                          ) : (
                            <div className="w-full h-96 bg-surface-subtle flex items-center justify-center animate-pulse" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full h-96 bg-surface-subtle flex items-center justify-center">
                      <span className="text-foreground-muted">
                        No images available
                      </span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-2">
                  {carData.images?.map((_, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      className={`h-1.5 w-8 rounded-full transition-all cursor-pointer ${
                        index === idx
                          ? "bg-foreground"
                          : "bg-border-subtle"
                      }`}
                    ></div>
                  ))}
                </div>
                {/* Navigation Arrows */}
                {carData.images?.length > 1 && (
                  <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={() =>
                        handleSelect(
                          (index - 1 + carData.images.length) %
                            carData.images.length
                        )
                      }
                      className="bg-surface/80 backdrop-blur-sm text-foreground border border-border-subtle p-2 rounded-full hover:bg-surface transition-all shadow-sm"
                    >
                      <FaChevronLeft className="text-2xl" />
                    </button>
                    <button
                      onClick={() =>
                        handleSelect((index + 1) % carData.images.length)
                      }
                      className="bg-surface/80 backdrop-blur-sm text-foreground border border-border-subtle p-2 rounded-full hover:bg-surface transition-all shadow-sm"
                    >
                      <FaChevronRight className="text-2xl" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Container */}
            {carData.images?.length > 0 && (
              <div className="bg-surface border border-border-subtle rounded-lg shadow-card p-4">
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {carData.images.map((image, idx) => (
                    <img
                      key={idx}
                      src={getOptimizedThumbnail(image.secure_url, 160)}
                      onClick={() => handleSelect(idx)}
                      loading="lazy"
                      decoding="async"
                      className={`w-24 h-16 object-cover rounded-lg cursor-pointer border transition-all ${
                        index === idx
                          ? "border-action-primary ring-2 ring-focus"
                          : "border-border-subtle hover:border-border-default"
                      }`}
                      alt={`${carData.name || "Product"} thumbnail ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Description Container */}
            <div className="mt-6">
              <div className="bg-surface border border-border-subtle rounded-lg shadow-card p-6">
                <h4 className="text-xl font-bold mb-4 text-foreground">
                  Description
                </h4>

                {carData.description && carData.description.length > 0 ? (
                  <div className="space-y-2">
                    {carData.description.map((item, index) => (
                      <div key={index}>
                        <h5 className="text-lg font-semibold text-foreground">
                          {item.name}
                        </h5>
                        <p className="text-foreground-secondary">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground-secondary">
                    No description available
                  </p>
                )}

                <div className="z-2">
                  <ShareMenu />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-3">
            {/* Bidding and Seller Info */}
            <div className="bg-surface border border-border-subtle rounded-lg shadow-card p-6">
              <h3 className="text-2xl font-bold mb-4 text-foreground">
                {carData.name || "Product Name"}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-foreground font-numeric">
                  <ImHammer2 className="text-xl text-brand-gold" />
                  <span>Current Bid: ₹{currentBid}</span>
                </div>
                <div className="flex items-center space-x-2 text-foreground-secondary">
                  <IoPerson className="text-xl" />
                  <span>Current Bidder: {bidderName || "None"}</span>
                </div>
                <div className="timer">
                  <h2 className="text-xl font-bold flex items-center space-x-2 text-foreground">
                    <span>
                      {isUpcoming
                        ? "AUCTION STARTS IN"
                        : isBiddingEnded
                        ? "AUCTION ENDED"
                        : "BID ENDS IN"}
                    </span>
                    <RiMapPinTimeFill className="text-xl" />
                  </h2>
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="text-center p-2 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-2xl font-bold text-foreground font-numeric">
                        {timeLeft.days}
                      </span>
                      <div className="text-xs font-semibold text-foreground-muted tracking-wider">
                        DAYS
                      </div>
                    </div>
                    <div className="text-center p-2 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-2xl font-bold text-foreground font-numeric">
                        {timeLeft.hours}
                      </span>
                      <div className="text-xs font-semibold text-foreground-muted tracking-wider">
                        HOURS
                      </div>
                    </div>
                    <div className="text-center p-2 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-2xl font-bold text-foreground font-numeric">
                        {timeLeft.minutes}
                      </span>
                      <div className="text-xs font-semibold text-foreground-muted tracking-wider">
                        MINUTES
                      </div>
                    </div>
                    <div className="text-center p-2 rounded bg-surface-subtle border border-border-subtle">
                      <span className="text-2xl font-bold text-foreground font-numeric">
                        {timeLeft.seconds}
                      </span>
                      <div className="text-xs font-semibold text-foreground-muted tracking-wider">
                        SECONDS
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <button
                      onClick={isAuctionActive && userEmail ? toggleDropdown : undefined}
                      disabled={!isAuctionActive || !userEmail}
                      className={`btn-canonical btn-canonical-lg flex-1 ${
                        !isAuctionActive || !userEmail
                          ? "bg-surface-subtle text-foreground-muted cursor-not-allowed border border-border-subtle opacity-60"
                          : "btn-canonical-primary shadow-xs"
                      }`}
                    >
                      {isUpcoming
                        ? "Bidding hasn't started"
                        : isBiddingEnded
                        ? "Auction Ended"
                        : !userEmail
                        ? "Login to Bid"
                        : "Bid on this Item"}
                    </button>

                    {!isBiddingEnded && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!userEmail) {
                            navigate("/login");
                            return;
                          }
                          setIsScheduleModalOpen(true);
                        }}
                        className="btn-canonical btn-canonical-lg btn-canonical-secondary flex items-center justify-center gap-2"
                        title="Configure an automated scheduled bid"
                      >
                        <FaClock className="text-action-primary text-sm" />
                        <span>Schedule Bid</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isAuctionActive && isDropdownVisible && (
                <div className="mt-4">
                  <div className="bg-surface-subtle border border-border-subtle rounded-lg shadow-card p-4">
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Enter Your Bid:
                    </label>
                    <input
                      type="number"
                      placeholder={`Minimum: ₹${currentBid + 200}`}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full p-2 border border-border-default rounded-lg bg-surface text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus font-numeric"
                    />
                    <div
                      onClick={handleBidSubmit}
                      className="mt-4 flex justify-center"
                    >
                      <div className="w-24 h-24 bg-brand-gold-subtle text-brand-gold border-2 border-brand-gold/30 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-gold hover:text-white transition shadow-md">
                        <i className="fas fa-gavel text-4xl"></i>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {alertMessage && (
                <div
                  className={`mt-4 p-3 rounded-lg border font-medium ${
                    alertMessage.includes("Invalid") ||
                    alertMessage.includes("Not enough")
                      ? "bg-status-danger/10 text-status-danger border-status-danger/20"
                      : "bg-status-success/10 text-status-success border-status-success/20"
                  }`}
                >
                  {alertMessage}
                </div>
              )}
            </div>

            <div className="mt-6 bg-surface border border-border-subtle rounded-lg shadow-card p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-foreground font-numeric">
                <MdAccountBalanceWallet className="text-xl text-action-primary" />
                <span className="font-semibold text-sm">Wallet Balance</span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/payment")}
                className="text-xs text-action-primary hover:underline font-semibold cursor-pointer"
              >
                + Add Funds
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-subtle text-xs">
              <div className="p-2.5 rounded-lg bg-surface-subtle">
                <span className="text-foreground-muted block text-[10px] uppercase font-bold">
                  Available to Bid
                </span>
                <span className="text-sm font-bold text-foreground">
                  ₹{userWallet.availableBalance.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-subtle">
                <span className="text-foreground-muted block text-[10px] uppercase font-bold">
                  Locked in Bids
                </span>
                <span className="text-sm font-bold text-amber-400">
                  ₹{userWallet.reservedBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-surface border border-border-subtle rounded-lg shadow-card p-6">
            <h5 className="text-xl font-bold mb-4 text-foreground">
                About Seller
              </h5>
              <div
                onClick={() =>
                  navigate("/seller-profile-view", {
                    state: { sellerEmail: carData.email },
                  })
                }
                className="flex items-center space-x-4 cursor-pointer"
              >
                <img
                  src={getOptimizedThumbnail(profilePicUrl, 96) || "/default-profile.png"}
                  alt="Seller"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/default-profile.png";
                  }}
                  className="w-12 h-12 rounded-full object-cover border border-border-subtle"
                />
                <span className="text-foreground font-medium">
                  {sellerName || "Unknown Seller"}
                </span>
              </div>
              <div className="mt-4">
                <h6 className="text-lg font-semibold text-foreground">
                  Seller's Reputation
                </h6>
                <p className="text-foreground-secondary">⭐⭐⭐⭐☆</p>
              </div>
              <button
                onClick={() => navigate("/contact")}
                className="btn-canonical btn-canonical-md btn-canonical-outline w-full mt-4"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </div>

      {isScheduleModalOpen && (
        <Suspense fallback={null}>
          <ScheduleBidModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            product={carData}
            currentPrice={currentBid}
            minIncrement={carData.minIncrement || 50}
            isUpcoming={isUpcoming}
            isAuctionActive={isAuctionActive}
            isEnded={isBiddingEnded}
            userEmail={userEmail}
            onSuccess={() => {
              fetchProductData();
            }}
          />
        </Suspense>
      )}
    </div>
  );

};

export default ProductDetails;
