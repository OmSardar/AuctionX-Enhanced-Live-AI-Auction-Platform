import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");

test("Asset Integrity - Primary Brand Logo Remediation", () => {
  // Verify AuctionXLogo component exists and contains locally authored SVG
  const logoComponentPath = path.join(
    clientRoot,
    "src/components/ui/AuctionXLogo.jsx"
  );
  assert.ok(fs.existsSync(logoComponentPath), "AuctionXLogo.jsx must exist");
  const logoContent = fs.readFileSync(logoComponentPath, "utf-8");
  assert.ok(logoContent.includes("<svg"), "AuctionXLogo must render an SVG element");
  assert.ok(logoContent.includes("AUCTION"), "AuctionXLogo must include AUCTION wordmark");
  assert.ok(logoContent.includes("linearGradient"), "AuctionXLogo must define brand gradients");

  // Verify Navbar.jsx uses AuctionXLogo and does not hotlink to Cloudinary logo
  const navbarPath = path.join(clientRoot, "src/pages/Layouts/Navbar/Navbar.jsx");
  const navbarContent = fs.readFileSync(navbarPath, "utf-8");
  assert.ok(navbarContent.includes("AuctionXLogo"), "Navbar.jsx must use AuctionXLogo");
  assert.ok(
    !navbarContent.includes("cifsfk5fzryh0iwp3fua.png"),
    "Navbar.jsx must not reference the remote Cloudinary logo cifsfk5fzryh0iwp3fua.png"
  );

  // Verify SellerNavbar.jsx uses AuctionXLogo and does not hotlink to Cloudinary logo
  const sellerNavbarPath = path.join(
    clientRoot,
    "src/pages/Seller/Layouts/SellerNavbar/SellerNavbar.jsx"
  );
  const sellerNavbarContent = fs.readFileSync(sellerNavbarPath, "utf-8");
  assert.ok(sellerNavbarContent.includes("AuctionXLogo"), "SellerNavbar.jsx must use AuctionXLogo");
  assert.ok(
    !sellerNavbarContent.includes("cifsfk5fzryh0iwp3fua.png"),
    "SellerNavbar.jsx must not reference the remote Cloudinary logo cifsfk5fzryh0iwp3fua.png"
  );
});

test("Asset Integrity - Default Avatar Fallbacks", () => {
  const defaultProfilePath = path.join(clientRoot, "public/default-profile.png");
  assert.ok(fs.existsSync(defaultProfilePath), "client/public/default-profile.png must exist");

  const filesToCheck = [
    "src/pages/Layouts/Navbar/Navbar.jsx",
    "src/pages/Layouts/Navbar/components/NavbarUserMenu.jsx",
    "src/pages/Layouts/Navbar/components/NavbarMobileDrawer.jsx",
    "src/components/Common/Profile/ProfilePage.jsx",
    "src/components/Common/Profile/AvatarSelector.jsx",
    "src/components/AdminDashboard/pages/AdminUsersPage.jsx",
  ];

  const flaticonUrl = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  for (const relPath of filesToCheck) {
    const fullPath = path.join(clientRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(
      !content.includes(flaticonUrl),
      `${relPath} must not contain Flaticon hotlink URL`
    );
    assert.ok(
      content.includes("/default-profile.png"),
      `${relPath} must reference local /default-profile.png fallback`
    );
  }
});

test("Asset Integrity - Isolated Inappropriate Visual References Purged", () => {
  // 1. VectorStock watermark in ProductList4.jsx
  const productList4Path = path.join(
    clientRoot,
    "src/components/ProductList/ProductList4/ProductList4.jsx"
  );
  const pl4Content = fs.readFileSync(productList4Path, "utf-8");
  assert.ok(
    !pl4Content.includes("cdn.vectorstock.com"),
    "ProductList4.jsx must not contain VectorStock CDN reference"
  );
  assert.ok(
    pl4Content.includes("/default-profile.png"),
    "ProductList4.jsx must use /default-profile.png as fallback"
  );

  // 2. Amazon catalog hotlink in OrdersPage.jsx
  const ordersPagePath = path.join(
    clientRoot,
    "src/pages/User/Dropdown/OrderHistory/OrdersPage.jsx"
  );
  const ordersContent = fs.readFileSync(ordersPagePath, "utf-8");
  assert.ok(
    !ordersContent.includes("m.media-amazon.com"),
    "OrdersPage.jsx must not contain Amazon media hotlink"
  );
  assert.ok(
    ordersContent.includes("DEFAULT_ORDER_THUMBNAIL"),
    "OrdersPage.jsx must define a neutral local order thumbnail"
  );

  // 3. Freepik header banner in ProfilePage.jsx
  const profilePagePath = path.join(
    clientRoot,
    "src/components/Common/Profile/ProfilePage.jsx"
  );
  const profileContent = fs.readFileSync(profilePagePath, "utf-8");
  assert.ok(
    !profileContent.includes("img.freepik.com"),
    "ProfilePage.jsx must not contain Freepik banner image hotlink"
  );
  assert.ok(
    profileContent.includes("bg-gradient-to-r"),
    "ProfilePage.jsx must use a native CSS gradient for header"
  );
});

test("Asset Integrity - Local Lot and Banner Placeholders", () => {
  const lotSvgPath = path.join(clientRoot, "public/lot-placeholder.svg");
  const bannerSvgPath = path.join(clientRoot, "public/banner-placeholder.svg");

  assert.ok(fs.existsSync(lotSvgPath), "lot-placeholder.svg must exist in client/public");
  assert.ok(fs.existsSync(bannerSvgPath), "banner-placeholder.svg must exist in client/public");

  const lotSvgContent = fs.readFileSync(lotSvgPath, "utf-8");
  assert.ok(lotSvgContent.includes("<svg"), "lot-placeholder.svg must contain valid SVG");
  assert.ok(lotSvgContent.includes("Auction Lot"), "lot-placeholder.svg must contain auction lot branding");

  const bannerSvgContent = fs.readFileSync(bannerSvgPath, "utf-8");
  assert.ok(bannerSvgContent.includes("<svg"), "banner-placeholder.svg must contain valid SVG");
  assert.ok(bannerSvgContent.includes("AUCTIONX"), "banner-placeholder.svg must contain brand name");
});

test("Asset Integrity - Complete Elimination of via.placeholder.com", () => {
  const searchDir = path.join(clientRoot, "src");

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(jsx?|tsx?|css|html)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          !content.includes("via.placeholder.com"),
          `File ${fullPath} must not contain via.placeholder.com`
        );
      }
    }
  }

  scanDir(searchDir);
});

