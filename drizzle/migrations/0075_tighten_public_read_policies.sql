DROP POLICY IF EXISTS "reviews_read" ON public.business_reviews;
CREATE POLICY "reviews_read" ON public.business_reviews FOR SELECT USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));

DROP POLICY IF EXISTS "user_badges_read" ON public.user_badges;
CREATE POLICY "user_badges_read" ON public.user_badges FOR SELECT USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));

DROP POLICY IF EXISTS "founding_members_read" ON public.founding_members;
CREATE POLICY "founding_members_read" ON public.founding_members FOR SELECT TO anon, authenticated USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));

DROP POLICY IF EXISTS "seller_reviews_public" ON public.seller_reviews;
CREATE POLICY "seller_reviews_public" ON public.seller_reviews FOR SELECT USING (private.is_active_account(reviewer_id) OR reviewer_id = auth.uid() OR seller_id = auth.uid() OR private.is_revmate_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can read home charger reviews" ON public.home_charger_reviews;
CREATE POLICY "Anyone can read home charger reviews" ON public.home_charger_reviews FOR SELECT TO anon, authenticated USING (private.is_active_account(user_id) OR user_id = auth.uid() OR private.is_revmate_admin(auth.uid()));

DROP POLICY IF EXISTS "Cars are viewable by everyone" ON public.cars;
CREATE POLICY "Cars are viewable by everyone" ON public.cars FOR SELECT USING (status IN ('verified','unverified'));

DROP POLICY IF EXISTS "Faults are viewable by everyone" ON public.car_faults;
CREATE POLICY "Faults are viewable by everyone" ON public.car_faults FOR SELECT USING (EXISTS (SELECT 1 FROM public.cars c WHERE c.id = car_faults.car_id));

DROP POLICY IF EXISTS "make_segments_read" ON public.vehicle_make_segments;
CREATE POLICY "make_segments_read" ON public.vehicle_make_segments FOR SELECT USING (EXISTS (SELECT 1 FROM public.approved_vehicle_makes m WHERE lower(m.name) = lower(vehicle_make_segments.make)) OR private.is_revmate_admin(auth.uid()));

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read" ON public.app_settings FOR SELECT USING (key IN ('payments_enabled','shop_url','shop_label','tiktok_pixel_id','android_package','android_fingerprint','ai_diagnosis_enabled','store_enabled','store_free_delivery_over') OR private.is_revmate_admin(auth.uid()));