function field(id, value) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeTarget(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return { tag: "01", value: `0066${digits.slice(1)}` };
  }
  if (digits.length === 13) return { tag: "02", value: digits };
  throw new Error("INVALID_PROMPTPAY_ID");
}

export function generatePromptPayPayload(promptPayId, amount) {
  const target = normalizeTarget(promptPayId);
  const merchantAccount = field("00", "A000000677010111") + field(target.tag, target.value);
  let payload = "";
  payload += field("00", "01");
  payload += field("01", "12");
  payload += field("29", merchantAccount);
  payload += field("53", "764");
  payload += field("54", Number(amount || 0).toFixed(2));
  payload += field("58", "TH");
  payload += "6304";
  return payload + crc16(payload);
}
