/**
 * 纯原生、零外部依赖的高性能音频内嵌封面提取器
 * 支持 MP3 (ID3v2 APIC), FLAC (METADATA_BLOCK_PICTURE), M4A/MP4 (covr)
 */

export interface ExtractedCover {
  data: Uint8Array;
  mime: string;
}

export function extractAudioCover(buffer: ArrayBuffer | Uint8Array): ExtractedCover | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  try {
    // 1. FLAC 封面探测
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return extractFlacCover(bytes);
    }

    // 2. ID3v2 (MP3 / WAV 带 ID3v2 标签) 封面探测
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return extractId3v2Cover(bytes);
    }

    // 3. M4A / MP4 (AAC / ALAC) 封面探测
    return extractMp4Cover(bytes);
  } catch (e) {
    console.warn("[AudioCover] Extract error:", e);
    return null;
  }
}

function extractFlacCover(bytes: Uint8Array): ExtractedCover | null {
  let offset = 4; // 跳过 "fLaC"
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 4 < bytes.length) {
    const header = bytes[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;

    if (blockType === 6) {
      // METADATA_BLOCK_PICTURE (封面图片块)
      if (offset + length > bytes.length) return null;
      let picOffset = offset;
      // 跳过 picture type (4 bytes)
      picOffset += 4;
      const mimeLen = view.getUint32(picOffset);
      picOffset += 4;
      const mime = new TextDecoder().decode(bytes.subarray(picOffset, picOffset + mimeLen));
      picOffset += mimeLen;
      const descLen = view.getUint32(picOffset);
      picOffset += 4 + descLen;
      // 跳过 width(4), height(4), depth(4), colors(4)
      picOffset += 16;
      const dataLen = view.getUint32(picOffset);
      picOffset += 4;

      if (picOffset + dataLen <= bytes.length) {
        return {
          data: bytes.subarray(picOffset, picOffset + dataLen),
          mime: mime || "image/jpeg",
        };
      }
      return null;
    }

    offset += length;
    if (isLast) break;
  }

  return null;
}

function extractId3v2Cover(bytes: Uint8Array): ExtractedCover | null {
  const version = bytes[3];
  if (version !== 2 && version !== 3 && version !== 4) return null;

  // 计算 ID3v2 tag 尺寸 (Syncsafe integer)
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  let offset = 10;
  const maxOffset = Math.min(bytes.length, 10 + tagSize);

  while (offset + 10 < maxOffset) {
    let frameId = "";
    let frameSize = 0;

    if (version === 2) {
      // ID3v2.2 使用 3 字符 Frame ID
      frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
      frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
      offset += 6;
      if (frameId === "PIC") {
        return parseId3v22Pic(bytes.subarray(offset, offset + frameSize));
      }
    } else {
      // ID3v2.3 / ID3v2.4 使用 4 字符 Frame ID
      frameId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      if (version === 4) {
        frameSize =
          ((bytes[offset + 4] & 0x7f) << 21) |
          ((bytes[offset + 5] & 0x7f) << 14) |
          ((bytes[offset + 6] & 0x7f) << 7) |
          (bytes[offset + 7] & 0x7f);
      } else {
        frameSize =
          (bytes[offset + 4] << 24) |
          (bytes[offset + 5] << 16) |
          (bytes[offset + 6] << 8) |
          bytes[offset + 7];
      }
      offset += 10; // 跳过 Header 与 Flags
      if (frameId === "APIC") {
        return parseId3v23Apic(bytes.subarray(offset, offset + frameSize));
      }
    }

    if (frameSize <= 0) break;
    offset += frameSize;
  }

  return null;
}

function parseId3v23Apic(frameData: Uint8Array): ExtractedCover | null {
  if (frameData.length < 10) return null;
  const encoding = frameData[0];
  let ptr = 1;

  // 提取 MIME 类型字符串 (以 \0 结尾)
  let mimeEnd = ptr;
  while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) {
    mimeEnd++;
  }
  const mime = new TextDecoder().decode(frameData.subarray(ptr, mimeEnd)) || "image/jpeg";
  ptr = mimeEnd + 1;

  // 跳过 picture type (1 byte)
  ptr += 1;

  // 跳过描述文本 (根据编码寻找结束符)
  if (encoding === 0 || encoding === 3) {
    // ISO-8859-1 或 UTF-8 (以单 0 结束)
    while (ptr < frameData.length && frameData[ptr] !== 0) ptr++;
    ptr += 1;
  } else {
    // UTF-16 (以双 0 结束)
    while (ptr + 1 < frameData.length && !(frameData[ptr] === 0 && frameData[ptr + 1] === 0)) {
      ptr += 2;
    }
    ptr += 2;
  }

  if (ptr < frameData.length) {
    return {
      data: frameData.subarray(ptr),
      mime: mime.includes("/") ? mime : `image/${mime.toLowerCase()}`,
    };
  }

  return null;
}

function parseId3v22Pic(frameData: Uint8Array): ExtractedCover | null {
  if (frameData.length < 6) return null;
  const format = String.fromCharCode(frameData[1], frameData[2], frameData[3]).toLowerCase();
  const mime = format === "png" ? "image/png" : "image/jpeg";
  let ptr = 5;
  while (ptr < frameData.length && frameData[ptr] !== 0) ptr++;
  ptr += 1;
  if (ptr < frameData.length) {
    return { data: frameData.subarray(ptr), mime };
  }
  return null;
}

function extractMp4Cover(bytes: Uint8Array): ExtractedCover | null {
  // 查找 "covr" atom
  const len = Math.min(bytes.length, 500000);
  for (let i = 0; i < len - 8; i++) {
    if (
      bytes[i] === 0x63 &&
      bytes[i + 1] === 0x6f &&
      bytes[i + 2] === 0x76 &&
      bytes[i + 3] === 0x72
    ) {
      // 找到 covr，其后通常跟着 data atom (大小4, "data" 4, flags 4, reserved 4)
      const dataIdx = i + 4;
      if (
        dataIdx + 16 < bytes.length &&
        bytes[dataIdx + 4] === 0x64 &&
        bytes[dataIdx + 5] === 0x61 &&
        bytes[dataIdx + 6] === 0x74 &&
        bytes[dataIdx + 7] === 0x61
      ) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const dataBoxSize = view.getUint32(dataIdx);
        const typeFlag = view.getUint32(dataIdx + 8);
        const mime = (typeFlag & 0xff) === 14 ? "image/png" : "image/jpeg";
        const imgStart = dataIdx + 16;
        const imgEnd = dataIdx + dataBoxSize;
        if (imgEnd <= bytes.length) {
          return { data: bytes.subarray(imgStart, imgEnd), mime };
        }
      }
    }
  }
  return null;
}
