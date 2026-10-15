const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Deshabilitar la resolución experimental de exportaciones de paquetes
// que causa el error "Unable to resolve module stream" en Supabase Realtime en nativo
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
