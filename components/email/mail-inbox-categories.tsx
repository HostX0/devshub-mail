"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMessageListTabsStore } from "@/stores/message-list-tabs-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePolicyStore } from "@/stores/policy-store";

import { inboxCategories, inboxRegistration } from "@/lib/company-inbox-categories";

export function MailInboxCategories() {
  const t = useTranslations("mail_categories");
  const useCategories = useSettingsStore(s => s.mvInboxType === "default");
  const keywordsEnabled = usePolicyStore(s => s.isFeatureEnabled("customKeywordsEnabled"));
  const hidden = useSettingsStore(s => s.hiddenInboxCategories);
  const pluginTabs = useMessageListTabsStore(s => Object.keys(s.registrations).some(id => id !== inboxRegistration));

  useEffect(() => {
    if (!useCategories || !keywordsEnabled || pluginTabs) return;
    const visible = inboxCategories.filter(category => category.id === "primary" || !hidden.includes(category.id));
    if (visible.length < 2) return;
    const store = useMessageListTabsStore.getState();
    store.registerTabs(inboxRegistration, {
      tabs: visible.map((category, order) => ({ ...category, label: t(category.id), order })),
      mailboxRoles: ["inbox"],
    });
    return () => store.clearTabs(inboxRegistration);
  }, [t, useCategories, keywordsEnabled, pluginTabs, hidden]);

  return null;
}
