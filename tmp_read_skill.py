import re
with open(r'C:\Users\spenc\AppData\Local\hermes\cache\spillover\call_cc58650fb3bc44b5a40ab9d8.txt', 'r') as f:
    raw = f.read()
matches = re.findall(r'"content":\s*"(.*?)"', raw, re.DOTALL)
if matches:
    content = matches[0]
    content = content.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"')
    lines = content.split('\n')
    print(f'Total lines: {len(lines)}')
    # Print first 200 lines
    for i, line in enumerate(lines[:200]):
        print(f'{i}: {line}')
