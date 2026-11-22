"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMessageListTabsStore } from "@/stores/message-list-tabs-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePolicyStore } from "@/stores/policy-store";

const registration = "company-inbox";
const categories = [
  { id: "primary", icon: "Inbox" },
  { id: "promotions", icon: "Tag", keyword: "$category-promotions" },
  { id: "social", icon: "Users", keyword: "$category-social" },
  { id: "updates", icon: "Info", keyword: "$category-updates" },
] as const;

export function MailInboxCategories() {
  const t = useTranslations("mail_categories");
  const useCategories = useSettingsStore(s => s.mvInboxType === "default");
  const keywordsEnabled = usePolicyStore(s => s.isFeatureEnabled("customKeywordsEnabled"));
  const pluginTabs = useMessageListTabsStore(s => Object.keys(s.registrations).some(id => id !== registration));

  useEffect(() => {
    if (!useCategories || !keywordsEnabled || pluginTabs) return;
    const store = useMessageListTabsStore.getState();
    store.registerTabs(registration, {
      tabs: categories.map((category, order) => ({ ...category, label: t(category.id), order })),
      mailboxRoles: ["inbox"],
    });
    return () => store.clearTabs(registration);
  }, [t, useCategories, keywordsEnabled, pluginTabs]);

  return null;
}
