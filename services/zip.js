/**
 * Minimal ZIP writer (STORE method, no compression).
 * Generates a ZIP buffer from an array of { name, data } where data is Buffer or string.
 */
function crc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crc32Table();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date = new Date()) {
  const y = date.getFullYear() - 1980;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const mi = date.getMinutes();
  const s = date.getSeconds() >> 1;
  return ((y << 25) | (m << 21) | (d << 16) | (h << 11) | (mi << 5) | s) >>> 0;
}

function writeU16(buf, offset, val) { buf[offset] = val & 0xFF; buf[offset + 1] = (val >> 8) & 0xFF; }
function writeU32(buf, offset, val) { buf[offset] = val & 0xFF; buf[offset + 1] = (val >> 8) & 0xFF; buf[offset + 2] = (val >> 16) & 0xFF; buf[offset + 3] = (val >> 24) & 0xFF; }

function makeZip(files) {
  // files: [{ name: string, data: Buffer|string }]
  const now = dosDateTime();
  const localHeaders = [];
  const centralDirs = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const dataBuf = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const crc = crc32(dataBuf);
    const compressedSize = dataBuf.length;
    const uncompressedSize = dataBuf.length;

    // Local file header
    const lh = Buffer.alloc(30 + nameBuf.length);
    writeU32(lh, 0, 0x04034b50); // signature
    writeU16(lh, 4, 20); // version needed
    writeU16(lh, 6, 0x0800); // general purpose bit flag (UTF-8)
    writeU16(lh, 8, 0); // compression method (0 = store)
    writeU16(lh, 10, now & 0xFFFF); // last mod time
    writeU16(lh, 12, now >> 16); // last mod date
    writeU32(lh, 14, crc);
    writeU32(lh, 18, compressedSize);
    writeU32(lh, 22, uncompressedSize);
    writeU16(lh, 26, nameBuf.length);
    writeU16(lh, 28, 0); // extra field length
    nameBuf.copy(lh, 30);
    localHeaders.push(lh);
    localHeaders.push(dataBuf);

    // Central directory entry
    const cd = Buffer.alloc(46 + nameBuf.length);
    writeU32(cd, 0, 0x02014b50); // signature
    writeU16(cd, 4, 45); // version made by
    writeU16(cd, 6, 20); // version needed
    writeU16(cd, 8, 0x0800); // flags
    writeU16(cd, 10, 0); // compression
    writeU16(cd, 12, now & 0xFFFF);
    writeU16(cd, 14, now >> 16);
    writeU32(cd, 16, crc);
    writeU32(cd, 20, compressedSize);
    writeU32(cd, 24, uncompressedSize);
    writeU16(cd, 28, nameBuf.length);
    writeU16(cd, 30, 0); // extra field
    writeU16(cd, 32, 0); // file comment
    writeU16(cd, 34, 0); // disk number start
    writeU16(cd, 36, 0); // internal attrs
    writeU32(cd, 38, 0x81A40000); // external attrs (regular file, 0644)
    writeU32(cd, 42, offset); // local header offset
    nameBuf.copy(cd, 46);
    centralDirs.push(cd);
    offset += lh.length + dataBuf.length;
  }

  // End of central directory record
  const totalCentralSize = centralDirs.reduce((s, c) => s + c.length, 0);
  const eocd = Buffer.alloc(22);
  writeU32(eocd, 0, 0x06054b50); // signature
  writeU16(eocd, 4, 0); // disk number
  writeU16(eocd, 6, 0); // central dir disk
  writeU16(eocd, 8, files.length); // entries on this disk
  writeU16(eocd, 10, files.length); // total entries
  writeU32(eocd, 12, totalCentralSize);
  writeU32(eocd, 16, offset);
  writeU16(eocd, 20, 0); // comment length

  // Concatenate all parts
  const parts = [...localHeaders, ...centralDirs, eocd];
  return Buffer.concat(parts);
}

/** Build the preconfigured aether-fivem.zip with the given secret and guildId. */
function buildFivemZip(secret, guildId) {
  const fs = require('fs');
  const path = require('path');
  const repoRoot = path.resolve(__dirname, '..');
  const root = path.join(repoRoot, 'fivem', 'aether_fivem');
  const files = [
    'fxmanifest.lua',
    'config.lua',
    'server.lua',
    'client.lua',
    'README.md',
  ].map((name) => ({
    name,
    data: fs.readFileSync(path.join(root, name), 'utf8')
      .replace(/REPLACE_ME/g, secret)
      .replace(/GUILD_ID_PLACEHOLDER/g, guildId),
  }));
  return makeZip(files);
}

module.exports = { makeZip, buildFivemZip };