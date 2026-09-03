const ERROR_LEVEL_M = 0;
const PAD0 = 0xec;
const PAD1 = 0x11;

const ALIGNMENT_POSITIONS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// Error-correction level M, QR versions 1-10.
// Each entry is [block count, total codewords, data codewords].
const RS_BLOCKS_M = [
  [[1, 26, 16]],
  [[1, 44, 28]],
  [[1, 70, 44]],
  [[2, 50, 32]],
  [[2, 67, 43]],
  [[4, 43, 27]],
  [[4, 49, 31]],
  [[2, 60, 38], [2, 61, 39]],
  [[3, 58, 36], [2, 59, 37]],
  [[4, 69, 43], [1, 70, 44]],
];

const EXP = new Array(512).fill(0);
const LOG = new Array(256).fill(0);

for (let index = 0; index < 8; index += 1) EXP[index] = 1 << index;
for (let index = 8; index < 256; index += 1) {
  EXP[index] = EXP[index - 4] ^ EXP[index - 5] ^ EXP[index - 6] ^ EXP[index - 8];
}
for (let index = 0; index < 255; index += 1) LOG[EXP[index]] = index;
for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255];

function gexp(value) {
  while (value < 0) value += 255;
  return EXP[value % 255];
}

function glog(value) {
  if (value < 1) throw new Error("QR_GALOIS_LOG_INVALID");
  return LOG[value];
}

function multiplyPolynomials(left, right) {
  const output = new Array(left.length + right.length - 1).fill(0);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      if (!left[leftIndex] || !right[rightIndex]) continue;
      output[leftIndex + rightIndex] ^= gexp(glog(left[leftIndex]) + glog(right[rightIndex]));
    }
  }
  return output;
}

function errorCorrectionPolynomial(length) {
  let polynomial = [1];
  for (let index = 0; index < length; index += 1) {
    polynomial = multiplyPolynomials(polynomial, [1, gexp(index)]);
  }
  return polynomial;
}

function polynomialRemainder(data, divisor) {
  const output = data.slice();
  for (let offset = 0; offset <= output.length - divisor.length; offset += 1) {
    const leading = output[offset];
    if (!leading) continue;
    const ratio = glog(leading) - glog(divisor[0]);
    for (let index = 0; index < divisor.length; index += 1) {
      if (!divisor[index]) continue;
      output[offset + index] ^= gexp(glog(divisor[index]) + ratio);
    }
  }
  return output.slice(output.length - divisor.length + 1);
}

class BitBuffer {
  constructor() {
    this.bytes = [];
    this.length = 0;
  }

  put(value, length) {
    for (let index = length - 1; index >= 0; index -= 1) {
      this.putBit(((value >>> index) & 1) === 1);
    }
  }

  putBit(bit) {
    const byteIndex = Math.floor(this.length / 8);
    if (this.bytes.length <= byteIndex) this.bytes.push(0);
    if (bit) this.bytes[byteIndex] |= 0x80 >> (this.length % 8);
    this.length += 1;
  }
}

function blocksFor(version) {
  const specification = RS_BLOCKS_M[version - 1];
  if (!specification) throw new Error("QR_VERSION_UNSUPPORTED");

  const blocks = [];
  for (const [count, total, data] of specification) {
    for (let index = 0; index < count; index += 1) blocks.push({ total, data });
  }
  return blocks;
}

function makeCodewords(version, inputBytes) {
  const blocks = blocksFor(version);
  const dataCapacity = blocks.reduce((sum, block) => sum + block.data, 0);
  const bits = new BitBuffer();

  bits.put(4, 4); // Byte mode.
  bits.put(inputBytes.length, version < 10 ? 8 : 16);
  for (const byte of inputBytes) bits.put(byte, 8);

  if (bits.length > dataCapacity * 8) throw new Error("QR_DATA_TOO_LONG");
  if (bits.length + 4 <= dataCapacity * 8) bits.put(0, 4);
  while (bits.length % 8) bits.putBit(false);

  let useFirstPad = true;
  while (bits.bytes.length < dataCapacity) {
    bits.bytes.push(useFirstPad ? PAD0 : PAD1);
    useFirstPad = !useFirstPad;
  }

  let offset = 0;
  let maxDataLength = 0;
  let maxErrorLength = 0;
  const dataBlocks = [];
  const errorBlocks = [];

  for (const block of blocks) {
    const data = bits.bytes.slice(offset, offset + block.data);
    offset += block.data;

    const errorCount = block.total - block.data;
    const divisor = errorCorrectionPolynomial(errorCount);
    const remainder = polynomialRemainder(data.concat(new Array(errorCount).fill(0)), divisor);
    const error = new Array(errorCount - remainder.length).fill(0).concat(remainder);

    dataBlocks.push(data);
    errorBlocks.push(error);
    maxDataLength = Math.max(maxDataLength, data.length);
    maxErrorLength = Math.max(maxErrorLength, error.length);
  }

  const result = [];
  for (let index = 0; index < maxDataLength; index += 1) {
    for (const block of dataBlocks) if (index < block.length) result.push(block[index]);
  }
  for (let index = 0; index < maxErrorLength; index += 1) {
    for (const block of errorBlocks) if (index < block.length) result.push(block[index]);
  }
  return result;
}

