const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");

module.exports = function load(file, mocks = {}) {
  file = path.resolve(file);
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const original = loaded.require.bind(loaded);
  loaded.require = (name) => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    if (name.startsWith(".")) {
      let dependency = path.resolve(path.dirname(file), name);
      if (!fs.existsSync(dependency)) dependency += ".js";
      return load(dependency, mocks);
    }
    return original(name);
  };
  const { code } = babel.transformFileSync(file, { presets: [["@babel/preset-env", { modules: "commonjs" }], "@babel/preset-react"], babelrc: false });
  loaded._compile(code, file);
  return loaded.exports;
};
