import { isBrowserExtension } from './is-browser-extension';
import { settingsFrom } from './settings';
import { toBoolean } from '../../shared/type-coercions';
import { urlFromLinkTag } from './url-from-link-tag';

/**
 * @typedef {import('./settings').SettingsGetters} SettingsGetters
 * @typedef {(settings: SettingsGetters, name: string) => any} ValueGetter
 *
 * @typedef ConfigDefinition
 * @prop {ValueGetter} getValue - Method to retrieve the value from the incoming source
 * @prop {boolean} allowInBrowserExt -
 *  Allow this setting to be read in the browser extension. If this is false
 *  and browser extension context is true, use `defaultValue` if provided otherwise
 *  ignore the config key
 * @prop {any} [defaultValue] - Sets a default if `getValue` returns undefined
 * @prop {(value: any) => any} [coerce] - Transform a value's type, value or both
 *
 * @typedef {Record<string, ConfigDefinition>} ConfigDefinitionMap
 */

/**
 * Named subset of the Hypothesis client configuration that is relevant in
 * a particular context.
 *
 * @typedef {'sidebar'|'notebook'|'annotator'|'all'} Context
 */

/**
 * Returns the configuration keys that are relevant to a particular context.
 *
 * @param {Context} context
 */
function configurationKeys(context) {
  const contexts = {
    annotator: ['clientUrl', 'contentInfoBanner', 'subFrameIdentifier'],
    sidebar: [
      'appType',
      'annotations',
      'branding',
      'enableExperimentalNewNoteButton',
      'externalContainerSelector',
      'focus',
      'group',
      'onLayoutChange',
      'openSidebar',
      'query',
      'requestConfigFromFrame',
      'services',
      'showHighlights',
      'sidebarAppUrl',
      'theme',
      'usernameUrl',
    ],
    notebook: [
      'branding',
      'group',
      'notebookAppUrl',
      'requestConfigFromFrame',
      'services',
      'theme',
      'usernameUrl',
    ],
  };

  switch (context) {
    case 'annotator':
      return contexts.annotator;
    case 'sidebar':
      return contexts.sidebar;
    case 'notebook':
      return contexts.notebook;
    case 'all':
      // Complete list of configuration keys used for testing.
      return [...contexts.annotator, ...contexts.sidebar, ...contexts.notebook];
    default:
      throw new Error(`Invalid application context used: "${context}"`);
  }
}

/** @type {ValueGetter} */
function getHostPageSetting(settings, name) {
  return settings.hostPageSetting(name);
}

/**
 * Definitions of configuration keys
 *
 * @type {ConfigDefinitionMap}
 */
const configDefinitions = {
  annotations: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: settings => settings.annotations,
  },
  appType: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  branding: {
    defaultValue: null,
    allowInBrowserExt: false,
    getValue: getHostPageSetting,
  },
  // URL of the client's boot script. Used when injecting the client into
  // child iframes.
  clientUrl: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: settings => settings.clientUrl,
  },
  contentInfoBanner: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  enableExperimentalNewNoteButton: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  group: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: settings => settings.group,
  },
  focus: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  theme: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  usernameUrl: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  onLayoutChange: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  openSidebar: {
    allowInBrowserExt: true,
    defaultValue: false,
    coerce: toBoolean,
    getValue: getHostPageSetting,
  },
  query: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: settings => settings.query,
  },
  requestConfigFromFrame: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  services: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  showHighlights: {
    allowInBrowserExt: false,
    defaultValue: 'always',
    getValue: settings => settings.showHighlights,
  },
  notebookAppUrl: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: settings => settings.notebookAppUrl,
  },
  sidebarAppUrl: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: settings => settings.sidebarAppUrl,
  },
  // Sub-frame identifier given when a frame is being embedded into
  // by a top level client
  subFrameIdentifier: {
    allowInBrowserExt: true,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
  externalContainerSelector: {
    allowInBrowserExt: false,
    defaultValue: null,
    getValue: getHostPageSetting,
  },
};

/**
 * Return the subset of Hypothesis client configuration that is relevant in
 * a particular context.
 *
 * See https://h.readthedocs.io/projects/client/en/latest/publishers/config/
 * for details of all available configuration and the different ways they
 * can be included on the page. In addition to the configuration provided by
 * the embedder, the boot script also passes some additional configuration
 * to the annotator, such as URLs of the various sub-applications and the
 * boot script itself.
 *
 * @param {Context} context
 */
export function getConfig(context, window_ = window) {
  const settings = settingsFrom(window_);

  /** @type {Record<string, unknown>} */
  const config = {};

  // Filter the config based on the application context as some config values
  // may be inappropriate or erroneous for some applications.
  for (let key of configurationKeys(context)) {
    const configDef = configDefinitions[key];
    const hasDefault = configDef.defaultValue !== undefined; // A default could be null
    const isURLFromBrowserExtension = isBrowserExtension(
      urlFromLinkTag(window_, 'sidebar', 'html')
    );

    // Only allow certain values in the browser extension context
    if (!configDef.allowInBrowserExt && isURLFromBrowserExtension) {
      // If the value is not allowed here, then set to the default if provided, otherwise ignore
      // the key:value pair
      if (hasDefault) {
        config[key] = configDef.defaultValue;
      }
      continue;
    }

    // Get the value from the configuration source
    const value = configDef.getValue(settings, key);
    if (value === undefined) {
      // If there is no value (e.g. undefined), then set to the default if provided,
      // otherwise ignore the config key:value pair
      if (hasDefault) {
        config[key] = configDef.defaultValue;
      }
      continue;
    }

    // Finally, run the value through an optional coerce method
    config[key] = configDef.coerce ? configDef.coerce(value) : value;
  }

  return config;
}
