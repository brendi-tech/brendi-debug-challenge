import { readFileSync } from "fs";
import { join } from "path";
import type { Menu } from "./types";

// Fornecido. Carrega o menu da loja de teste.
export function loadMenu(): Menu {
  const raw = readFileSync(join(__dirname, "..", "data", "menu.json"), "utf-8");
  return JSON.parse(raw) as Menu;
}
