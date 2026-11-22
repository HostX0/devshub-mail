import { englishExtensionText, type ExtensionTranslator } from './extension-translations';

/**
 * What a plugin's manifest type means, for the admin pages: the raw values
 * (`ui-extension`, `hook`) are developer words.
 */
export function pluginTypeLabel(type: string | null | undefined, tr: ExtensionTranslator = englishExtensionText): string {
  switch (type) {
    case 'ui-extension': return tr('Adds to the interface');
    case 'hook': return tr('Works in the background');
    case 'sidebar-app': return tr('Adds an app to the sidebar');
    case 'theme': return tr('Theme');
    default: return tr('Plugin');
  }
}
