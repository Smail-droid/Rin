export const ANIME_ROLE_NAMES = [
  "樱花喵",
  "星河行者",
  "雾岛铃音",
  "秋叶拾光",
  "微风旅人",
  "青空巡礼",
  "琉璃浅夏",
  "晨曦萤火",
  "雪奈酱",
  "月见夜风",
  "猫羽小町",
  "千反田之森",
  "梦之彼端",
  "风间巡游",
  "白桃苏打",
  "星屑航线",
  "云端漫步者",
  "桔梗之花",
  "浅川初雪",
  "星海微光",
];

export const PRESET_AVATAR_SEEDS = [
  "Sakura",
  "Felix",
  "Luna",
  "Milo",
  "Chloe",
  "Oliver",
  "Bella",
  "Jasper",
  "Aria",
  "Sora",
  "Hana",
  "Yuki",
];

/**
 * Generate Dicebear Lorelei anime-style avatar URL based on seed/username
 * Highly aesthetic, minimalist anime line-art portrait with soft pastel backgrounds
 */
export function getDicebearLoreleiAvatar(seed: string): string {
  const safeSeed = encodeURIComponent(seed.trim() || "RinVisitor");
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${safeSeed}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
}

export function getRandomAnimeRoleName(): string {
  const idx = Math.floor(Math.random() * ANIME_ROLE_NAMES.length);
  return ANIME_ROLE_NAMES[idx];
}
