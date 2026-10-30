"""从源仓库 backend/app/core 读取科目分组、比率定义与核心科目（只读），写入 src/mock/backendMeta.json。

用法：python3 -I scripts/extract_backend_meta.py [源仓库路径]
默认源仓库路径取环境变量 FA_SOURCE_DIR，缺省 ~/Project/Web_Financial_Analyse。
"""
import ast
import json
import os
import sys
from pathlib import Path

src_root = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
    "FA_SOURCE_DIR", os.path.expanduser("~/Project/Web_Financial_Analyse")))
here = Path(__file__).resolve().parent.parent


def literals(path: Path, names: set[str]) -> dict:
    out = {}
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        target = None
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            target = node.target.id
        elif isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            target = node.targets[0].id
        if target in names:
            out[target] = ast.literal_eval(node.value)
    return out


meta = literals(src_root / "backend/app/core/constants.py", {
    "BALANCE_SHEET_GROUPS", "INCOME_STATEMENT_GROUPS", "CASH_FLOW_GROUPS",
    "RATIO_DEFINITIONS", "COA_VERSION"})
meta.update(literals(src_root / "backend/app/core/subject_aliases.py", {"CORE_FIELDS"}))
dest = here / "src/mock/backendMeta.json"
dest.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", dest, sorted(meta))