function bchDigit(value) {
  let digit = 0;
  while (value) {
    digit += 1;
    value >>>= 1;
  }
  return digit;
}

function bchTypeInfo(data) {
  const generator = 0x537;
  let value = data << 10;
  while (bchDigit(value) - bchDigit(generator) >= 0) {
    value ^= generator << (bchDigit(value) - bchDigit(generator));
  }
  return ((data << 10) | value) ^ 0x5412;
}

function bchTypeNumber(data) {
  const generator = 0x1f25;
  let value = data << 12;
  while (bchDigit(value) - bchDigit(generator) >= 0) {
    value ^= generator << (bchDigit(value) - bchDigit(generator));
  }
  return (data << 12) | value;
}

function maskBit(pattern, row, column) {
  switch (pattern) {
    case 0: return (row + column) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return column % 3 === 0;
    case 3: return (row + column) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5: return (row * column) % 2 + (row * column) % 3 === 0;
    case 6: return ((row * column) % 2 + (row * column) % 3) % 2 === 0;
    case 7: return ((row * column) % 3 + (row + column) % 2) % 2 === 0;
    default: throw new Error("QR_MASK_INVALID");
  }
}

function blankMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function setupFinder(matrix, row, column) {
  const size = matrix.length;
  for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
    const targetRow = row + rowOffset;
    if (targetRow < 0 || targetRow >= size) continue;

    for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
      const targetColumn = column + columnOffset;
      if (targetColumn < 0 || targetColumn >= size) continue;

      matrix[targetRow][targetColumn] = (
        rowOffset >= 0 && rowOffset <= 6 && (columnOffset === 0 || columnOffset === 6)
      ) || (
        columnOffset >= 0 && columnOffset <= 6 && (rowOffset === 0 || rowOffset === 6)
      ) || (
        rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4
      );
    }
  }
}

function setupTiming(matrix) {
  const size = matrix.length;
  for (let index = 8; index < size - 8; index += 1) {
    if (matrix[index][6] === null) matrix[index][6] = index % 2 === 0;
    if (matrix[6][index] === null) matrix[6][index] = index % 2 === 0;
  }
}

function setupAlignment(matrix, version) {
  const positions = ALIGNMENT_POSITIONS[version - 1];
  for (const row of positions) {
    for (const column of positions) {
      if (matrix[row][column] !== null) continue;
      for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
        for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
          matrix[row + rowOffset][column + columnOffset] = (
            Math.abs(rowOffset) === 2
            || Math.abs(columnOffset) === 2
            || (rowOffset === 0 && columnOffset === 0)
          );
        }
      }
    }
  }
}

function setupTypeNumber(matrix, version, test) {
  if (version < 7) return;
  const bits = bchTypeNumber(version);
  const size = matrix.length;

  for (let index = 0; index < 18; index += 1) {
    const dark = !test && ((bits >> index) & 1) === 1;
    matrix[Math.floor(index / 3)][index % 3 + size - 11] = dark;
    matrix[index % 3 + size - 11][Math.floor(index / 3)] = dark;
  }
}

function setupTypeInfo(matrix, mask, test) {
  const data = (ERROR_LEVEL_M << 3) | mask;
  const bits = bchTypeInfo(data);
  const size = matrix.length;

  for (let index = 0; index < 15; index += 1) {
    const dark = !test && ((bits >> index) & 1) === 1;

    if (index < 6) matrix[index][8] = dark;
    else if (index < 8) matrix[index + 1][8] = dark;
    else matrix[size - 15 + index][8] = dark;

    if (index < 8) matrix[8][size - index - 1] = dark;
    else if (index < 9) matrix[8][15 - index] = dark;
    else matrix[8][15 - index - 1] = dark;
  }
  matrix[size - 8][8] = !test;
}

