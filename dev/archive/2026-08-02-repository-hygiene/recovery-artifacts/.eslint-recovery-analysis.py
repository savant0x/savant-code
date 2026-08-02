import json
from collections import Counter

d = json.load(open(".eslint-recovery.json", encoding="utf-8"))
msgs = [
    (f["filePath"].replace("C:/Users/spenc/dev/savant-code/", ""), m)
    for f in d
    for m in f["messages"]
]
print("TOTAL:", len(msgs))
for p, m in sorted(msgs, key=lambda x: (x[0], x[1]["line"])):
    print(f"{p}:{m['line']}  [{m['severity']}] {m['ruleId']}  {m['message'][:80]}")
