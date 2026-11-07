const fs = require("fs");

const origReadlink = fs.readlink;
const origReadlinkSync = fs.readlinkSync;
const origPromisesReadlink = fs.promises.readlink;

fs.readlink = function (...args) {
  const cb = args[args.length - 1];
  if (typeof cb === "function") {
    args[args.length - 1] = (err, linkString) => {
      if (err && (err.code === "EISDIR" || err.code === "UNKNOWN")) {
        err.code = "EINVAL";
      }
      cb(err, linkString);
    };
  }
  return origReadlink.apply(this, args);
};

fs.readlinkSync = function (...args) {
  try {
    return origReadlinkSync.apply(this, args);
  } catch (err) {
    if (err && (err.code === "EISDIR" || err.code === "UNKNOWN")) {
      err.code = "EINVAL";
    }
    throw err;
  }
};

fs.promises.readlink = async function (...args) {
  try {
    return await origPromisesReadlink.apply(this, args);
  } catch (err) {
    if (err && (err.code === "EISDIR" || err.code === "UNKNOWN")) {
      err.code = "EINVAL";
    }
    throw err;
  }
};
