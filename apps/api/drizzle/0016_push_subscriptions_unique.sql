CREATE UNIQUE INDEX "push_subscriptions_user_endpoint_unique" ON "push_subscriptions" USING btree ("user_id","endpoint");