test("Asset Integrity - Complete Elimination of Isolated Avatar Providers", () => {
  const forbiddenDomains = [
    "i.pravatar.cc",
    "i.pinimg.com",
    "cdn.pixabay.com",
  ];

  const searchDir = path.join(clientRoot, "src");

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(jsx?|tsx?|css|html)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const domain of forbiddenDomains) {
          assert.ok(
            !content.includes(domain),
            `File ${fullPath} must not contain eliminated domain ${domain}`
          );
        }
      }
    }
  }

  scanDir(searchDir);
});

test("Asset Integrity - Complete Elimination of Commercial Marketing CDNs", () => {
  const forbiddenDomains = [
    "cdn.rareblocks.xyz",
    "w.soundcloud.com",
  ];

  const searchDir = path.join(clientRoot, "src");

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(jsx?|tsx?|css|html)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        for (const domain of forbiddenDomains) {
          assert.ok(
            !content.includes(domain),
            `File ${fullPath} must not contain eliminated domain ${domain}`
          );
        }
      }
    }
  }

  scanDir(searchDir);
});

test("Asset Integrity - Catalog Image Fallback Remediation", () => {
  const watchUrlSnippet = "photo-1523275335684-37898b6baf30";
  const filesChecked = [
    "src/components/AdminDashboard/pages/AdminAuctionsPage.jsx",
    "src/components/AdminDashboard/pages/AdminListingsPage.jsx",
    "src/components/AdminDashboard/pages/AdminOrdersPage.jsx",
    "src/pages/User/Dropdown/ScheduledBids/ScheduledBids.jsx",
  ];

  for (const relPath of filesChecked) {
    const fullPath = path.join(clientRoot, relPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(
      !content.includes(watchUrlSnippet),
      `${relPath} must not contain Unsplash watch fallback URL`
    );
    assert.ok(
      content.includes("/lot-placeholder.svg"),
      `${relPath} must reference /lot-placeholder.svg`
    );
  }

  // PendingBids Unsplash fallback
  const pendingBidsPath = path.join(
    clientRoot,
    "src/components/SellerDashboard/partials/dashboard/PendingBids/PendingBids.jsx"
  );
  const pbContent = fs.readFileSync(pendingBidsPath, "utf-8");
  assert.ok(
    !pbContent.includes("photo-1560472354-b33ff0c44a43"),
    "PendingBids.jsx must not contain Unsplash fallback"
  );
  assert.ok(
    pbContent.includes("/lot-placeholder.svg"),
    "PendingBids.jsx must reference /lot-placeholder.svg"
  );

  // DetailedOrderPage fallbacks
  const detailedOrderPath = path.join(
    clientRoot,
    "src/pages/User/Dropdown/OrderHistory/DetailedOrderPage.jsx"
  );
  const doContent = fs.readFileSync(detailedOrderPath, "utf-8");
  assert.ok(
    !doContent.includes("photo-1441986300917-64674bd600d8"),
    "DetailedOrderPage.jsx must not contain Unsplash fallback"
  );
  assert.ok(
    doContent.includes("/lot-placeholder.svg"),
    "DetailedOrderPage.jsx must reference /lot-placeholder.svg"
  );
});

test("Asset Integrity - Cloudinary Avatar Misuse Remediated", () => {
  const avatarMisuseUrl = "v1743180239/ave3utbydiwk7bkmalxa.jpg";

  // ProductList10 must not use avatar as product fallback
  const pl10Path = path.join(
    clientRoot,
    "src/components/ProductList/ProductList10/ProductList10.jsx"
  );
  const pl10Content = fs.readFileSync(pl10Path, "utf-8");
  assert.ok(
    !pl10Content.includes(avatarMisuseUrl),
    "ProductList10.jsx must not use avatar URL as lot fallback"
  );
  assert.ok(
    pl10Content.includes("/lot-placeholder.svg"),
    "ProductList10.jsx must use /lot-placeholder.svg"
  );

  // ProductList6 must not use avatar as property lot fallback
  const pl6Path = path.join(
    clientRoot,
    "src/components/ProductList/ProductList6/ProductList6.jsx"
  );
  const pl6Content = fs.readFileSync(pl6Path, "utf-8");
  assert.ok(
    !pl6Content.includes(avatarMisuseUrl),
    "ProductList6.jsx must not use avatar URL as lot fallback"
  );
  assert.ok(
    pl6Content.includes("/lot-placeholder.svg"),
    "ProductList6.jsx must use /lot-placeholder.svg for property lot fallback"
  );
  assert.ok(
    pl6Content.includes("/default-profile.png"),
    "ProductList6.jsx must use /default-profile.png for seller avatar fallback"
  );

  // ProfilePage and ProfileSettingsPage must use /default-profile.png as default
  const profilePagePath = path.join(
    clientRoot,
    "src/components/Common/Profile/ProfilePage.jsx"
  );
  const ppContent = fs.readFileSync(profilePagePath, "utf-8");
  assert.ok(
    !ppContent.includes(avatarMisuseUrl),
    "ProfilePage.jsx must not use Cloudinary avatar as default fallback"
  );

  const profileSettingsPath = path.join(
    clientRoot,
    "src/components/Common/Profile/ProfilePages/ProfileSettingsPage/ProfileSettingsPage.jsx"
  );
  const pspContent = fs.readFileSync(profileSettingsPath, "utf-8");
  assert.ok(
    !pspContent.includes(avatarMisuseUrl),
    "ProfileSettingsPage.jsx must not use Cloudinary avatar as default fallback"
  );
});

test("Asset Integrity - AvatarSelector Local Vector Avatars", () => {
  const avatarSelectorPath = path.join(
    clientRoot,
    "src/components/Common/Profile/AvatarSelector.jsx"
  );
  assert.ok(fs.existsSync(avatarSelectorPath), "AvatarSelector.jsx must exist");
  const content = fs.readFileSync(avatarSelectorPath, "utf-8");

  for (let i = 1; i <= 7; i++) {
    const avatarFilename = `avatar-${i}.svg`;
    assert.ok(
      content.includes(avatarFilename),
      `AvatarSelector must reference ${avatarFilename}`
    );
    const svgPath = path.join(clientRoot, `public/avatars/${avatarFilename}`);
    assert.ok(fs.existsSync(svgPath), `${svgPath} must physically exist`);
  }
});

test("Asset Integrity - ModalVideoPlayer Preserves Video Source & Uses Local Poster", () => {
  const playerPath = path.join(
    clientRoot,
    "src/components/Modals/ModalVideoPlayer/ModalVideoPlayer.jsx"
  );
  assert.ok(fs.existsSync(playerPath), "ModalVideoPlayer.jsx must exist");
  const content = fs.readFileSync(playerPath, "utf-8");

  assert.ok(
    !content.includes("modal-video-thumb.jpg"),
    "ModalVideoPlayer.jsx must not contain external thumbnail hotlink"
  );
  assert.ok(
    content.includes("/video-poster.svg"),
    "ModalVideoPlayer.jsx must reference /video-poster.svg"
  );
  assert.ok(
    content.includes("video.mp4"),
    "ModalVideoPlayer.jsx must preserve video.mp4 source so playback is not broken"
  );
});

test("Asset Integrity - PaymentPage Retains Razorpay Modal Logo", () => {
  const paymentPath = path.join(
    clientRoot,
    "src/pages/User/Dropdown/PaymentPage/PaymentPage.jsx"
  );
  assert.ok(fs.existsSync(paymentPath), "PaymentPage.jsx must exist");
  const content = fs.readFileSync(paymentPath, "utf-8");
  assert.ok(
    content.includes("image: ") || content.includes("image:"),
    "PaymentPage.jsx must specify a modal logo configuration"
  );
});

test("Asset Integrity - Banner4 Marketing SVGs Integrity", () => {
  const banner4Svgs = [
    "client/src/assets/images/components/Banner4/auctionxEvent.svg",
    "client/src/assets/images/components/Banner4/collectibleArtifact.svg",
    "client/src/assets/images/components/Banner4/collectibleCricket.svg",
    "client/src/assets/images/components/Banner4/collectibleFootball.svg",
    "client/src/assets/images/components/Banner4/collectibleTrophy.svg",
    "client/src/assets/images/components/Banner4/collectibleWatch.svg",
  ];

  for (const svgPath of banner4Svgs) {
    const fullPath = path.join(repoRoot, svgPath);
    assert.ok(fs.existsSync(fullPath), `Banner4 asset ${svgPath} must exist`);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(content.includes("<svg"), `${svgPath} must contain SVG markup`);
  }
});
