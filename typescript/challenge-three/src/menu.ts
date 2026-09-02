// NÃO MEXER — utilitário fornecido (loader do cardápio).

import { readFileSync } from "fs";
import { join } from "path";
import type { Menu } from "./types";

export function loadMenu(): Menu {
  const raw = readFileSync(join(__dirname, "..", "data", "menu.json"), "utf-8");
  return JSON.parse(raw) as Menu;
}
