import test from "node:test";
import assert from "node:assert/strict";
import {
  getOptimizedImageUrl,
  getResponsiveSrcSet,
  getOptimizedThumbnail,
  getOptimizedCardImage,
  getOptimizedDetailImage,
} from "../src/utils/imageOptimizer.js";

test("Image Optimizer Suite — URL Transformations and Edge Cases", async (t) => {
  await t.test("1. Handles null, undefined, empty, and non-string inputs safely", () => {
    assert.equal(getOptimizedImageUrl(null), "");
    assert.equal(getOptimizedImageUrl(undefined), "");
    assert.equal(getOptimizedImageUrl(""), "");
    assert.equal(getResponsiveSrcSet(null), undefined);
    assert.equal(getResponsiveSrcSet(undefined), undefined);
  });

  await t.test("2. Transforms Unsplash URLs with width, quality, and auto format", () => {
    const rawUrl = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80";
    const thumb = getOptimizedThumbnail(rawUrl, 160);
    assert.match(thumb, /w=160/);
    assert.match(thumb, /auto=format/);
    assert.match(thumb, /q=75/);

    const card = getOptimizedCardImage(rawUrl, 450);
    assert.match(card, /w=450/);
    assert.match(card, /q=80/);

    const detail = getOptimizedDetailImage(rawUrl, 900);
    assert.match(detail, /w=900/);
  });

  await t.test("3. Generates responsive srcset for Unsplash URLs", () => {
    const rawUrl = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80";
    const srcset = getResponsiveSrcSet(rawUrl, [360, 720, 1080]);
    assert.ok(srcset);
    assert.match(srcset, /w=360.*360w/);
    assert.match(srcset, /w=720.*720w/);
    assert.match(srcset, /w=1080.*1080w/);
  });

  await t.test("4. Transforms Cloudinary URLs with f_auto, q_auto/quality, and dimensions", () => {
    const rawUrl = "https://res.cloudinary.com/auctionx/image/upload/v12345/product_1.jpg";
    const thumb = getOptimizedThumbnail(rawUrl, 150);
    assert.match(thumb, /\/image\/upload\/f_auto,q_75,c_fill,w_150,h_150\/v12345\/product_1\.jpg/);

    const card = getOptimizedCardImage(rawUrl, 450);
    assert.match(card, /\/image\/upload\/f_auto,q_80,c_limit,w_450\/v12345\/product_1\.jpg/);

    const detail = getOptimizedDetailImage(rawUrl, 900);
    assert.match(detail, /\/image\/upload\/f_auto,q_80,c_limit,w_900\/v12345\/product_1\.jpg/);
  });

  await t.test("5. Generates responsive srcset for Cloudinary URLs", () => {
    const rawUrl = "https://res.cloudinary.com/auctionx/image/upload/v12345/product_1.jpg";
    const srcset = getResponsiveSrcSet(rawUrl, [400, 800, 1200]);
    assert.ok(srcset);
    assert.match(srcset, /w_400.*400w/);
    assert.match(srcset, /w_800.*800w/);
    assert.match(srcset, /w_1200.*1200w/);
  });

  await t.test("6. Passes unmanaged local and relative URLs through without corruption", () => {
    const localUrl = "/assets/logo.png";
    assert.equal(getOptimizedImageUrl(localUrl), localUrl);
    assert.equal(getOptimizedThumbnail(localUrl), localUrl);
    assert.equal(getResponsiveSrcSet(localUrl), undefined);

    const externalUrl = "https://example.com/image.png";
    assert.equal(getOptimizedImageUrl(externalUrl), externalUrl);
    assert.equal(getResponsiveSrcSet(externalUrl), undefined);
  });
});
