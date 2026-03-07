#!/usr/bin/env python3
"""
Extract classic Mac OS 'snd ' resources from the Jewelbox 1.0 application.

For each 'snd ' resource this script:
- writes the raw data to ``public/sounds/snd_<id>.snd``
- when possible, decodes the embedded sound header and writes a
  16-bit PCM WAV file to ``public/sounds/snd_<id>.wav``

Only uncompressed sampled sounds (standard or extended sound headers) are
decoded to WAV. Compressed sound headers are left as raw .snd files.
"""

import os
import struct

from extract_picts import BASE_PATH, read_resource_fork, parse_resource_map, OUTPUT_PATH


def _read_be_u16(buf: bytes, offset: int) -> int:
    return struct.unpack_from(">H", buf, offset)[0]


def _read_be_u32(buf: bytes, offset: int) -> int:
    return struct.unpack_from(">I", buf, offset)[0]


def _fixed_16_16_to_int(fx: int) -> int:
    """Convert 16.16 fixed-point sample rate to an integer Hz value."""
    integer = (fx >> 16) & 0xFFFF
    frac = fx & 0xFFFF
    return int(round(integer + frac / 65536.0))


def _decode_snd_to_wav(snd_data: bytes):
    """
    Decode a classic Mac 'snd ' resource to (sample_rate, num_channels, wav_pcm_bytes),
    or return None if the resource does not contain uncompressed sampled sound.
    """
    if len(snd_data) < 8:
        return None

    pos = 0
    fmt = _read_be_u16(snd_data, pos)
    pos += 2

    if fmt == 1:
        # Format 1: header with data formats, then sound commands.
        if pos + 2 > len(snd_data):
            return None
        num_data_formats = _read_be_u16(snd_data, pos)
        pos += 2
        # Skip data format entries (id: u16, options: u32)
        skip = num_data_formats * (2 + 4)
        if pos + skip > len(snd_data):
            return None
        pos += skip
    elif fmt == 2:
        # Format 2: reference count, then sound commands.
        if pos + 2 > len(snd_data):
            return None
        _ = _read_be_u16(snd_data, pos)
        pos += 2
    else:
        return None

    # Number of sound commands
    if pos + 2 > len(snd_data):
        return None
    num_cmds = _read_be_u16(snd_data, pos)
    pos += 2

    header_offset: int | None = None

    for _ in range(num_cmds):
        if pos + 8 > len(snd_data):
            break
        cmd_word = _read_be_u16(snd_data, pos)
        pos += 2
        is_data_offset = (cmd_word & 0x8000) != 0
        cmd = cmd_word & 0x7FFF
        _param1 = _read_be_u16(snd_data, pos)
        pos += 2
        param2 = _read_be_u32(snd_data, pos)
        pos += 4

        # bufferCmd (81) or soundCmd (80) with dataOffsetFlag set
        if is_data_offset and cmd in (80, 81) and header_offset is None:
            header_offset = param2

    if header_offset is None or header_offset + 22 > len(snd_data):
        return None

    # Parse sound header at header_offset.
    hpos = header_offset
    sample_ptr = _read_be_u32(snd_data, hpos)

    # The encode (header type) byte is at offset +20 from start of header.
    header_type = snd_data[hpos + 20]

    if header_type == 0x00:  # standard (SampledSoundHeader)
        if hpos + 22 > len(snd_data):
            return None
        num_samples = _read_be_u32(snd_data, hpos + 4)
        sample_rate_fixed = _read_be_u32(snd_data, hpos + 8)
        # loopStart, loopEnd currently ignored
        sample_rate = _fixed_16_16_to_int(sample_rate_fixed)
        num_channels = 1
        bits_per_sample = 8
        data_offset = hpos + 22
        data_bytes = num_samples
    elif header_type == 0xFF:  # extended header
        if hpos + 64 > len(snd_data):
            return None
        num_channels = _read_be_u32(snd_data, hpos + 4)
        sample_rate_fixed = _read_be_u32(snd_data, hpos + 8)
        sample_rate = _fixed_16_16_to_int(sample_rate_fixed)
        # Extended/Compressed block starts at offset 22 and is 42 bytes for extended.
        num_frames = _read_be_u32(snd_data, hpos + 22)
        bits_per_sample = _read_be_u16(snd_data, hpos + 22 + 4 + 10 + 4 + 8)
        data_offset = hpos + 64
        data_bytes = (num_frames * num_channels * bits_per_sample) // 8
    else:
        # Compressed or unknown header type.
        return None

    if sample_ptr != 0:
        # Sample data lives elsewhere; the current script only supports inline samples.
        return None

    if data_offset + data_bytes > len(snd_data):
        return None

    raw_samples = snd_data[data_offset : data_offset + data_bytes]

    # Convert to 16-bit little-endian PCM.
    pcm = bytearray()
    if bits_per_sample == 8:
        # Classic Mac 8-bit samples are unsigned; convert to signed 16-bit.
        for b in raw_samples:
            val = (b - 128) * 256
            if val < -32768:
                val = -32768
            elif val > 32767:
                val = 32767
            pcm.extend(struct.pack("<h", val))
    elif bits_per_sample == 16:
        # Big-endian 16-bit PCM to little-endian.
        if len(raw_samples) % 2 != 0:
            raw_samples = raw_samples[:-1]
        for i in range(0, len(raw_samples), 2):
            sample_be = struct.unpack_from(">h", raw_samples, i)[0]
            pcm.extend(struct.pack("<h", sample_be))
    else:
        # Other sample sizes not handled.
        return None

    return sample_rate, num_channels, bytes(pcm)