function mapData(matrix, codewords, mask) {
  const size = matrix.length;
  let row = size - 1;
  let increment = -1;
  let byteIndex = 0;
  let bitIndex = 7;

  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;

    for (;;) {
      for (let offset = 0; offset < 2; offset += 1) {
        const targetColumn = column - offset;
        if (matrix[row][targetColumn] !== null) continue;

        let dark = false;
        if (byteIndex < codewords.length) dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
        if (maskBit(mask, row, targetColumn)) dark = !dark;
        matrix[row][targetColumn] = dark;

        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }

      row += increment;
      if (row < 0 || row >= size) {
        row -= increment;
        increment = -increment;
        break;
      }
    }
  }
}

function makeMatrix(version, codewords, mask, test = false) {
  const size = version * 4 + 17;
  const matrix = blankMatrix(size);

  setupFinder(matrix, 0, 0);
  setupFinder(matrix, size - 7, 0);
  setupFinder(matrix, 0, size - 7);
  setupAlignment(matrix, version);
  setupTiming(matrix);
  setupTypeInfo(matrix, mask, test);
  setupTypeNumber(matrix, version, test);
  mapData(matrix, codewords, mask);

  return matrix;
}

function penalty(matrix) {
  const size = matrix.length;
  let lost = 0;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let same = 0;
      const dark = matrix[row][column];
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) continue;
          const targetRow = row + rowOffset;
          const targetColumn = column + columnOffset;
          if (
            targetRow >= 0 && targetRow < size
            && targetColumn >= 0 && targetColumn < size
            && matrix[targetRow][targetColumn] === dark
          ) same += 1;
        }
      }
      if (same > 5) lost += 3 + same - 5;
    }
  }

  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const count = (matrix[row][column] ? 1 : 0)
        + (matrix[row + 1][column] ? 1 : 0)
        + (matrix[row][column + 1] ? 1 : 0)
        + (matrix[row + 1][column + 1] ? 1 : 0);
      if (count === 0 || count === 4) lost += 3;
    }
  }

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size - 6; column += 1) {
      if (
        matrix[row][column]
        && !matrix[row][column + 1]
        && matrix[row][column + 2]
        && matrix[row][column + 3]
        && matrix[row][column + 4]
        && !matrix[row][column + 5]
        && matrix[row][column + 6]
      ) lost += 40;
    }
  }

  for (let column = 0; column < size; column += 1) {
    for (let row = 0; row < size - 6; row += 1) {
      if (
        matrix[row][column]
        && !matrix[row + 1][column]
        && matrix[row + 2][column]
        && matrix[row + 3][column]
        && matrix[row + 4][column]
        && !matrix[row + 5][column]
        && matrix[row + 6][column]
      ) lost += 40;
    }
  }

  let darkCount = 0;
  for (const row of matrix) for (const cell of row) if (cell) darkCount += 1;
  lost += (Math.abs(100 * darkCount / (size * size) - 50) / 5) * 10;

  return lost;
}

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let version = 1;
  let codewords = null;

  for (; version <= 10; version += 1) {
    try {
      codewords = makeCodewords(version, bytes);
      break;
    } catch (error) {
      if (error.message !== "QR_DATA_TOO_LONG") throw error;
    }
  }

  if (!codewords) throw new Error("QR_DATA_TOO_LONG");

  let bestMatrix = null;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = makeMatrix(version, codewords, mask);
    const score = penalty(candidate);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMatrix = candidate;
    }
  }

  return bestMatrix;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

export function qrSvg(text, { size = 320, margin = 4, dark = "#000000", light = "#ffffff" } = {}) {
  const matrix = qrMatrix(text);
  const moduleCount = matrix.length;
  const dimension = moduleCount + margin * 2;
  const rectangles = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (matrix[row][column]) {
        rectangles.push(`<rect x="${column + margin}" y="${row + margin}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${Number(size)}" height="${Number(size)}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="${escapeXml(light)}"/><g fill="${escapeXml(dark)}">${rectangles.join("")}</g></svg>`;
}

export function qrDataUrl(text, options = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(text, options))}`;
}
