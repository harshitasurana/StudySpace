import { Router } from "express";
import { authenticate, authorize } from "../../../common/middlewares/auth_middleware.js";
import {
  listKeysController,
  getKeyController,
  createKeyController,
  updateKeyController,
  deleteKeyController,
  toggleKeyController,
  getActiveKeysInternalController,
  getProviderCatalogController,
  getActiveProviderController,
  setActiveProviderController,
  getActiveProviderInternalController,
} from "./ai_provider_keys.controller.js";

// Same shared secret Node uses calling OUT to RAGProductionApp
// (ai_service_client.js) and RAGProductionApp already uses to verify
// Node's inbound calls (e.g. ingestion_routes.js) — reused here in
// reverse so Python can call IN to fetch active keys.
const verifyServiceKey = (req, res, next) => {
  const expected = process.env.AI_SERVICE_KEY;
  const provided = req.headers["x-service-key"];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: "Invalid or missing service key" });
  }
  return next();
};

const router = Router();

// Internal — RAGProductionApp's core/llm_provider.py polls these on a
// short cache TTL to know which provider is active and fetch its keys,
// before falling back to Ollama. Must stay ahead of the authenticate()
// gate below.
router.get("/internal/active", verifyServiceKey, getActiveKeysInternalController);
router.get("/internal/active-provider", verifyServiceKey, getActiveProviderInternalController);

router.use(authenticate, authorize(["super_admin"]));

router.get("/catalog", getProviderCatalogController);
router.get("/active-provider", getActiveProviderController);
router.put("/active-provider", setActiveProviderController);

router.get("/", listKeysController);
router.get("/:id", getKeyController);
router.post("/", createKeyController);
router.put("/:id", updateKeyController);
router.delete("/:id", deleteKeyController);
router.post("/:id/toggle", toggleKeyController);

export default router;
