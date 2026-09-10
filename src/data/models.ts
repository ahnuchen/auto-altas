// 车型目录与命名适配：不同来源的 GLB 命名规范差异很大，
// 每个车型通过 groupName / partName 把场景图节点翻译成中文分组与零件名。

// 部署在 /auto-atlas/ 子路径下，模型路径必须基于 BASE_URL 拼接
const MODEL_BASE = import.meta.env.BASE_URL + "models/";

export interface ModelDef {
  id: string;
  name: string;
  /** 侧栏切换按钮用的短名 */
  short: string;
  file: string;
  /** 模型根节点在场景图路径中的段名（此段之后才是语义层级） */
  rootSegment: string;
  credit: string;
  license: string;
  link: string;
  /** 从根节点之后的路径段推导分组名 */
  groupName(rel: string[], material: string): string;
  /** 从路径段 + 材质推导零件名 */
  partName(rel: string[], material: string): string;
}

// —— 通用清理工具 ——

function clean(s: string): string {
  return s
    .replace(/^ar8:?/, "")
    .replace(/_ar8:?.*$/, "")
    .replace(/^pasted__/, "")
    .replace(/(_\d+)+$/, "")
    .replace(/\d+$/, "")
    .trim();
}

function isGarbage(s: string): boolean {
  return /^(mesh|polySurface|group|pasted|object|plane|logo)[\s_0-9.]*$/i.test(s);
}

// —— BMW E30 M3 ——

const BMW_GROUP: Record<string, string> = {
  BODY: "车身总成",
  RIM: "轮辋",
  TIRE: "轮胎",
  "Brake_disc": "制动盘",
  "Brembo_Calipers": "制动卡钳",
  "Logo_Plane": "卡钳标识",
};

const BMW_MAT: Record<string, string> = {
  PAINT: "车漆覆盖件",
  PLASTIC: "黑色塑料件",
  CHROME: "镀铬件",
  WINDOWS: "车窗玻璃",
  BLACKOUT: "黑色装饰件",
  SIDE_MIRROR: "外后视镜",
  TAILLIGHT_REFLECTOR: "尾灯反光板",
  HEADLIGHT_REFLECTOR: "前灯反光碗",
  EMBLEMS: "车标徽章",
  LENS: "灯罩玻璃",
  RIM: "轮辋",
  TIRE: "轮胎",
  "Brake_Disc": "制动盘",
  "Brembo_Calipers": "制动卡钳",
  "Logo_Plane": "卡钳标识",
};

const bmw: ModelDef = {
  id: "bmw-m3-e30",
  name: "BMW M3 (E30) 1986–1991",
  short: "BMW M3",
  file: MODEL_BASE + "free_bmw_m3_e30.glb",
  rootSegment: "GLTF_SceneRootNode",
  credit: "Martin Trafas (TinoD2)",
  license: "CC BY 4.0",
  link: "https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422",
  groupName(rel) {
    const key = clean(rel[0] ?? "").replace(/^BMW_E30_M3_/, "");
    return BMW_GROUP[key] ?? key;
  },
  partName(_rel, material) {
    const key = material.replace(/^BMW_E30_M3_/, "");
    return BMW_MAT[key] ?? key;
  },
};

// —— Tesla Model 3 ——

const TESLA_GROUP: Record<string, string> = {
  chassis: "车身与底盘",
  door_lf: "左前车门",
  door_rf: "右前车门",
  door_lr: "左后车门",
  door_rr: "右后车门",
  bump_front: "前保险杠",
  bump_rear: "后保险杠",
  boot: "后备箱",
  steering: "转向系统",
  dvornik: "雨刮系统",
  wheel_rf: "右前车轮",
  wheel_lf: "左前车轮",
  wheel_rb: "右后车轮",
  wheel_lb: "左后车轮",
  hub_rf: "右前轮毂",
  hub_lf: "左前轮毂",
  hub_rb: "右后轮毂",
  hub_lb: "左后轮毂",
};

