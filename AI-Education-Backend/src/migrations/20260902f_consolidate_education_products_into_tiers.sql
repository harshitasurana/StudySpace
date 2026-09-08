-- Corrects the paywall data model per explicit product direction: Education
-- is ONE product (reusing product_id 3, "Myntiq-Education" — already the
-- app's own product-line row, used by Help Center's product scoping), not
-- three separate Free/Pro/School product rows. Free/Pro/School become a
-- plan_tier attribute on the SUBSCRIPTION (and on the per-tier
-- ProductFeature/ProductPricing rows under that one product) instead.
--
-- plan_tier is nullable everywhere: product_id 3 already carries ~63
-- ProductFeature rows for an unrelated concern (admin-panel RBAC feature
-- toggles — dashboard/sidebar/roles/etc, NULL tier, untouched by this
-- migration) alongside the new tier-scoped student paywall rows added
-- here, so the two concerns coexist in the same table without collision.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(10);
ALTER TABLE product_features ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(10);
ALTER TABLE product_pricing ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(10);

-- product_features had a pre-existing UNIQUE(product_id, feature_id) —
-- correct back when each tier was its own product, but it blocks exactly
-- what re-homing onto ONE product needs: three tier rows for the same
-- feature_id (283 for ai_tutor, etc.) all under product_id 3. Widen it to
-- include plan_tier before the re-home UPDATEs below, or the Pro/School
-- rows fail to move and then get CASCADE-DELETEd when the old product
-- rows are dropped at the end (hit exactly this running it live — this
-- statement is what avoids it on a clean environment).
ALTER TABLE product_features DROP CONSTRAINT IF EXISTS product_features_product_id_feature_id_key;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_features_product_id_feature_id_tier_key') THEN
    ALTER TABLE product_features ADD CONSTRAINT product_features_product_id_feature_id_tier_key
      UNIQUE (product_id, feature_id, plan_tier);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_tier_check') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_tier_check
      CHECK (plan_tier IS NULL OR plan_tier IN ('Free', 'Pro', 'School'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_features_plan_tier_check') THEN
    ALTER TABLE product_features ADD CONSTRAINT product_features_plan_tier_check
      CHECK (plan_tier IS NULL OR plan_tier IN ('Free', 'Pro', 'School'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_pricing_plan_tier_check') THEN
    ALTER TABLE product_pricing ADD CONSTRAINT product_pricing_plan_tier_check
      CHECK (plan_tier IS NULL OR plan_tier IN ('Free', 'Pro', 'School'));
  END IF;
END $$;

-- Re-home the tier-specific ProductFeature/ProductPricing rows onto the
-- single Education product (3), tagging each with the tier it came from —
-- in place, so existing product_feature_id/pricing_id history is kept
-- rather than duplicated.
UPDATE product_features SET product_id = 3, plan_tier = 'Free'   WHERE product_id = 4;
UPDATE product_features SET product_id = 3, plan_tier = 'Pro'    WHERE product_id = 5;
UPDATE product_features SET product_id = 3, plan_tier = 'School' WHERE product_id = 6;

UPDATE product_pricing SET product_id = 3, plan_tier = 'Free'   WHERE product_id = 4;
UPDATE product_pricing SET product_id = 3, plan_tier = 'Pro'    WHERE product_id = 5;
UPDATE product_pricing SET product_id = 3, plan_tier = 'School' WHERE product_id = 6;

-- Any existing subscription that pointed at one of the three tier
-- products now points at the one Education product, tagged with its tier.
UPDATE subscriptions SET product_id = 3, plan_tier = 'Free'   WHERE product_id = 4;
UPDATE subscriptions SET product_id = 3, plan_tier = 'Pro'    WHERE product_id = 5;
UPDATE subscriptions SET product_id = 3, plan_tier = 'School' WHERE product_id = 6;

-- The three now-empty tier products are gone — Free/Pro/School are
-- subscriptions, not products (confirmed: no product_addons/
-- product_translations/product_languages rows reference them).
DELETE FROM products WHERE product_id IN (4, 5, 6);
