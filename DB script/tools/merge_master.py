import re
m = open("master_data.sql", encoding="utf-8").read()
# tach thanh cac khoi cach nhau boi dong trong
blocks = [b for b in re.split(r"\n\s*\n", m.strip()) if b.strip()]
head   = [b for b in blocks if not b.lstrip().startswith(("INSERT", "SELECT setval", "--   Điều", "-- Chế độ"))]
def kind(b):
    mm = re.search(r"INSERT INTO (\w+)", b)
    return mm.group(1) if mm else ("setval" if "setval" in b else "?")
# bonus_rules tham chieu vehicle_groups -> phai nam sau. setval nam cuoi.
ORDER = ["accounts", "profiles", "vehicle_groups", "vehicles", "drivers", "bonus_rules"]
ins = [b for b in blocks if b.lstrip().startswith("INSERT") or "-- Chế độ thưởng" in b]
setv = [b for b in blocks if "setval" in b]
rest = [b for b in blocks if b not in ins and b not in setv]
ins.sort(key=lambda b: ORDER.index(kind(b)) if kind(b) in ORDER else 99)
out = "\n\n".join(rest + ins + setv) + "\n"
open("master_ordered.sql", "w", encoding="utf-8").write(out)

sch = open("e:/SEP490_G62/SU26_SEP490_G62/DB script/DB script.sql", encoding="utf-8").read()
marker = "-- ══ DỮ LIỆU CỐ ĐỊNH"
if marker in sch:
    sch = sch[:sch.index(marker)].rstrip() + "\n"
open("schema_new.sql", "w", encoding="utf-8").write(sch.rstrip() + "\n\n" + out)
print("thu tu khoi master:", [kind(b) for b in ins])