const TESLA_MAT: Record<string, string> = {
  primary: "车漆件",
  chassis: "车身结构件",
  putih: "白色内饰件",
  whiteleather: "白色皮革",
  "seat leather white": "白色真皮座椅",
  plastic: "塑料件",
  "just black": "黑色塑料件",
  "black lights": "灯组黑色饰件",
  glass: "玻璃",
  carpet: "地毯",
  "carpet light": "地垫灯",
  lcds: "中控屏",
  "texture buttons": "按键面板",
  "texture leather": "皮革饰件",
  movsteer: "方向盘组件",
  dvorright: "雨刮",
  suspensi: "悬架",
  wheels: "轮胎总成",
  hub: "轮毂",
  "tembus red": "红色透光件",
  platnomor: "车牌",
  belt: "安全带",
  "satin red": "红色饰件",
  hitam: "黑色件",
  aluminium: "铝饰件",
  chrome: "镀铬件",
  cahrome: "镀铬件",
  "mirror inside": "车内后视镜",
  "back chrome light": "尾部镀铬灯饰",
  pantulans: "反光片",
  frunkplastic: "前备箱塑料件",
  "front black": "前部黑色件",
  "paint black": "黑色漆面",
  black: "黑色件",
  bodysills: "侧裙",
  "light night": "氛围灯",
};

function teslaMaterialCN(material: string): string | null {
  const base = material.toLowerCase().split(".")[0].replace(/[\s_]+/g, " ").trim();
  if (TESLA_MAT[base]) return TESLA_MAT[base];
  // 前缀匹配：hub_rb -> hub、chrome1 -> chrome、movsteer_1 -> movsteer
  const keys = Object.keys(TESLA_MAT).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (base.startsWith(k)) return TESLA_MAT[k];
  }
  return null;
}

const tesla: ModelDef = {
  id: "tesla-model-3",
  name: "Tesla Model 3 2018",
  short: "Model 3",
  file: MODEL_BASE + "tesla_2018_model_3.glb",
  rootSegment: "Tesla Model 3",
  credit: "Ameer Studio (uchiha.321abc)",
  license: "CC BY 4.0",
  link: "https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f",
  groupName(rel) {
    // 找最深的 *_dummy 组件节点（车门/车轮/保险杠等）
    for (let i = rel.length - 2; i >= 0; i--) {
      const seg = rel[i];
      if (seg.endsWith("_dummy")) {
        const key = clean(seg).replace(/_dummy$/, "");
        return TESLA_GROUP[key] ?? key;
      }
    }
    const parent = clean(rel[rel.length - 2] ?? rel[0] ?? "");
    return TESLA_GROUP[parent] ?? parent;
  },
  partName(rel, material) {
    const groupRaw = (() => {
      for (let i = rel.length - 2; i >= 0; i--) {
        if (rel[i].endsWith("_dummy")) return clean(rel[i]);
      }
      return clean(rel[rel.length - 2] ?? "");
    })();
    const leaf = clean(rel[rel.length - 1] ?? "").replace(groupRaw, "").replace(/^[_\-.]+/, "");
    const matCN = teslaMaterialCN(material);
    if (matCN) return matCN;
    return leaf && !isGarbage(leaf) ? leaf : material.split(".")[0];
  },
};

// —— Chery Arrizo 8 290T（命名规范：部件_材质_序号，拼音+英文混合）——

const ARZ_GROUP: [RegExp, string][] = [
  [/^lf_door/, "左前车门"],
  [/^rf_door/, "右前车门"],
  [/^lr_door/, "左后车门"],
  [/^rr_door/, "右后车门"],
  [/^car_body_top_glass/, "前挡风玻璃"],
  [/^car_body_glass/, "车窗玻璃"],
  [/^car_body_top/, "车顶"],
  [/^car_body/, "车身"],
  [/^trunk/, "后备箱"],
  [/^houbeixiang/, "后备箱"],
  [/^houbaowei/, "后包围"],
  [/^qianzhongwang/, "前中网"],
  [/^qianlian/, "前脸"],
  [/^qiandadeng/, "前大灯"],
  [/^weideng/, "尾灯"],
  [/^hub/, "车轮与制动"],
  [/^neishi/, "内饰"],
  [/^seat/, "座椅"],
  [/^mirror/, "后视镜"],
  [/^cebiao/, "侧标"],
  [/^cheshen_di/, "车身底盘"],
];

