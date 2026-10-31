/**
 * AuctionX Disaster Recovery & Backup Verification Harness
 *
 * Automates and verifies end-to-end database backup and restoration procedures
 * in an isolated sandbox database without touching production data.
 *
 * Safety Constraints:
 * - NEVER targets or runs against the production database 'Auction-X-Major'.
 * - Target database is strictly restricted to 'auctionx_dr_verification_sandbox'.
 * - Sandbox URI cannot equal source URI under any circumstance.
 * - Cleanup drops ONLY the sandbox database if its name strictly matches the sandbox identifier.
 * - Tests collection document counts, index definitions, and cross-collection financial invariants.
 * - Measures empirical RTO and documents the empirical vs operational RPO boundary.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

const FORBIDDEN_PROD_MARKERS = ["Auction-X-Major", "auction-x-major", "production-cluster"];
const SANDBOX_DB_NAME = "auctionx_dr_verification_sandbox";

async function runBackupAndRecoveryVerification() {
  const sourceUri = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/auctionx-test";

  // Safety Assertion 1: Guard against production database targeting
  for (const marker of FORBIDDEN_PROD_MARKERS) {
    if (sourceUri.includes(marker)) {
      console.error(`[SAFETY VIOLATION] Refusing to run DR test against production database identifier: ${marker}`);
      process.exit(1);
    }
  }

  // Construct sandbox URI
  const targetUri = sourceUri.replace(/\/[^/?]+(\?.*)?$/, `/${SANDBOX_DB_NAME}$1`);

  // Safety Assertion 2: Target must NEVER equal source URI
  if (targetUri === sourceUri) {
    console.error("[SAFETY VIOLATION] Target sandbox URI cannot be identical to source URI!");
    process.exit(1);
  }

  console.log("================================================================================");
  console.log(" AuctionX Disaster Recovery & Backup Verification Harness");
  console.log("================================================================================");
  console.log(`Source Database URI:      ${sourceUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`);
  console.log(`Target Sandbox Database:  ${SANDBOX_DB_NAME}`);
  console.log("--------------------------------------------------------------------------------");

  const startTime = Date.now();
  let sourceConn = null;
  let targetConn = null;

  try {
    // 1. Connect to Source Database
    console.log("[1/6] Connecting to source database...");
    sourceConn = await mongoose.createConnection(sourceUri).asPromise();
    console.log("      Connected to source successfully.");

    // 2. Discover Collections to Backup
    console.log("[2/6] Cataloging collections and indexing metadata...");
    const collections = await sourceConn.db.listCollections().toArray();
    const collectionNames = collections
      .map((c) => c.name)
      .filter((name) => !name.startsWith("system."));

    console.log(`      Discovered ${collectionNames.length} collections: ${collectionNames.join(", ") || "(none)"}`);

    // If source database has no collections, seed sample operational documents for verification
    if (collectionNames.length === 0) {
      console.log("      Source database empty; inserting validation baseline fixture...");
      await sourceConn.db.collection("users").insertOne({
        email: "dr_test_user@example.com",
        name: "DR Test User",
        amount: 2500,
        createdAt: new Date(),
      });
      await sourceConn.db.collection("products").insertOne({
        name: "DR Test Vintage Item",
        startingPrice: 1000,
        currentPrice: 1500,
        status: "Active",
        createdAt: new Date(),
      });
      collectionNames.push("users", "products");
    }

    // 3. Snapshot Data & Indexes (Backup Phase)
    console.log("[3/6] Executing non-blocking snapshot backup...");
    const backupStart = Date.now();
    const backupSnapshot = {};
    let latestRecordTimestamp = null;

    for (const collName of collectionNames) {
      const coll = sourceConn.db.collection(collName);
      const docs = await coll.find({}).toArray();
      const indexes = await coll.indexes();

      // Inspect latest record timestamp for point-in-time reference
      for (const doc of docs) {
        const ts = doc.updatedAt || doc.createdAt;
        if (ts instanceof Date && (!latestRecordTimestamp || ts > latestRecordTimestamp)) {
          latestRecordTimestamp = ts;
        }
      }

      backupSnapshot[collName] = {
        count: docs.length,
        docs,
        indexes: indexes.filter((idx) => idx.name !== "_id_"), // Exclude default _id index
      };
    }
    const backupDurationMs = Date.now() - backupStart;
    console.log(`      Snapshot completed in ${backupDurationMs}ms.`);

    // 4. Connect to Isolated Sandbox & Restore
    console.log("[4/6] Connecting to isolated sandbox and executing restoration...");
    const restoreStart = Date.now();

    targetConn = await mongoose.createConnection(targetUri).asPromise();

    // Verify target connection name matches sandbox name
    const actualTargetDbName = targetConn.name || targetConn.db.databaseName;
    if (actualTargetDbName !== SANDBOX_DB_NAME) {
      throw new Error(`Target database safety mismatch: expected '${SANDBOX_DB_NAME}', got '${actualTargetDbName}'`);
    }

    // Clean any prior sandbox residue
    const existingSandboxColls = await targetConn.db.listCollections().toArray();
    for (const c of existingSandboxColls) {
      await targetConn.db.collection(c.name).drop();
    }

    // Restore collections, documents, and indexes
    for (const [collName, snapshot] of Object.entries(backupSnapshot)) {
      await targetConn.db.createCollection(collName);
      const targetColl = targetConn.db.collection(collName);
      if (snapshot.docs.length > 0) {
        await targetColl.insertMany(snapshot.docs);
      }
      for (const idx of snapshot.indexes) {
        const {
          key,
          name,
          unique,
          sparse,
          background,
          weights,
          default_language,
          partialFilterExpression,
          expireAfterSeconds,
          collation,
        } = idx;
        const options = { name };
        if (unique) options.unique = true;
        if (sparse) options.sparse = true;
        if (background) options.background = true;
        if (partialFilterExpression) options.partialFilterExpression = partialFilterExpression;
        if (expireAfterSeconds !== undefined) options.expireAfterSeconds = expireAfterSeconds;
        if (collation) options.collation = collation;

        if (weights && typeof weights === "object") {
          const textKey = {};
          for (const k of Object.keys(weights)) {
            textKey[k] = "text";
          }
          options.weights = weights;
          if (default_language) options.default_language = default_language;
          await targetColl.createIndex(textKey, options);
        } else {
          await targetColl.createIndex(key, options);
        }
      }
    }
    const restoreDurationMs = Date.now() - restoreStart;
    console.log(`      Restoration completed in ${restoreDurationMs}ms.`);

    // 5. Verification Phase: Document counts, Index Integrity, Financial & Cross-Collection Invariants
    console.log("[5/6] Verifying data integrity between source and restored sandbox...");
    let verificationPassed = true;
    const verificationReport = [];

    for (const [collName, original] of Object.entries(backupSnapshot)) {
      const restoredColl = targetConn.db.collection(collName);
      const restoredCount = await restoredColl.countDocuments();
      const restoredIndexes = await restoredColl.indexes();

      const countMatch = restoredCount === original.count;
      const indexCountMatch = restoredIndexes.length === original.indexes.length + 1; // +1 for default _id

      if (!countMatch || !indexCountMatch) {
        verificationPassed = false;
      }

      verificationReport.push({
        collection: collName,
        sourceCount: original.count,
        restoredCount,
        countMatch,
        indexCountMatch,
      });
    }

    console.table(verificationReport);

    // Cross-collection Invariant Check: Total Wallet Balance Sum
    let financialInvariantPassed = true;
    if (backupSnapshot["users"] && backupSnapshot["users"].count > 0) {
      const sourceAgg = await sourceConn.db
        .collection("users")
        .aggregate([{ $group: { _id: null, totalWallet: { $sum: "$amount" } } }])
        .toArray();
      const targetAgg = await targetConn.db
        .collection("users")
        .aggregate([{ $group: { _id: null, totalWallet: { $sum: "$amount" } } }])
        .toArray();

      const sourceWallet = sourceAgg[0]?.totalWallet || 0;
      const targetWallet = targetAgg[0]?.totalWallet || 0;
      financialInvariantPassed = sourceWallet === targetWallet;
      console.log(`      Financial Invariant (Total Wallet Balance): Source ₹${sourceWallet} === Target ₹${targetWallet} [${financialInvariantPassed ? "MATCH" : "MISMATCH"}]`);
      if (!financialInvariantPassed) {
        verificationPassed = false;
      }
    }

    // Cross-collection Invariant Check: Products Active Count
    if (backupSnapshot["products"] && backupSnapshot["products"].count > 0) {
      const sourceActive = await sourceConn.db.collection("products").countDocuments({ status: "Active" });
      const targetActive = await targetConn.db.collection("products").countDocuments({ status: "Active" });
      const activeMatch = sourceActive === targetActive;
      console.log(`      Product Invariant (Active Listings): Source ${sourceActive} === Target ${targetActive} [${activeMatch ? "MATCH" : "MISMATCH"}]`);
      if (!activeMatch) {
        verificationPassed = false;
      }
    }

    // 6. Cleanup Sandbox Database (strictly verify database name before drop)
    console.log("[6/6] Cleaning up sandbox database...");
    if (actualTargetDbName === SANDBOX_DB_NAME) {
      await targetConn.db.dropDatabase();
      console.log(`      Sandbox database '${SANDBOX_DB_NAME}' cleanly dropped.`);
    } else {
      console.warn(`[SAFETY WARNING] Skipped dropDatabase: target name '${actualTargetDbName}' does not match '${SANDBOX_DB_NAME}'`);
    }

    const totalDurationMs = Date.now() - startTime;

    console.log("--------------------------------------------------------------------------------");
    console.log(" RECOVERY OBJECTIVES & VERIFICATION SUMMARY");
    console.log("--------------------------------------------------------------------------------");
    console.log(`Verification Status:       ${verificationPassed ? "VERIFIED (SUCCESS)" : "FAILED"}`);
    console.log(`Backup Elapsed Time:       ${backupDurationMs} ms`);
    console.log(`Restore Elapsed Time:      ${restoreDurationMs} ms`);
    console.log(`Total End-to-End Time:     ${totalDurationMs} ms`);
    console.log(`Demonstrated RTO (Restore): ${(restoreDurationMs / 1000).toFixed(2)} seconds`);
    console.log(`Snapshot Recovery Point:   ${latestRecordTimestamp ? latestRecordTimestamp.toISOString() : "Immediate snapshot instant"}`);
    console.log("Operational Target RPO:    NOT VERIFIED — EXTERNAL CONFIGURATION REQUIRED (Requires verification in MongoDB Atlas Continuous Cloud Backup settings)");
    console.log("Invariant Scope Note:      Sanity check of wallet sum and active listings provides partial validation, not proof of complete transactional consistency.");
    console.log("================================================================================");

    if (!verificationPassed) {
      console.error("DR Verification failed due to count, index, or invariant mismatch.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Disaster Recovery Verification Encountered Error:", error.message);
    process.exit(1);
  } finally {
    if (sourceConn) await sourceConn.close();
    if (targetConn) await targetConn.close();
  }
}

if (require.main === module) {
  runBackupAndRecoveryVerification();
}

module.exports = { runBackupAndRecoveryVerification };