def main() -> None:
    # Source application
    app_path = os.path.join(BASE_PATH, "Jewelbox 1.0")

    # Output directory for sounds (e.g. ./public/sounds)
    sounds_dir = os.path.join(OUTPUT_PATH, "sounds")
    os.makedirs(sounds_dir, exist_ok=True)

    data = read_resource_fork(app_path)
    resources = parse_resource_map(data)

    if "snd " not in resources:
        print("No 'snd ' resources found!")
        return

    snd_resources = resources["snd "]
    print(f"Found snd resources: {sorted(snd_resources.keys())}")

    for snd_id in sorted(snd_resources.keys()):
        snd_data = snd_resources[snd_id]

        # Basic sanity check on header: classic 'snd ' format word and count word.
        if len(snd_data) >= 4:
            fmt, count = struct.unpack(">HH", snd_data[:4])
            fmt_str = f"format={fmt}, count={count}"
        else:
            fmt_str = "too short to contain header"

        raw_name = f"snd_{snd_id}.snd"
        raw_path = os.path.join(sounds_dir, raw_name)

        # Try to decode to WAV.
        wav_info = _decode_snd_to_wav(snd_data)
        if wav_info is None:
            continue

        sample_rate, num_channels, pcm = wav_info

        # Build a minimal PCM WAV header (16-bit, little-endian).
        bits_per_sample = 16
        byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
        block_align = num_channels * (bits_per_sample // 8)
        data_size = len(pcm)
        riff_size = 36 + data_size

        wav = bytearray()
        wav.extend(b"RIFF")
        wav.extend(struct.pack("<I", riff_size))
        wav.extend(b"WAVE")
        wav.extend(b"fmt ")
        wav.extend(struct.pack("<I", 16))  # fmt chunk size
        wav.extend(struct.pack("<H", 1))  # PCM
        wav.extend(struct.pack("<H", num_channels))
        wav.extend(struct.pack("<I", sample_rate))
        wav.extend(struct.pack("<I", byte_rate))
        wav.extend(struct.pack("<H", block_align))
        wav.extend(struct.pack("<H", bits_per_sample))
        wav.extend(b"data")
        wav.extend(struct.pack("<I", data_size))
        wav.extend(pcm)

        wav_name = f"snd_{snd_id}.wav"
        wav_path = os.path.join(sounds_dir, wav_name)
        with open(wav_path, "wb") as f:
            f.write(wav)

        print(f"  -> Decoded to {wav_name} ({sample_rate} Hz, {num_channels} ch)")


if __name__ == "__main__":
    main()

