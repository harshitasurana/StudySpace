import checkDiskSpace from "check-disk-space";
import sequelize from "../../config/database.js";
import { logError } from "./logger.js";

/**
 * System Information Utility
 * 
 * Dynamically computes server/database metrics at runtime.
 * These values are read-only and never stored in the database.
 */

// Simple in-memory cache to avoid expensive queries on every request
let cache = {
  data: null,
  timestamp: 0,
};
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get the size of the current PostgreSQL database
 */
export const getDatabaseSize = async () => {
  try {
    const result = await sequelize.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
      { type: sequelize.QueryTypes.SELECT }
    );
    return result[0]?.size || "N/A";
  } catch (err) {
    logError("Failed to get database size:", err);
    return "N/A";
  }
};

/**
 * Get server disk storage usage (used / total)
 */
export const getStorageUsage = async () => {
  try {
    // Use "D:/" on Windows, "/" on Linux/Mac
    const diskPath = process.platform === "win32" ? "D:/" : "/";
    const disk = await checkDiskSpace(diskPath);

    const totalGB = (disk.size / (1024 ** 3)).toFixed(1);
    const freeGB = (disk.free / (1024 ** 3)).toFixed(1);
    const usedGB = (totalGB - freeGB).toFixed(1);

    return `${usedGB} GB / ${totalGB} GB`;
  } catch (err) {
    logError("Failed to get storage usage:", err);
    return "N/A";
  }
};

/**
 * Get the application version from environment or default
 */
export const getSystemVersion = () => {
  return process.env.APP_VERSION || "v2.5.3";
};

/**
 * Get the last updated date (current date as ISO string)
 */
export const getLastUpdated = () => {
  return new Date().toISOString().split("T")[0];
};

/**
 * Get all system information as a single object.
 * Results are cached for 60 seconds to avoid expensive queries on every request.
 */
export const getSystemInformation = async () => {
  const now = Date.now();

  // Return cached data if still valid
  if (cache.data && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache.data;
  }

  const [databaseSize, storageUsage] = await Promise.all([
    getDatabaseSize(),
    getStorageUsage(),
  ]);

  const info = {
    version: getSystemVersion(),
    last_updated: getLastUpdated(),
    database_size: databaseSize,
    storage_usage: storageUsage,
  };

  // Update cache
  cache = { data: info, timestamp: now };

  return info;
};
