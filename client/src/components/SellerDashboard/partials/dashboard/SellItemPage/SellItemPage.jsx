import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";
import { AuctionXLogo } from "../../../../ui/AuctionXLogo";
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_API_KEY;
const API_URL = import.meta.env.VITE_API_URL;
const SellItemPage = () => {
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    mainCategory: "", // Add this line
    category: "",
    files: [],
    mobileNumber: "",
    biddingStartDate: "",
    biddingStartTime: "",
    biddingStartPrice: "",
    acceptTerms: false,
  });
  const dispatch = useDispatch();

  // Additional state variables
  const [descriptionPoints, setDescriptionPoints] = useState([]);
  const [pointName, setPointName] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [bannerSelected, setBannerSelected] = useState(false);
  const [bannerImage, setBannerImage] = useState(null);
  const [bannerPlan, setBannerPlan] = useState("");
  const [minDate, setMinDate] = useState("");
  const [minTime, setMinTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [popupImage, setPopupImage] = useState(null);
  const [bannerSize, setBannerSize] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentOrderId, setPaymentOrderId] = useState("");
  const [razorpayOptions, setRazorpayOptions] = useState(null);
  const userEmail = useSelector((state) => state.auth.user?.email);

  //------------------------------------testing-----------------------------------//
  const { token: csrfToken } = useSelector((state) => state.csrf);

  // Fetch CSRF token only when it's missing and not already loading
  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  const categories = [
    "Electronics & Gadgets",
    "Collectibles & Antiques",
    "Luxury & Fashion",
    "Automobiles & Accessories",
    "Real Estate & Properties",
    "Sports & Memorabilia",
    "Art & Handmade Crafts",
    "Rare Books & Documents",
    "Industrial & Business Auctions",
    "Unique Experiences & Services",
    "Collectible Technology",
    "Musical Instruments & Equipment",
    "Luxury Lifestyle",
    "Other",
  ];

  const subcategories = {
    "Electronics & Gadgets": [
      "Smartphones & Accessories",
      "Laptops & Computers",
      "Cameras & Lenses",
      "Gaming Consoles & Accessories",
      "Smart Wearables",
      "Vintage Electronics",
      "Audio Equipment",
      "Drones & Robotics",
    ],
    "Collectibles & Antiques": [
      "Rare Coins & Currency",
      "Stamps & Philately",
      "Vintage Memorabilia",
      "Classic Art & Paintings",
      "Historical Artifacts",
      "Vintage Toys & Games",
      "Antique Furniture",
      "Vintage Postcards & Maps",
    ],
    "Luxury & Fashion": [
      "Watches & Timepieces",
      "Designer Clothing & Shoes",
      "Handbags & Accessories",
      "Jewelry & Gemstones",
      "Luxury Sunglasses",
      "Rare Fashion Collectibles",
      "Limited Edition Sneakers",
      "Vintage Designer Pieces",
    ],
    "Automobiles & Accessories": [
      "Classic & Vintage Cars",
      "Luxury Cars",
      "Motorcycles & Bikes",
      "Car Accessories & Performance Parts",
      "Rare Auto Memorabilia",
      "Vintage Car Parts",
      "Racing Collectibles",
      "Automotive Art & Models",
    ],
    "Real Estate & Properties": [
      "Luxury Villas & Apartments",
      "Commercial Properties",
      "Land & Plots",
      "Auctioned Foreclosed Properties",
      "Rare Historic Buildings",
      "Investment Properties",
      "Undeveloped Land",
      "Unique Architectural Properties",
    ],
    "Sports & Memorabilia": [
      "Signed Jerseys & Merchandise",
      "Rare Sneakers",
      "Limited Edition Sporting Equipment",
      "Olympic & Championship Memorabilia",
      "Vintage Sports Cards",
      "Game-Used Equipment",
      "Athlete Autographs",
      "Sports Photography & Art",
    ],
    "Art & Handmade Crafts": [
      "Original Paintings & Sculptures",
      "Handcrafted Decor & Furniture",
      "NFTs & Digital Art",
      "Rare Artisan Crafts",
      "Vintage Craft Tools",
      "Handmade Jewelry",
      "Unique Ceramics & Pottery",
      "Limited Edition Art Prints",
    ],
    "Rare Books & Documents": [
      "First Editions & Signed Books",
      "Ancient Manuscripts & Documents",
      "Comic Books & Graphic Novels",
      "Rare Scientific Publications",
      "Vintage Maps & Atlases",
      "Autographed Literature",
      "Historical Newspapers",
      "Rare Academic Journals",
    ],
    "Industrial & Business Auctions": [
      "Heavy Machinery & Equipment",
      "Wholesale & Liquidation Stocks",
      "Restaurant & Hotel Equipment",
      "Manufacturing Surplus",
      "Office Furniture & Technology",
      "Construction Equipment",
      "Agricultural Machinery",
      "Industrial Inventory Liquidation",
    ],
    "Unique Experiences & Services": [
      "VIP Concert & Event Tickets",
      "Exclusive Travel Packages",
      "Meet & Greet with Celebrities",
      "Private Dining Experiences",
      "Luxury Retreat Packages",
      "Exclusive Workshop & Masterclasses",
      "Personal Training Sessions",
      "Private Guided Tours",
    ],
    "Collectible Technology": [
      "Vintage Computer Systems",
      "Rare Mobile Phones",
      "Classic Video Game Consoles",
      "Limited Edition Tech Gadgets",
      "Prototype Devices",
      "Vintage Computer Components",
      "Rare Software & Operating Systems",
      "Tech Memorabilia",
    ],
    "Musical Instruments & Equipment": [
      "Vintage Guitars",
      "Rare Musical Instruments",
      "Classic Amplifiers",
      "Signed Music Equipment",
      "Limited Edition Synthesizers",
      "Vintage Recording Equipment",
      "Collectible Drum Kits",
      "Rare Microphones",
    ],
    "Luxury Lifestyle": [
      "Fine Wines & Spirits",
      "Rare Whiskey & Bourbon",
      "Vintage Champagne",
      "Luxury Cigars",
      "Collectible Wine Accessories",
      "Rare Bar Equipment",
      "Limited Edition Decanters",
      "Vintage Cocktail Memorabilia",
    ],
    Other: ["Miscellaneous"],
  };

  const predefinedDescriptionPoints = {
    // Electronics & Gadgets
    "Smartphones & Accessories": [
      "Brand",
      "Model",
      "Condition",
      "Storage",
      "Screen Size",
      "Color",
      "Accessories Included",
    ],
    "Laptops & Computers": [
      "Brand",
      "Model",
      "Processor",
      "RAM",
      "Storage",
      "Screen Size",
      "Operating System",
      "Condition",
    ],
    "Cameras & Lenses": [
      "Brand",
      "Model",
      "Type",
      "Megapixels",
      "Lens Compatibility",
      "Accessories Included",
      "Condition",
    ],
    "Gaming Consoles & Accessories": [
      "Brand",
      "Model",
      "Storage",
      "Controller Count",
      "Games Included",
      "Special Edition",
      "Condition",
    ],
    "Smart Wearables": [
      "Brand",
      "Model",
      "Features",
      "Compatibility",
      "Battery Life",
      "Color",
      "Condition",
    ],
    "Vintage Electronics": [
      "Brand",
      "Model",
      "Year",
      "Working Condition",
      "Rarity",
      "Original Packaging",
      "Historical Significance",
    ],
    "Audio Equipment": [
      "Brand",
      "Model",
      "Type",
      "Power Output",
      "Connectivity",
      "Special Features",
      "Condition",
    ],
    "Drones & Robotics": [
      "Brand",
      "Model",
      "Flight Time",
      "Camera Specifications",
      "Range",
      "Features",
      "Condition",
    ],

    // Collectibles & Antiques
    "Rare Coins & Currency": [
      "Year",
      "Country",
      "Denomination",
      "Grade",
      "Certification",
      "Mint Mark",
      "Rarity",
    ],
    "Stamps & Philately": [
      "Country",
      "Year",
      "Denomination",
      "Condition",
      "Rarity",
      "Certification",
      "Historical Significance",
    ],
    "Vintage Memorabilia": [
      "Era",
      "Theme",
      "Condition",
      "Rarity",
      "Authentication",
      "Historical Significance",
      "Provenance",
    ],
    "Classic Art & Paintings": [
      "Artist",
      "Era",
      "Medium",
      "Dimensions",
      "Condition",
      "Provenance",
      "Authentication",
    ],
    "Historical Artifacts": [
      "Age",
      "Origin",
      "Material",
      "Condition",
      "Historical Significance",
      "Authentication",
      "Provenance",
    ],
    "Vintage Toys & Games": [
      "Brand",
      "Era",
      "Condition",
      "Original Packaging",
      "Completeness",
      "Rarity",
      "Material",
    ],
    "Antique Furniture": [
      "Style",
      "Era",
      "Material",
      "Condition",
      "Dimensions",
      "Provenance",
      "Restoration History",
    ],
    "Vintage Postcards & Maps": [
      "Era",
      "Region Depicted",
      "Condition",
      "Rarity",
      "Size",
      "Historical Significance",
      "Artist/Publisher",
    ],

    // Luxury & Fashion
    "Watches & Timepieces": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Movement",
      "Materials",
      "Box & Papers",
    ],
    "Designer Clothing & Shoes": [
      "Designer",
      "Size",
      "Condition",
      "Season/Collection",
      "Material",
      "Color",
      "Authentication",
    ],
    "Handbags & Accessories": [
      "Brand",
      "Model",
      "Condition",
      "Year/Collection",
      "Color",
      "Material",
      "Authentication",
    ],
    "Jewelry & Gemstones": [
      "Type",
      "Material",
      "Gemstone",
      "Carat",
      "Certification",
      "Designer",
      "Condition",
    ],
    "Luxury Sunglasses": [
      "Brand",
      "Model",
      "Condition",
      "Frame Material",
      "Lens Type",
      "Original Case",
      "Authentication",
    ],
    "Rare Fashion Collectibles": [
      "Designer",
      "Collection",
      "Year",
      "Condition",
      "Rarity",
      "Historical Significance",
      "Authentication",
    ],
    "Limited Edition Sneakers": [
      "Brand",
      "Model",
      "Size",
      "Release Year",
      "Condition",
      "Box & Accessories",
      "Authentication",
    ],
    "Vintage Designer Pieces": [
      "Designer",
      "Era",
      "Condition",
      "Material",
      "Size",
      "Rarity",
      "Historical Significance",
    ],

    // Automobiles & Accessories
    "Classic & Vintage Cars": [
      "Make",
      "Model",
      "Year",
      "Mileage",
      "Condition",
      "Original Parts",
      "Service History",
    ],
    "Luxury Cars": [
      "Make",
      "Model",
      "Year",
      "Mileage",
      "Features",
      "Condition",
      "Service History",
    ],
    "Motorcycles & Bikes": [
      "Make",
      "Model",
      "Year",
      "Mileage",
      "Engine Size",
      "Condition",
      "Modifications",
    ],
    "Car Accessories & Performance Parts": [
      "Brand",
      "Compatible Models",
      "Type",
      "Condition",
      "Material",
      "Installation Requirements",
      "Performance Enhancement",
    ],
    "Rare Auto Memorabilia": [
      "Type",
      "Era",
      "Related Brand/Model",
      "Condition",
      "Rarity",
      "Authenticity",
      "Historical Significance",
    ],
    "Vintage Car Parts": [
      "Part Type",
      "Compatible Models",
      "Era",
      "Condition",
      "Originality",
      "Material",
      "Fitment Details",
    ],
    "Racing Collectibles": [
      "Racing Series",
      "Team/Driver",
      "Year",
      "Type",
      "Condition",
      "Authentication",
      "Rarity",
    ],
    "Automotive Art & Models": [
      "Subject",
      "Artist/Brand",
      "Scale",
      "Material",
      "Condition",
      "Limited Edition Number",
      "Display Case",
    ],

    // Real Estate & Properties
    "Luxury Villas & Apartments": [
      "Location",
      "Size",
      "Bedrooms",
      "Bathrooms",
      "Age",
      "Amenities",
      "Special Features",
    ],
    "Commercial Properties": [
      "Location",
      "Size",
      "Type",
      "Condition",
      "Current Tenancy",
      "Income Potential",
      "Zoning",
    ],
    "Land & Plots": [
      "Location",
      "Size",
      "Zoning",
      "Utilities",
      "Topography",
      "Accessibility",
      "Development Potential",
    ],
    "Auctioned Foreclosed Properties": [
      "Location",
      "Size",
      "Type",
      "Condition",
      "Legal Status",
      "Reserve Price",
      "Previous Value",
    ],
    "Rare Historic Buildings": [
      "Location",
      "Age",
      "Architectural Style",
      "Size",
      "Historical Significance",
      "Condition",
      "Listed Status",
    ],
    "Investment Properties": [
      "Location",
      "Type",
      "Current Income",
      "Occupancy Rate",
      "Potential ROI",
      "Condition",
      "Future Development",
    ],
    "Undeveloped Land": [
      "Location",
      "Size",
      "Zoning",
      "Topography",
      "Water Rights",
      "Mineral Rights",
      "Access",
    ],
    "Unique Architectural Properties": [
      "Architect",
      "Style",
      "Year Built",
      "Location",
      "Size",
      "Special Features",
      "Condition",
    ],

    // Sports & Memorabilia
    "Signed Jerseys & Merchandise": [
      "Sport",
      "Team/Player",
      "Year",
      "Authentication",
      "Item Type",
      "Condition",
      "Display Features",
    ],
    "Rare Sneakers": [
      "Brand",
      "Model",
      "Size",
      "Year",
      "Condition",
      "Box & Accessories",
      "Authentication",
    ],
    "Limited Edition Sporting Equipment": [
      "Sport",
      "Brand",
      "Type",
      "Limited Edition Number",
      "Condition",
      "Special Features",
      "Authentication",
    ],
    "Olympic & Championship Memorabilia": [
      "Event",
      "Year",
      "Item Type",
      "Athlete/Team",
      "Condition",
      "Authentication",
      "Historical Significance",
    ],
    "Vintage Sports Cards": [
      "Sport",
      "Player",
      "Year",
      "Card Set",
      "Condition",
      "Grading",
      "Rarity",
    ],
    "Game-Used Equipment": [
      "Sport",
      "Player",
      "Event",
      "Item Type",
      "Condition",
      "Authentication",
      "Provenance",
    ],
    "Athlete Autographs": [
      "Athlete",
      "Sport",
      "Item Signed",
      "Condition",
      "Authentication",
      "Inscription",
      "Photo Documentation",
    ],
    "Sports Photography & Art": [
      "Sport",
      "Athlete/Event",
      "Photographer/Artist",
      "Year",
      "Size",
      "Limited Edition Number",
      "Framing",
    ],

    // Art & Handmade Crafts
    "Original Paintings & Sculptures": [
      "Artist",
      "Medium",
      "Year",
      "Dimensions",
      "Style",
      "Condition",
      "Provenance",
    ],
    "Handcrafted Decor & Furniture": [
      "Artisan",
      "Material",
      "Technique",
      "Dimensions",
      "Style",
      "Condition",
      "Functionality",
    ],
    "NFTs & Digital Art": [
      "Artist",
      "Blockchain",
      "Edition Size",
      "Resolution",
      "Creation Date",
      "File Format",
      "Rights Included",
    ],
    "Rare Artisan Crafts": [
      "Artisan",
      "Technique",
      "Material",
      "Region",
      "Age",
      "Condition",
      "Cultural Significance",
    ],
    "Vintage Craft Tools": [
      "Type",
      "Era",
      "Material",
      "Condition",
      "Functionality",
      "Rarity",
      "Original Branding",
    ],
    "Handmade Jewelry": [
      "Artisan",
      "Materials",
      "Technique",
      "Gemstones",
      "Size/Dimensions",
      "Weight",
      "Hallmarks",
    ],
    "Unique Ceramics & Pottery": [
      "Artist",
      "Technique",
      "Material",
      "Dimensions",
      "Firing Method",
      "Glazing",
      "Condition",
    ],
    "Limited Edition Art Prints": [
      "Artist",
      "Edition Number",
      "Total Edition Size",
      "Technique",
      "Year",
      "Dimensions",
      "Condition",
    ],

    // Rare Books & Documents
    "First Editions & Signed Books": [
      "Author",
      "Title",
      "Year",
      "Publisher",
      "Condition",
      "Inscription",
      "Rarity",
    ],
    "Ancient Manuscripts & Documents": [
      "Age",
      "Origin",
      "Language",
      "Content Type",
      "Condition",
      "Material",
      "Historical Significance",
    ],
    "Comic Books & Graphic Novels": [
      "Title",
      "Issue Number",
      "Year",
      "Publisher",
      "Condition",
      "Grading",
      "Key Issue Details",
    ],
    "Rare Scientific Publications": [
      "Author",
      "Title",
      "Year",
      "Publisher",
      "Field of Study",
      "Condition",
      "Historical Significance",
    ],
    "Vintage Maps & Atlases": [
      "Region Depicted",
      "Cartographer",
      "Year",
      "Size",
      "Condition",
      "Coloring",
      "Historical Accuracy",
    ],
    "Autographed Literature": [
      "Author",
      "Title",
      "Year",
      "Inscription",
      "Condition",
      "Authentication",
      "Provenance",
    ],
    "Historical Newspapers": [
      "Publication",
      "Date",
      "Historical Event Covered",
      "Condition",
      "Completeness",
      "Rarity",
      "Preservation Method",
    ],
    "Rare Academic Journals": [
      "Title",
      "Volume/Issue",
      "Year",
      "Field of Study",
      "Condition",
      "Contributor Significance",
      "Rarity",
    ],

    // Industrial & Business Auctions
    "Heavy Machinery & Equipment": [
      "Type",
      "Brand",
      "Model",
      "Age",
      "Condition",
      "Operating Hours",
      "Specifications",
    ],
    "Wholesale & Liquidation Stocks": [
      "Product Type",
      "Quantity",
      "Condition",
      "Retail Value",
      "Brand",
      "Age",
      "Storage Requirements",
    ],
    "Restaurant & Hotel Equipment": [
      "Type",
      "Brand",
      "Age",
      "Condition",
      "Capacity",
      "Power Requirements",
      "Dimensions",
    ],
    "Manufacturing Surplus": [
      "Item Type",
      "Quantity",
      "Condition",
      "Original Purpose",
      "Material",
      "Age",
      "Technical Specifications",
    ],
    "Office Furniture & Technology": [
      "Type",
      "Brand",
      "Age",
      "Condition",
      "Quantity",
      "Material",
      "Dimensions",
    ],
    "Construction Equipment": [
      "Type",
      "Brand",
      "Model",
      "Age",
      "Operating Hours",
      "Condition",
      "Attachments Included",
    ],
    "Agricultural Machinery": [
      "Type",
      "Brand",
      "Model",
      "Age",
      "Operating Hours",
      "Condition",
      "Attachments",
    ],
    "Industrial Inventory Liquidation": [
      "Industry",
      "Item Types",
      "Quantity",
      "Condition",
      "Age",
      "Original Value",
      "Special Handling Requirements",
    ],

    // Unique Experiences & Services
    "VIP Concert & Event Tickets": [
      "Event",
      "Artist/Team",
      "Date",
      "Venue",
      "Seating Location",
      "Inclusions",
      "Restrictions",
    ],
    "Exclusive Travel Packages": [
      "Destination",
      "Duration",
      "Accommodations",
      "Inclusions",
      "Group Size",
      "Season",
      "Special Access",
    ],
    "Meet & Greet with Celebrities": [
      "Celebrity",
      "Event Type",
      "Duration",
      "Location",
      "Inclusions",
      "Photo Opportunities",
      "Restrictions",
    ],
    "Private Dining Experiences": [
      "Chef/Restaurant",
      "Location",
      "Menu Type",
      "Party Size",
      "Duration",
      "Beverage Inclusions",
      "Special Features",
    ],
    "Luxury Retreat Packages": [
      "Location",
      "Duration",
      "Accommodations",
      "Activities",
      "Meals Included",
      "Season",
      "Exclusivity",
    ],
    "Exclusive Workshop & Masterclasses": [
      "Topic",
      "Instructor",
      "Duration",
      "Location",
      "Group Size",
      "Skill Level",
      "Materials Included",
    ],
    "Personal Training Sessions": [
      "Trainer",
      "Specialty",
      "Duration",
      "Location",
      "Number of Sessions",
      "Equipment Provided",
      "Experience Level",
    ],
    "Private Guided Tours": [
      "Destination",
      "Duration",
      "Guide Expertise",
      "Group Size",
      "Transportation",
      "Special Access",
      "Inclusions",
    ],

    // Collectible Technology
    "Vintage Computer Systems": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Functionality",
      "Included Software",
      "Accessories",
    ],
    "Rare Mobile Phones": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Functionality",
      "Original Packaging",
      "Historical Significance",
    ],
    "Classic Video Game Consoles": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Included Games",
      "Accessories",
      "Original Packaging",
    ],
    "Limited Edition Tech Gadgets": [
      "Brand",
      "Model",
      "Year",
      "Limited Edition Number",
      "Condition",
      "Special Features",
      "Original Packaging",
    ],
    "Prototype Devices": [
      "Brand",
      "Device Type",
      "Era",
      "Functionality",
      "Condition",
      "Provenance",
      "Historical Significance",
    ],
    "Vintage Computer Components": [
      "Type",
      "Brand",
      "Model",
      "Year",
      "Compatibility",
      "Condition",
      "Functionality",
    ],
    "Rare Software & Operating Systems": [
      "Name",
      "Version",
      "Platform",
      "Year",
      "Media Type",
      "Completeness",
      "Original Packaging",
    ],
    "Tech Memorabilia": [
      "Company",
      "Item Type",
      "Era",
      "Condition",
      "Rarity",
      "Historical Significance",
      "Authentication",
    ],

    // Musical Instruments & Equipment
    "Vintage Guitars": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Serial Number",
      "Modifications",
      "Case Included",
    ],
    "Rare Musical Instruments": [
      "Type",
      "Brand/Maker",
      "Year",
      "Condition",
      "Material",
      "Provenance",
      "Tonal Characteristics",
    ],
    "Classic Amplifiers": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Wattage",
      "Tube/Solid State",
      "Modifications",
    ],
    "Signed Music Equipment": [
      "Item Type",
      "Signed By",
      "Year",
      "Condition",
      "Authentication",
      "Functionality",
      "Historical Context",
    ],
    "Limited Edition Synthesizers": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Limited Edition Number",
      "Functionality",
      "Special Features",
    ],
    "Vintage Recording Equipment": [
      "Type",
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Functionality",
      "Technical Specifications",
    ],
    "Collectible Drum Kits": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Shell Material",
      "Pieces Included",
      "Historical Significance",
    ],
    "Rare Microphones": [
      "Brand",
      "Model",
      "Year",
      "Condition",
      "Type",
      "Functionality",
      "Historical Significance",
    ],

    // Luxury Lifestyle
    "Fine Wines & Spirits": [
      "Type",
      "Producer",
      "Vintage",
      "Region",
      "Bottle Size",
      "Storage History",
      "Tasting Notes",
    ],
    "Rare Whiskey & Bourbon": [
      "Distillery",
      "Age",
      "Bottling Year",
      "Proof/ABV",
      "Bottle Number",
      "Cask Type",
      "Tasting Notes",
    ],
    "Vintage Champagne": [
      "House",
      "Vintage",
      "Cuvée",
      "Bottle Size",
      "Storage Conditions",
      "Tasting Notes",
      "Rating",
    ],
    "Luxury Cigars": [
      "Brand",
      "Vitola",
      "Country of Origin",
      "Age",
      "Box Date",
      "Storage Conditions",
      "Tasting Notes",
    ],
    "Collectible Wine Accessories": [
      "Type",
      "Brand",
      "Material",
      "Age",
      "Condition",
      "Rarity",
      "Functionality",
    ],
    "Rare Bar Equipment": [
      "Type",
      "Brand",
      "Era",
      "Material",
      "Condition",
      "Functionality",
      "Historical Significance",
    ],
    "Limited Edition Decanters": [
      "Brand",
      "Release",
      "Material",
      "Limited Edition Number",
      "Condition",
      "Original Packaging",
      "Contents",
    ],
    "Vintage Cocktail Memorabilia": [
      "Type",
      "Era",
      "Brand Association",
      "Condition",
      "Material",
      "Functionality",
      "Historical Significance",
    ],

    // Other
    Miscellaneous: [
      "Condition",
      "Age",
      "Origin",
      "Materials",
      "Dimensions",
      "Rarity",
      "Special Features",
    ],
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize date restrictions
  useEffect(() => {
    const updateDateTimeRestrictions = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      setMinDate(`${year}-${month}-${day}`);

      const twoHoursLater = new Date(today.getTime() + 2 * 60 * 60 * 1000);
      const hours = String(twoHoursLater.getHours()).padStart(2, "0");
      const minutes = String(twoHoursLater.getMinutes()).padStart(2, "0");
      setMinTime(`${hours}:${minutes}`);
    };
    updateDateTimeRestrictions();
  }, []);

  // Handle form input changes
  const handleChange = (e) => {
    const { id, name, value, type, checked } = e.target;
    const fieldName = id || name;

    if (type === "checkbox") {
      setFormData((prevState) => ({
        ...prevState,
        [fieldName]: checked,
      }));
    } else {
      setFormData((prevState) => ({
        ...prevState,
        [fieldName]: value,
      }));
    }

    if (fieldName === "biddingStartDate") {
      const today = new Date();
      const selectedDate = new Date(value);
      if (selectedDate.toDateString() === today.toDateString()) {
        const twoHoursLater = new Date(today.getTime() + 2 * 60 * 60 * 1000);
        const hours = String(twoHoursLater.getHours()).padStart(2, "0");
        const minutes = String(twoHoursLater.getMinutes()).padStart(2, "0");
        setMinTime(`${hours}:${minutes}`);
      } else {
        setMinTime("");
      }
    }
  };

  // Description points handlers
  const handleAddPoint = () => {
    if (
      pointName.trim() &&
      pointDescription.trim() &&
      descriptionPoints.length < 6
    ) {
      setDescriptionPoints([
        ...descriptionPoints,
        { name: pointName, description: pointDescription },
      ]);
      setPointName("");
      setPointDescription("");
    } else {
      toast.warning("Maximum of 6 points allowed or fields are empty.");
    }
  };

  const handleRemovePoint = (index) => {
    const updatedPoints = descriptionPoints.filter((_, i) => i !== index);
    setDescriptionPoints(updatedPoints);
  };

  // Image handling functions
  const validateImageDimensions = (file, isBanner = false) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;

        if (isBanner) {
          if (bannerSize === "horizontal" && (width < 1200 || height < 300)) {
            toast.error("Horizontal banner should be at least 1200×300 pixels");
            resolve(false);
          } else if (
            bannerSize === "vertical-large" &&
            (width < 600 || height < 900)
          ) {
            toast.error(
              "Large vertical banner should be at least 600×900 pixels"
            );
            resolve(false);
          } else if (
            bannerSize === "vertical-small" &&
            (width < 300 || height < 600)
          ) {
            toast.error(
              "Small vertical banner should be at least 300×600 pixels"
            );
            resolve(false);
          } else {
            resolve(true);
          }
        } else {
          // Product image dimension requirements (example: at least 500×500)
          if (width < 500 || height < 500) {
            toast.warning(
              "For best results, product images should be at least 500×500 pixels"
            );
            // Still allow upload with warning
          }
          resolve(true);
        }
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (e, isBanner = false) => {
    const files = Array.from(e.target.files);

    if (isBanner && files.length > 0) {
      const file = files[0];
      const validDimensions = await validateImageDimensions(file, true);
      if (!validDimensions) return;

      const reader = new FileReader();
      reader.onload = () => {
        setBannerImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      // Handle multiple product images
      const currentCount = formData.files.length;

      if (currentCount + files.length > 4) {
        toast.error("Maximum of 4 product images allowed");
        return;
      }

      // Process each file
      const validatedFiles = [];
      for (const file of files) {
        const validDimensions = await validateImageDimensions(file);
        if (validDimensions) {
          validatedFiles.push(file);
        }
      }

      // Update state with new files
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...validatedFiles],
      }));
    }
  };

  const handleRemoveImage = (index) => {
    const updatedFiles = [...formData.files];
    updatedFiles.splice(index, 1);
    setFormData((prev) => ({
      ...prev,
      files: updatedFiles,
    }));
  };

  const openImagePopup = (imageUrl) => {
    setPopupImage(imageUrl);
  };

  const closeImagePopup = () => {
    setPopupImage(null);
  };

  const validateMobileNumber = (number) => {
    const mobilePattern = /^\d{10}$/;
    return mobilePattern.test(number);
  };

  // Form submission
  // Update the handleSubmit function to use the updated processPayment

  // Inside your component
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation checks
    if (!formData.acceptTerms) {
      toast.error("Please accept the terms and conditions");
      return;
    }

    if (formData.files.length > 4) {
      toast.error(
        "Maximum of 4 product images allowed. Please remove excess images."
      );
      return;
    }

    if (formData.files.length === 0) {
      toast.error("Please upload at least one product image");
      return;
    }

    if (!validateMobileNumber(formData.mobileNumber)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    try {
      // Process payment first if banner is selected
      if (bannerSelected) {
        if (!bannerSize) {
          toast.error("Please select a banner size");
          return;
        }

        if (!bannerImage) {
          toast.error("Please upload a banner image");
          return;
        }

        if (!bannerPlan) {
          toast.error("Please select a banner plan");
          return;
        }

        const paymentSuccessful = await processPayment();
        if (!paymentSuccessful) {
          toast.error("Payment was not completed. Please try again.");
          return;
        }
      }

      setLoading(true);
      setUploadProgress(0);

      // Create form data for backend submission
      const productFormData = new FormData();

      // Append regular form fields
      productFormData.append("name", formData.name);
      productFormData.append("category", formData.category);
      productFormData.append("mobileNumber", formData.mobileNumber);
      productFormData.append("biddingStartDate", formData.biddingStartDate);
      productFormData.append("biddingStartTime", formData.biddingStartTime);
      productFormData.append("biddingStartPrice", formData.biddingStartPrice);
      productFormData.append("email", userEmail); // Using the userEmail from useSelector

      // Append description points as JSON
      productFormData.append("description", JSON.stringify(descriptionPoints));

      formData.files.forEach((file) => {
        productFormData.append("productImages", file);
      });

      // Append banner info if selected
      if (bannerSelected && bannerImage) {
        productFormData.append("hasBanner", "true");
        productFormData.append("bannerPlan", bannerPlan);
        productFormData.append("bannerSize", bannerSize);
        productFormData.append("paymentOrderId", paymentOrderId);

        // Extract file from Data URL
        const bannerFile = dataURLtoFile(bannerImage, "banner.jpg");
        productFormData.append("bannerImage", bannerFile);
      }

      // Show progress while uploading
      const progressConfig = {
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          const percentCompleted = Math.floor((loaded * 100) / total);
          setUploadProgress(percentCompleted);
        },
      };

      // Send to backend
      const response = await axios.post(
        `${API_URL}/api/products`,
        productFormData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "X-CSRF-Token": csrfToken,
          },
          withCredentials: true,
          ...progressConfig,
        }
      );

      toast.success("Item submitted successfully!");
      // Redirect or reset form
      setTimeout(() => {
        window.location.href = "/seller/dashboard/pendingbids";
      }, 2000);
    } catch (error) {
      console.error("Error submitting product:", error);
      toast.error(error.response?.data?.message || "Error submitting product");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert Data URL to File
  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleReset = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      mainCategory: "",
      files: [],
      biddingStartDate: "",
      biddingStartTime: "",
      biddingStartPrice: "",
      acceptTerms: false,
    });
    setDescriptionPoints([]);
    setPointName("");
    setPointDescription("");
    setBannerSelected(false);
    setBannerImage(null);
    setBannerPlan("");
    setUploadProgress(0);
  };

  // Modify handleBannerPlanSelection to reset the banner image if plan changes
  const handleBannerPlanSelection = (plan) => {
    setBannerPlan(plan);
    toast.info(`Selected banner plan: ${plan}`);
  };

  // Add this payment processing function
  // Update the processPayment function
  // Update the processPayment function
  const processPayment = async () => {
    setPaymentProcessing(true);
    setPaymentError("");

    try {
      // Calculate payment amount based on banner plan
      const amount = bannerSelected ? parseInt(bannerPlan) : 0;

      if (!amount) {
        toast.error("Please select a banner plan");
        setPaymentProcessing(false);
        return false;
      }

      const email = userEmail || formData.email || "";

      // Show payment modal first
      setShowPaymentModal(true);

      // Create a promise that will be resolved/rejected based on payment outcome
      return new Promise((resolve, reject) => {
        // Create an order ID (in a real implementation, you'd create this on your backend)
        const orderId = "order_" + Math.random().toString(36).substring(2, 15);
        setPaymentOrderId(orderId);

        // Store these in state so we can use them later when the user clicks "Proceed to Pay"
        const paymentOptions = {
          key: RAZORPAY_KEY,
          amount: amount * 100, // Razorpay expects amount in paise
          currency: "INR",
          name: "AuctionX",
          description: `Banner Plan: ₹${amount}`,
          image: "/favicon.svg",
          handler: function (response) {
            // Handle successful payment
            const totalAmount = amount;

            // Update the backend
            axios
              .patch(
                `${API_URL}/api/auth/seller/update-amount`,
                {
                  email,
                  amount: totalAmount,
                  paymentId: response.razorpay_payment_id,
                },
                {
                  headers: {
                    "X-CSRF-Token": csrfToken,
                  },
                  withCredentials: true,
                }
              )
              .then(() => {
                toast.success(
                  `Payment of ₹${amount} completed successfully!`
                );
                setPaymentCompleted(true);
                setShowPaymentModal(false);
                setPaymentProcessing(false);
                resolve(true);
              })
              .catch((error) => {
                console.error("Error updating amount in the database:", error);
                toast.error("Payment processed but failed to update records");
                setShowPaymentModal(false);
                setPaymentProcessing(false);
                resolve(true);
              });
          },
          prefill: {
            name: userEmail || "",
            email: email,
            contact: formData.mobileNumber || "",
          },
          notes: {
            bannerPlan: bannerPlan,
            bannerSize: bannerSize,
          },
          theme: {
            color: "#3399cc",
          },
          modal: {
            ondismiss: function () {
              setPaymentProcessing(false);
              resolve(false);
            },
          },
        };

        // Store the payment options in state
        setRazorpayOptions(paymentOptions);
      });
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Payment failed. Please try again.");
      setPaymentError("Payment initialization failed. Please try again.");
      setShowPaymentModal(false);
      setPaymentProcessing(false);
      return false;
    }
  };

  // Add this function to handle the "Proceed to Pay" button click
  const handleProceedToPay = () => {
    if (!window.Razorpay) {
      toast.error("Payment gateway not available. Please try again later.");
      setPaymentProcessing(false);
      setShowPaymentModal(false);
      return;
    }

    // Initialize and open Razorpay
    const razorpay = new window.Razorpay(razorpayOptions);
    razorpay.open();
  };

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-4xl mx-auto bg-surface border border-border-subtle shadow-card rounded-2xl text-foreground transition-colors duration-200">
      {/* Logo and Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <AuctionXLogo className="w-auto h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground">Sell an Item</h1>
        <p className="text-foreground-secondary mt-1 text-sm sm:text-base">
          Fill out the form below to list your verified item on AuctionX.
        </p>
      </div>

      {loading && (
        <div className="mb-8 p-4 bg-surface-subtle border border-border-subtle rounded-xl">
          <div className="w-full bg-border-subtle rounded-full h-3 overflow-hidden">
            <div
              className="bg-action-primary h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-center mt-2 text-xs font-semibold text-action-primary">
            Uploading listing assets... {uploadProgress}%
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Item Name */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Item Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors"
            placeholder="e.g. 1968 Omega Speedmaster Professional"
            required
          />
        </div>

        {/* Email */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={userEmail || formData.email}
            onChange={userEmail ? undefined : handleChange}
            className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
            required
            disabled={!!userEmail}
            placeholder={userEmail ? "" : "Enter your seller email"}
          />

          {userEmail && (
            <p className="text-xs text-muted mt-1.5 flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">✓</span> Using verified email from your seller account
            </p>
          )}
        </div>

        {/* Select Category */}
        {/* Main Category */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Main Category
          </label>
          <select
            id="mainCategory"
            value={formData.mainCategory || ""}
            onChange={(e) => {
              const mainCat = e.target.value;
              setFormData({
                ...formData,
                mainCategory: mainCat,
                category: "",
              });
            }}
            className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors cursor-pointer"
            required
          >
            <option value="" className="bg-surface text-foreground">Select a main category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className="bg-surface text-foreground">
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory - only shows when main category is selected */}
        {formData.mainCategory && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-foreground mb-2">
              Subcategory
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors cursor-pointer"
              required
            >
              <option value="" className="bg-surface text-foreground">Select a subcategory</option>
              {subcategories[formData.mainCategory].map((subcat) => (
                <option key={subcat} value={subcat} className="bg-surface text-foreground">
                  {subcat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description Points */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Description Points
          </label>
          <div className="space-y-4">
            {formData.category &&
              predefinedDescriptionPoints[formData.category].length > 0 && (
                <div className="bg-surface-subtle border border-border-subtle p-4 rounded-xl mb-4">
                  <p className="text-xs font-semibold text-action-primary uppercase tracking-wider mb-2.5">
                    Suggested points for {formData.category}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {predefinedDescriptionPoints[formData.category].map(
                      (point) => (
                        <span
                          key={point}
                          className="bg-action-primary/10 text-action-primary border border-action-primary/20 px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:bg-action-primary/20 transition-colors"
                          onClick={() => setPointName(point)}
                        >
                          + {point}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

            {descriptionPoints.map((point, index) => (
              <div
                key={index}
                className="border border-border-subtle bg-surface-subtle p-4 rounded-xl space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground text-sm">
                    {point.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(index)}
                    className="text-red-500 hover:text-red-600 transition-colors cursor-pointer text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={point.description}
                  readOnly
                  className="w-full p-2.5 border border-border-subtle rounded-lg bg-surface text-foreground-secondary text-sm resize-none"
                  rows={2}
                  maxLength={100}
                />
              </div>
            ))}
            {descriptionPoints.length < 6 && (
              <div className="space-y-3 p-4 bg-surface-subtle border border-border-subtle rounded-xl">
                <input
                  type="text"
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                  className="w-full p-3 bg-surface border border-border-subtle text-foreground rounded-lg focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary text-sm"
                  placeholder="Point Name (e.g. Provenance / Condition)"
                />
                <textarea
                  value={pointDescription}
                  onChange={(e) => setPointDescription(e.target.value)}
                  className="w-full p-3 bg-surface border border-border-subtle text-foreground rounded-lg focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary text-sm"
                  placeholder="Point Description (max 100 characters)"
                  rows={2}
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={handleAddPoint}
                  className="px-5 py-2.5 bg-action-primary text-white text-xs font-bold rounded-lg hover:bg-action-primary-hover shadow-xs transition duration-200 cursor-pointer"
                >
                  Add Point
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Number */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Mobile Number
          </label>
          <input
            type="tel"
            id="mobileNumber"
            value={formData.mobileNumber}
            onChange={handleChange}
            className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors"
            placeholder="10-digit mobile number"
            required
          />
          {formData.mobileNumber &&
            !validateMobileNumber(formData.mobileNumber) && (
              <p className="text-red-500 text-xs mt-1.5 font-medium">
                Please enter a valid 10-digit mobile number
              </p>
            )}
        </div>

        {/* Bidding Start Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Bidding Start Date
            </label>
            <input
              type="date"
              id="biddingStartDate"
              value={formData.biddingStartDate}
              onChange={handleChange}
              min={minDate}
              className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Bidding Start Time
            </label>
            <input
              type="time"
              id="biddingStartTime"
              value={formData.biddingStartTime}
              onChange={handleChange}
              min={formData.biddingStartDate === minDate ? minTime : undefined}
              className="w-full p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors cursor-pointer"
              required
            />
            <p className="text-xs text-muted mt-1.5">
              Live auction window opens for 2 mins with automatic anti-sniping extension
            </p>
          </div>
        </div>

        {/* Bidding Start Price */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            Bidding Start Price (Reserve Baseline)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-action-primary font-bold">
              ₹
            </span>
            <input
              type="number"
              id="biddingStartPrice"
              value={formData.biddingStartPrice}
              onChange={handleChange}
              className="w-full pl-8 p-3 bg-surface-subtle border border-border-subtle text-foreground rounded-xl focus:outline-none focus:border-action-primary focus:ring-1 focus:ring-action-primary transition-colors"
              required
              min="1"
              step="1"
              placeholder="e.g. 5000"
              style={{ appearance: "textfield" }}
            />
          </div>
        </div>

        {/* Banner Selection */}
        <div className="mb-6 p-5 bg-surface-subtle border border-border-subtle rounded-2xl space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={bannerSelected}
              onChange={(e) => setBannerSelected(e.target.checked)}
              className="w-4 h-4 rounded text-action-primary focus:ring-action-primary accent-action-primary cursor-pointer"
            />
            <span className="text-sm font-bold text-foreground">
              Feature with Promotional Auction Banner (Optional)
            </span>
          </label>

          {bannerSelected && (
            <div className="space-y-4 pt-2 border-t border-border-subtle">
              <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Choose a promotional plan:</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition duration-200 cursor-pointer ${
                    bannerPlan === "3000"
                      ? "bg-action-primary text-white shadow-sm"
                      : "bg-surface border border-border-subtle text-foreground hover:bg-surface-hover"
                  }`}
                  onClick={() => handleBannerPlanSelection("3000")}
                >
                  ₹3,000 (90 mins/day spotlight)
                </button>
                <button
                  type="button"
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition duration-200 cursor-pointer ${
                    bannerPlan === "8000"
                      ? "bg-action-primary text-white shadow-sm"
                      : "bg-surface border border-border-subtle text-foreground hover:bg-surface-hover"
                  }`}
                  onClick={() => handleBannerPlanSelection("8000")}
                >
                  ₹8,000 (360 mins/day prime placement)
                </button>
                <button
                  type="button"
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition duration-200 cursor-pointer ${
                    bannerPlan === "12999"
                      ? "bg-action-primary text-white shadow-sm"
                      : "bg-surface border border-border-subtle text-foreground hover:bg-surface-hover"
                  }`}
                  onClick={() => handleBannerPlanSelection("12999")}
                >
                  ₹12,999 (840 mins/day takeover)
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-3">Select banner format:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    className={`border p-4 rounded-xl cursor-pointer transition-all ${
                      bannerSize === "horizontal"
                        ? "border-action-primary bg-action-primary/10"
                        : "border-border-subtle bg-surface hover:border-action-primary/40"
                    }`}
                    onClick={() => setBannerSize("horizontal")}
                  >
                    <div className="w-full h-14 bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-center">
                      <span className="text-xs text-foreground-secondary font-medium">
                        Wide Horizontal (1200×300)
                      </span>
                    </div>
                    <p className="text-center mt-2 text-xs font-bold text-foreground">
                      Wide Horizontal
                    </p>
                  </div>

                  <div
                    className={`border p-4 rounded-xl cursor-pointer transition-all ${
                      bannerSize === "vertical-large"
                        ? "border-action-primary bg-action-primary/10"
                        : "border-border-subtle bg-surface hover:border-action-primary/40"
                    }`}
                    onClick={() => setBannerSize("vertical-large")}
                  >
                    <div className="w-20 h-28 mx-auto bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-center">
                      <span className="text-xs text-foreground-secondary font-medium">
                        600×900
                      </span>
                    </div>
                    <p className="text-center mt-2 text-xs font-bold text-foreground">Large Vertical</p>
                  </div>

                  <div
                    className={`border p-4 rounded-xl cursor-pointer transition-all ${
                      bannerSize === "vertical-small"
                        ? "border-action-primary bg-action-primary/10"
                        : "border-border-subtle bg-surface hover:border-action-primary/40"
                    }`}
                    onClick={() => setBannerSize("vertical-small")}
                  >
                    <div className="w-16 h-24 mx-auto bg-surface-subtle border border-border-subtle rounded-lg flex items-center justify-center">
                      <span className="text-xs text-foreground-secondary font-medium">
                        300×600
                      </span>
                    </div>
                    <p className="text-center mt-2 text-xs font-bold text-foreground">Small Vertical</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Upload Promotional Banner Graphic
                </label>
                <p className="text-xs text-muted mb-2">
                  {bannerSize === "horizontal" &&
                    "Recommended dimension: 1200×300 pixels (PNG, JPG or WebP)"}
                  {bannerSize === "vertical-large" &&
                    "Recommended dimension: 600×900 pixels"}
                  {bannerSize === "vertical-small" &&
                    "Recommended dimension: 300×600 pixels"}
                  {!bannerSize && "Please select a banner format above first"}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, true)}
                  className="w-full p-2.5 bg-surface border border-border-subtle text-foreground rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-action-primary/10 file:text-action-primary hover:file:bg-action-primary/20 text-sm cursor-pointer disabled:opacity-50"
                  required={bannerSelected}
                  disabled={!bannerSize}
                />
                {bannerImage && (
                  <div className="mt-3 p-2 bg-surface border border-border-subtle rounded-xl">
                    <img
                      src={bannerImage}
                      alt="Banner Preview"
                      className={`object-cover rounded-lg cursor-pointer ${
                        bannerSize === "horizontal"
                          ? "w-full max-h-32"
                          : bannerSize === "vertical-large"
                          ? "h-48 max-w-xs mx-auto"
                          : "h-36 max-w-xs mx-auto"
                      }`}
                      onClick={() => openImagePopup(bannerImage)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Product Images */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-foreground mb-1">
            Upload Product Images (Max 4 Lots)
          </label>
          <p className="text-xs text-muted mb-3">
            Recommended: High-resolution square images (min. 500×500px). First image serves as the auction lot cover.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full p-2.5 bg-surface-subtle border border-border-subtle text-foreground rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-action-primary/10 file:text-action-primary hover:file:bg-action-primary/20 text-sm cursor-pointer disabled:opacity-50"
            multiple
            disabled={formData.files.length >= 4}
          />

          <div className="flex flex-wrap mt-4 gap-3">
            {formData.files.map((file, index) => (
              <div key={index} className="relative group/lot">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Product lot ${index + 1}`}
                  className="w-24 h-24 object-cover rounded-xl border border-border-subtle shadow-xs cursor-pointer"
                  onClick={() => openImagePopup(URL.createObjectURL(file))}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="mb-8 p-4 bg-surface-subtle border border-border-subtle rounded-xl">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="acceptTerms"
              checked={formData.acceptTerms}
              onChange={handleChange}
              className="w-4 h-4 rounded text-action-primary focus:ring-action-primary accent-action-primary cursor-pointer"
              required
            />
            <span className="text-sm text-foreground font-medium">
              I agree to the <Link to="/terms" className="text-action-primary underline hover:text-action-primary-hover">AuctionX Seller Listing Policy</Link> and 10% Platform Commission Agreement.
            </span>
          </label>
        </div>

        {/* Submit and Reset Buttons */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="submit"
            className="px-8 py-3.5 bg-action-primary text-white font-bold rounded-xl hover:bg-action-primary-hover shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer text-sm"
            disabled={loading}
          >
            {loading ? "Publishing Lot..." : "List Item for Auction"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-8 py-3.5 bg-surface-subtle text-foreground border border-border-subtle font-semibold rounded-xl hover:bg-surface-hover transition duration-200 disabled:opacity-50 cursor-pointer text-sm"
            disabled={loading}
          >
            Reset Form
          </button>
        </div>
      </form>

      {/* Image Popup */}
      {popupImage && (
        <div
          className="fixed inset-0 backdrop-blur-md bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={closeImagePopup}
        >
          <div
            className="max-w-4xl max-h-full overflow-auto relative bg-surface p-2 rounded-2xl border border-border-subtle shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={popupImage}
              alt="Enlarged view"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={closeImagePopup}
              className="absolute top-4 right-4 bg-surface text-foreground rounded-full w-9 h-9 flex items-center justify-center border border-border-subtle shadow-lg hover:bg-surface-hover transition duration-200 cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border-subtle rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-foreground">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-subtle">
              <h3 className="text-xl font-bold text-foreground">
                Promotion Checkout
              </h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentProcessing(false);
                }}
                className="text-muted hover:text-foreground text-lg font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {paymentError ? (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm rounded-xl">
                {paymentError}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-b border-border-subtle pb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Banner Plan:</span>
                    <span className="font-semibold text-foreground">
                      {bannerPlan === "3000"
                        ? "90 mins/day spotlight"
                        : bannerPlan === "8000"
                        ? "360 mins/day prime placement"
                        : "840 mins/day takeover"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Banner Format:</span>
                    <span className="font-semibold text-foreground">
                      {bannerSize === "horizontal"
                        ? "Wide Horizontal"
                        : bannerSize === "vertical-large"
                        ? "Large Vertical"
                        : "Small Vertical"}
                    </span>
                  </div>
                </div>

                <div className="border-b border-border-subtle pb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Subtotal:</span>
                    <span className="font-semibold text-foreground">₹{bannerPlan}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">GST (18%):</span>
                    <span className="font-medium text-foreground-secondary">
                      ₹{Math.round(parseInt(bannerPlan) * 0.18)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-border-subtle">
                    <span className="font-bold text-foreground">Total Payable:</span>
                    <span className="font-black text-action-primary text-xl">
                      ₹{Math.round(parseInt(bannerPlan) * 1.18).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <p className="text-xs text-muted mb-4">
                    Secured by Razorpay Payments & AuctionX Escrow Protection
                  </p>
                  <div className="flex justify-center">
                    <img
                      src="https://cdn.razorpay.com/static/assets/merchant-badge/badge-dark.png"
                      alt="Razorpay"
                      className="h-8 opacity-80"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentProcessing(false);
                }}
                className="px-5 py-2.5 bg-surface-subtle text-foreground border border-border-subtle font-semibold rounded-xl hover:bg-surface-hover transition duration-200 cursor-pointer text-sm"
              >
                Cancel
              </button>
              {!paymentError && (
                <button
                  onClick={handleProceedToPay}
                  className="px-6 py-2.5 bg-action-primary text-white font-bold rounded-xl hover:bg-action-primary-hover shadow-sm transition duration-200 cursor-pointer text-sm"
                >
                  Proceed to Razorpay
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellItemPage;
