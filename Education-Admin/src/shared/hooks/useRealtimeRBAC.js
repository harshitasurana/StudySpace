import { useEffect } from "react";
import {
  onRealtimeEvent,
  isRelevantFeatureChange,
} from "../../services/realtimeService.js";

export const FEATURES_CHANGED_EVENT = "hc:features-changed";

const safeRefresh = (onRefreshRBAC) => {
  if (typeof onRefreshRBAC !== "function") return;
  const result = onRefreshRBAC();
  if (result && typeof result.catch === "function") {
    result.catch((err) => console.error("Realtime RBAC refresh failed:", err));
  }
};

/**
 * Subscribes to backend realtime broadcasts (feature status changes and role
 * permission edits) so the admin UI refreshes RBAC instantly and notifies
 * components (via the `hc:features-changed` window event) to reload their data.
 */
export const useRealtimeRBAC = (onRefreshRBAC) => {
  useEffect(() => {
    const offFeature = onRealtimeEvent("feature:status-changed", (change) => {
      if (!isRelevantFeatureChange(change)) return;
      window.dispatchEvent(
        new CustomEvent(FEATURES_CHANGED_EVENT, { detail: change }),
      );
      safeRefresh(onRefreshRBAC);
    });

    const offRole = onRealtimeEvent("role-permissions-changed", () => {
      safeRefresh(onRefreshRBAC);
    });

    return () => {
      offFeature();
      offRole();
    };
  }, [onRefreshRBAC]);
};
