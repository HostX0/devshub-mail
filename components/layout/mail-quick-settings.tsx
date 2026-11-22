"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { X } from "@/components/icons";
import { useSettingsStore, type Density } from "@/stores/settings-store";
import { useThemeStore } from "@/stores/theme-store";
import { usePolicyStore } from "@/stores/policy-store";

export function MailQuickSettings({ close }: { close: () => void }) {
  const t = useTranslations("quick_mail_settings");
  const appearance = useTranslations("settings.appearance");
  const density = useSettingsStore(s => s.density);
  const update = useSettingsStore(s => s.updateSetting);
  const { theme, setTheme } = useThemeStore();
  const { isSettingLocked, isSettingHidden, getColorModePolicy } = usePolicyStore();
  const densities: Density[] = ["regular", "comfortable", "compact", "extra-compact"];

  return (
    <aside id="mail-quick-settings" aria-label={t("title")} className="mail-quick-settings shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <button type="button" aria-label={t("close")} onClick={close} className="grid size-10 place-items-center rounded-full hover:bg-muted"><X className="size-5" /></button>
      </div>
      <Link href="/settings/general" className="my-3 block rounded-full border border-border px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-muted">{t("all")}</Link>
      {!isSettingHidden("density") && (
        <fieldset disabled={isSettingLocked("density")} className="mail-quick-options">
          <legend>{appearance("list_density.label")}</legend>
          {densities.map(value => (
            <label key={value}>
              <input type="radio" name="quick-density" checked={density === value} onChange={() => update("density", value)} />
              {appearance(`list_density.${value.replace("-", "_")}`)}
              <span aria-hidden="true" className={`quick-density-sample sample-${value}`}><i /><i /><i /></span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset disabled={getColorModePolicy().locked} className="mail-quick-options">
        <legend>{appearance("theme.label")}</legend>
        {(["system", "light", "dark"] as const).map(value => (
          <label key={value}>
            <input type="radio" name="quick-theme" checked={theme === value} onChange={() => setTheme(value)} />
            {appearance(`theme.${value}`)}
          </label>
        ))}
      </fieldset>
    </aside>
  );
}
