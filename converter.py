"""Converte planilha.csv em obras.json.

Colunas esperadas (cabeçalho na 1ª linha, CSV em UTF-8):
titulo, autor, ano, tema, subtema, tipo, idioma, tags, link, destaque

- ano: número (use negativo para a.C., ex.: -375). Pode ficar vazio.
- tags: separadas por ponto e vírgula (ex.: justiça;dialética)
- destaque: "sim" para aparecer em destaque

Uso:  python converter.py
Dica: no Excel/Google Planilhas, "Salvar como" > CSV.
"""
import csv
import json

ENTRADA = "planilha.csv"
SAIDA = "obras.json"

obras = []
with open(ENTRADA, encoding="utf-8-sig", newline="") as f:
    for linha in csv.DictReader(f):
        titulo = (linha.get("titulo") or "").strip()
        if not titulo:
            continue
        ano = (linha.get("ano") or "").strip()
        obra = {
            "titulo": titulo,
            "autor": (linha.get("autor") or "").strip(),
            "ano": int(ano) if ano.lstrip("-").isdigit() else None,
            "tema": (linha.get("tema") or "").strip(),
            "subtema": (linha.get("subtema") or "").strip(),
            "tipo": (linha.get("tipo") or "").strip(),
            "idioma": (linha.get("idioma") or "").strip(),
            "tags": [t.strip() for t in (linha.get("tags") or "").split(";") if t.strip()],
            "link": (linha.get("link") or "").strip(),
            "destaque": (linha.get("destaque") or "").strip().lower() in ("sim", "s", "1", "true"),
        }
        obras.append(obra)

with open(SAIDA, "w", encoding="utf-8") as f:
    json.dump(obras, f, ensure_ascii=False, indent=2)

print(f"{len(obras)} obras gravadas em {SAIDA}")
