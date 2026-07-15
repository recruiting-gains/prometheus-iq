const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/uy;

export function parseStrictJson(text, { maximumDepth = 32 } = {}) {
  if (typeof text !== "string") throw new Error("strict_json_invalid");
  let index = 0;

  const fail = () => {
    throw new Error("strict_json_invalid");
  };
  const skipWhitespace = () => {
    while (/[\t\n\r ]/u.test(text[index] || "")) index += 1;
  };
  const parseString = () => {
    if (text[index] !== '"') fail();
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      if (!escaped && character === '"') {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          fail();
        }
      }
      if (!escaped && character.charCodeAt(0) < 0x20) fail();
      if (!escaped && character === "\\") escaped = true;
      else escaped = false;
      index += 1;
    }
    fail();
  };
  const parseLiteral = (literal, value) => {
    if (text.slice(index, index + literal.length) !== literal) fail();
    index += literal.length;
    return value;
  };
  const parseNumber = () => {
    NUMBER_PATTERN.lastIndex = index;
    const match = NUMBER_PATTERN.exec(text);
    if (!match) fail();
    index = NUMBER_PATTERN.lastIndex;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail();
    return value;
  };
  const parseValue = depth => {
    if (depth > maximumDepth) fail();
    skipWhitespace();
    const character = text[index];
    if (character === '"') return parseString();
    if (character === "{") return parseObject(depth + 1);
    if (character === "[") return parseArray(depth + 1);
    if (character === "t") return parseLiteral("true", true);
    if (character === "f") return parseLiteral("false", false);
    if (character === "n") return parseLiteral("null", null);
    return parseNumber();
  };
  const parseObject = depth => {
    const value = Object.create(null);
    const keys = new Set();
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return value;
    }
    while (index < text.length) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) fail();
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") fail();
      index += 1;
      value[key] = parseValue(depth);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return value;
      }
      if (text[index] !== ",") fail();
      index += 1;
    }
    fail();
  };
  const parseArray = depth => {
    const value = [];
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return value;
    }
    while (index < text.length) {
      value.push(parseValue(depth));
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return value;
      }
      if (text[index] !== ",") fail();
      index += 1;
    }
    fail();
  };

  const result = parseValue(0);
  skipWhitespace();
  if (index !== text.length) fail();
  return result;
}
