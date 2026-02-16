const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * Polyfill for Array.prototype.toReversed which is missing in Node.js < 20
 * but required by some dependencies in the current environment.
 */
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
