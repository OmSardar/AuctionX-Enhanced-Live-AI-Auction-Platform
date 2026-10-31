import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom"; // Import useParams and useNavigate
import axios from "axios";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { fetchCsrfToken } from "../../../redux/slices/csrfSecuritySlice";
import { AuctionXLogo } from "../../../../ui/AuctionXLogo";

const UpdateItemPage = () => {
  const { itemId } = useParams(); // Get the item ID from the URL
  const navigate = useNavigate(); // To navigate after successful update
  const dispatch = useDispatch();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    mainCategory: "",
    category: "",
    files: [], // For new files to be uploaded
    mobileNumber: "",
    biddingStartDate: "",
    biddingStartTime: "",
    biddingStartPrice: "",
  });

  // Additional state variables
  const [descriptionPoints, setDescriptionPoints] = useState([]);
  const [pointName, setPointName] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [existingImages, setExistingImages] = useState([]); // To hold URLs of existing images
  const [minDate, setMinDate] = useState("");
  const [minTime, setMinTime] = useState("");
  const [loading, setLoading] = useState(true); // Start with loading true to fetch data
  const [uploadProgress, setUploadProgress] = useState(0);
  const [popupImage, setPopupImage] = useState(null);
  const { token: csrfToken } = useSelector((state) => state.csrf);

  // Fetch CSRF token
  useEffect(() => {
    if (!csrfToken) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken]);

  // Fetch existing item data when the component mounts
  useEffect(() => {
    const fetchItemData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/items/684b33b138f5d98cba74237`); // API endpoint to get item details
        const item = response.data;

        // Pre-fill the form with existing data
        setFormData({
          title: item.title,
          description: item.description,
          mainCategory: item.mainCategory,
          category: item.category,
          files: [], // Keep files empty initially, only for new uploads
          mobileNumber: item.mobileNumber,
          biddingStartDate: item.biddingStartDate.split("T")[0], // Format date
          biddingStartTime: new Date(item.biddingStartDate)
            .toTimeString()
            .slice(0, 5), // Format time
          biddingStartPrice: item.biddingStartPrice,
        });

        setDescriptionPoints(item.descriptionPoints || []);
        setExistingImages(item.imageUrls || []); // Assuming the API returns image URLs
      } catch (error) {
        toast.error("Failed to fetch item data. Please try again.");
        console.error("Fetch item error:", error);
        navigate("/"); // Redirect if item not found or error occurs
      } finally {
        setLoading(false);
      }
    };

    fetchItemData();
  }, [itemId, navigate]);

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

  // Initialize date restrictions
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setMinDate(`${year}-${month}-${day}`);

    const twoHoursLater = new Date(today.getTime() + 2 * 60 * 60 * 1000);
    const hours = String(twoHoursLater.getHours()).padStart(2, "0");
    const minutes = String(twoHoursLater.getMinutes()).padStart(2, "0");
    setMinTime(`${hours}:${minutes}`);
  }, []);

  // Handle form input changes
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [id]: value,
    }));

    if (id === "biddingStartDate") {
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
  const validateImageDimensions = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        if (width < 500 || height < 500) {
          toast.warning(
            "For best results, product images should be at least 500×500 pixels"
          );
        }
        resolve(true);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const currentTotalImages = existingImages.length + formData.files.length;

    if (currentTotalImages + files.length > 4) {
      toast.error("Maximum of 4 product images allowed.");
      return;
    }

    const validatedFiles = [];
    for (const file of files) {
      const validDimensions = await validateImageDimensions(file);
      if (validDimensions) {
        validatedFiles.push(file);
      }
    }

    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...validatedFiles],
    }));
  };

  const handleRemoveNewImage = (index) => {
    const updatedFiles = [...formData.files];
    updatedFiles.splice(index, 1);
    setFormData((prev) => ({
      ...prev,
      files: updatedFiles,
    }));
  };

  const handleRemoveExistingImage = (index) => {
    const updatedImages = [...existingImages];
    updatedImages.splice(index, 1);
    setExistingImages(updatedImages);
  };

  const openImagePopup = (imageUrl) => setPopupImage(imageUrl);
  const closeImagePopup = () => setPopupImage(null);

  const validateMobileNumber = (number) => /^\d{10}$/.test(number);

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (existingImages.length + formData.files.length === 0) {
      toast.error("Please provide at least one product image.");
      setLoading(false);
      return;
    }

    if (!validateMobileNumber(formData.mobileNumber)) {
      toast.error("Please enter a valid 10-digit mobile number.");
      setLoading(false);
      return;
    }

    const submissionData = new FormData();
    // Append all form fields
    Object.keys(formData).forEach((key) => {
      if (key !== "files") {
        submissionData.append(key, formData[key]);
      }
    });

    // Append new files
    formData.files.forEach((file) => {
      submissionData.append("newImages", file);
    });

    // Append existing images and description points as JSON strings
    submissionData.append("existingImages", JSON.stringify(existingImages));
    submissionData.append(
      "descriptionPoints",
      JSON.stringify(descriptionPoints)
    );

    try {
      await axios.put(`/api/items/update/${itemId}`, submissionData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "CSRF-Token": csrfToken,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      toast.success("Item updated successfully!");
      navigate(`/item/${itemId}`); // Navigate to the item's detail page
    } catch (error) {
      toast.error("Failed to update item. Please try again.");
      console.error("Update error:", error);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  if (loading && !formData.title) {
    return <div>Loading...</div>; // Or a spinner component
  }

  return (
    <div className="container mx-auto p-4 md:p-8 bg-gray-50">
      {/* Page Header */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <AuctionXLogo className="mx-auto h-14 w-auto" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Update Your Item</h1>
        <p className="text-gray-600 mt-2">
          Make changes to your item details below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Item Details Section */}
        <div className="p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-700 mb-6">
            Item Details
          </h2>
          {/* Form fields... */}
        </div>

        {/* Image Upload Section */}
        <div className="p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-700 mb-6">
            Product Images
          </h2>
          {/* Display Existing Images */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {existingImages.map((imageUrl, index) => (
              <div key={index} className="relative">
                <img
                  src={imageUrl}
                  alt={`Existing item ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                  onClick={() => openImagePopup(imageUrl)}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveExistingImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs"
                >
                  X
                </button>
              </div>
            ))}
          </div>
          {/* Display New Images to be Uploaded */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {formData.files.map((file, index) => (
              <div key={index} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`New item ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                  onClick={() => openImagePopup(URL.createObjectURL(file))}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveNewImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs"
                >
                  X
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <input
              type="file"
              id="files"
              multiple
              onChange={handleImageUpload}
              className="file-input"
              accept="image/*"
            />
          </div>
        </div>

        {/* Bidding Details Section */}
        <div className="p-8 bg-white rounded-lg shadow-md">
          {/* ... Bidding fields ... */}
        </div>

        {/* Submit Button */}
        <div className="text-center">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300 disabled:bg-gray-400"
          >
            {loading ? `Updating... ${uploadProgress}%` : "Update Item"}
          </button>
        </div>
      </form>

      {/* Image Popup Modal */}
      {popupImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={closeImagePopup}
        >
          <img
            src={popupImage}
            alt="Popup view"
            className="max-w-screen-lg max-h-screen p-4"
          />
        </div>
      )}
    </div>
  );
};

export default UpdateItemPage;