// 整键特例（避免逐词拼接后不顺）
const ARZ_KEY: Record<string, string> = {
  "car_body_top_glass": "前挡风玻璃",
  "car_body_top": "车顶",
  "car_body_glass_windows": "车窗玻璃",
  "trunk_shengjianggan": "后备箱玻璃升降器",
  "neishi_white_zi": "内饰白色字标",
  "trunk_metal_logo": "后备箱金属徽标",
  "rf_door_shitiao_map_c": "右前车门饰条",
  "qianzhongwang_bianse": "前中网装饰条",
  "qianzhongwang_metal_black_metal": "前中网黑色金属件",
  "qianlian_yaguang_metal": "前脸亚光金属件",
  "car_body_yanguang_metal": "车身亚光金属件",
};

const ARZ_TOKEN: Record<string, string> = {
  lf: "左前", rf: "右前", lr: "左后", rr: "右后", door: "车门",
  "car_body": "车身", top: "车顶", glass: "玻璃", windows: "车窗",
  hub: "轮毂", tire: "轮胎", "brake_disc": "制动盘", breaks: "制动盘",
  trunk: "后备箱", houbeixiang: "后备箱", houbaowei: "后包围",
  qianzhongwang: "前中网", qianlian: "前脸", qiandadeng: "前大灯", weideng: "尾灯",
  neishi: "内饰", tietu: "饰板", seat: "座椅", mirror: "后视镜", daochejing: "后视镜",
  cebiao: "侧标", cheshen_di: "车身底盘", cheqi: "车漆", "black_plastic": "黑色塑料",
  plastic: "塑料", metal: "金属", "black_metal": "黑色金属", "metal_r": "黑色金属",
  red: "红色", white: "白色", map: "贴图", shitiao: "饰条", bianse: "装饰条",
  shengjianggan: "玻璃升降器", yaguang: "亚光", logo: "徽标", zi: "字标",
  fanguangban: "反光板", c: "",
};

function arrizoKey(raw: string, material: string): string {
  const esc = material.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return raw
    .replace(new RegExp("_" + esc + "_\\d+$"), "")
    .replace(/(_\d+)+$/, "")
    .replace(/_[A-D]$/, "")
    .replace(/\d+$/, "");
}

function arrizoCN(key: string): string {
  if (ARZ_KEY[key]) return ARZ_KEY[key];
  // 贪心匹配：优先尝试 3 词、2 词、1 词的复合 token（car_body / black_plastic 等）
  const words = key.toLowerCase().split("_");
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let matched: string | undefined;
    let len = 1;
    for (const n of [3, 2, 1]) {
      const t = words.slice(i, i + n).join("_");
      if (ARZ_TOKEN[t] !== undefined) {
        matched = ARZ_TOKEN[t];
        len = n;
        break;
      }
    }
    if (matched) out.push(matched);
    i += len;
  }
  // 去重：连续重复词（"红色红色"）与非连续重复词（"红色塑料红色"）都只保留首次
  const joined = out.filter((w, idx) => out.indexOf(w) === idx).join("");
  return joined || key;
}

const arrizo: ModelDef = {
  id: "arrizo-8-290t",
  name: "Chery Arrizo 8 290T 2023",
  short: "艾瑞泽 8",
  file: MODEL_BASE + "2023_chery_arrizo_8_290t.glb",
  rootSegment: "RootNode",
  credit: "Sketchfab 社区作者",
  license: "以模型页标注为准",
  link: "https://sketchfab.com/",
  groupName(rel) {
    const seg = (rel[0] ?? "").toLowerCase();
    for (const [re, name] of ARZ_GROUP) {
      if (re.test(seg)) return name;
    }
    return seg.split("_")[0] || "其他部件";
  },
  partName(rel, material) {
    const raw = rel[rel.length - 1] ?? "";
    return arrizoCN(arrizoKey(raw, material));
  },
};

export const MODELS: ModelDef[] = [arrizo, bmw, tesla];
export const MODEL_BY_ID = new Map(MODELS.map((m) => [m.id, m]));
