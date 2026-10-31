/**
 * Utility to sync database documents from MongoDB Atlas to local MongoDB.
 * Useful for local development and Docker containers so all products,
 * users, banners, items, and categories are available offline.
 */

const { MongoClient } = require("mongoose").mongo;
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

async function syncAtlasToLocal() {
  const atlasUri = process.env.ATLAS_MONGODB_URI || process.env.ATLAS_MONGODB_URL;

  if (!atlasUri || typeof atlasUri !== "string" || !atlasUri.trim()) {
    console.error(
      "❌ Error: Required environment variable ATLAS_MONGODB_URI is missing or empty.\n" +
      "Set ATLAS_MONGODB_URI in your server environment (.env) before running sync:atlas."
    );
    process.exit(1);
  }

  const localUri =
    process.env.LOCAL_MONGODB_URL ||
    process.env.MONGODB_URL;

  if (!localUri || typeof localUri !== "string" || !localUri.trim()) {
    console.error(
      "❌ Error: Target MongoDB URI (LOCAL_MONGODB_URL or MONGODB_URL) is missing.\n" +
      "Set LOCAL_MONGODB_URL or MONGODB_URL in your environment before running sync:atlas."
    );
    process.exit(1);
  }

  // Safety check: ensure target local database is not inadvertently pointed at remote/Atlas
  const lowerLocal = localUri.toLowerCase();
  if (
    lowerLocal.includes("mongodb+srv") ||
    lowerLocal.includes(".net") ||
    lowerLocal.includes("atlas")
  ) {
    console.error(
      "❌ CRITICAL SAFETY ERROR: Target database points to a remote cluster. Refusing to run destructive sync."
    );
    process.exit(1);
  }

  console.log("Connecting to Atlas source database...");
  console.log("Connecting to local target database...");

  const atlasClient = new MongoClient(atlasUri);
  const localClient = new MongoClient(localUri);

  try {
    await atlasClient.connect();
    await localClient.connect();

    const atlasDb = atlasClient.db();
    const localDb = localClient.db();

    const collections = await atlasDb.listCollections().toArray();
    console.log(`Discovered ${collections.length} collections in Atlas.`);

    for (const { name } of collections) {
      if (name.startsWith("system.")) continue;

      const docs = await atlasDb.collection(name).find({}).toArray();
      if (docs.length > 0) {
        const localCol = localDb.collection(name);
        await localCol.deleteMany({});
        await localCol.insertMany(docs);
        console.log(`✓ Synced collection "${name}": ${docs.length} documents.`);
      } else {
        console.log(`- Collection "${name}" is empty, skipped.`);
      }
    }

    console.log("\nDatabase synchronization completed successfully!");
  } catch (error) {
    const safeErrorMessage =
      error && error.message
        ? error.message.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://[REDACTED]@")
        : "An unexpected error occurred during database sync.";
    console.error("Database sync failed:", safeErrorMessage);
    process.exit(1);
  } finally {
    if (atlasClient) await atlasClient.close().catch(() => {});
    if (localClient) await localClient.close().catch(() => {});
  }
}

if (require.main === module) {
  syncAtlasToLocal();
}

module.exports = syncAtlasToLocal;
