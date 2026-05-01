interface ChunkChecksum {
  index: number;
  weak: number;
  strong: string;
}

interface DiffBlock {
  offset: number;
  data: Buffer;
}

function rollingChecksum(data: Buffer): number {
  let s1 = 0, s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return (s1 << 16) | s2;
}

function strongChecksum(data: Buffer): string {
  const crypto = require('node:crypto');
  return crypto.createHash('md5').update(data).digest('hex');
}

export {
  rollingChecksum,
  strongChecksum,
  type ChunkChecksum,
  type DiffBlock
};
