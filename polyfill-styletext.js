const util = require('util');

if (!util.styleText) {
  util.styleText = function(format, text) {
    // Fallback simple que no aplica estilos pero evita que explote el bundler Metro
    return text;
  };
}
