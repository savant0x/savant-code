#!/usr/bin/env python3
import re
import sys
import textwrap
from pathlib import Path

MAX = 120
DIAG = re.compile(r'^(.*\.md):(\d+):\d+ error MD013')


def wrap_line(line: str, prefix: str = '') -> list[str]:
    body = line[len(prefix):].rstrip('\n')
    width = max(20, MAX - len(prefix))
    chunks = textwrap.wrap(
        body,
        width=width,
        break_long_words=False,
        break_on_hyphens=False,
        replace_whitespace=False,
        drop_whitespace=True,
    )
    if not chunks:
        return [line.rstrip('\n')]
    continuation = ' ' * len(prefix)
    return [prefix + chunks[0]] + [continuation + chunk.lstrip() for chunk in chunks[1:]]


def list_prefix(line: str) -> str:
    match = re.match(r'^(\s*(?:[-*+]\s+|\d+[.)]\s+))', line)
    return match.group(1) if match else ''


def blockquote_prefix(line: str) -> str:
    match = re.match(r'^(\s*>\s?)', line)
    return match.group(1) if match else ''


def is_fence(line: str) -> bool:
    return re.match(r'^\s*(```|~~~)', line) is not None


def is_heading(line: str) -> bool:
    return re.match(r'^\s*#{1,6}\s+', line) is not None


def is_table_row(lines: list[str], index: int) -> bool:
    line = lines[index].strip()
    if not line.startswith('|') or '|' not in line[1:]:
        return False
    if re.fullmatch(r'\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?', line):
        return True
    previous = lines[index - 1].strip() if index else ''
    following = lines[index + 1].strip() if index + 1 < len(lines) else ''
    return previous.startswith('|') or following.startswith('|')


def process(path: Path, target_lines: set[int]) -> int:
    lines = path.read_text(encoding='utf-8').splitlines()
    output: list[str] = []
    in_fence = False
    changed = False
    for number, line in enumerate(lines, 1):
        if is_fence(line):
            in_fence = not in_fence
            output.append(line)
            continue
        if number not in target_lines or in_fence or len(line) <= MAX:
            output.append(line)
            continue
        # Avoid constructs whose line wrapping changes the document AST. This
        # one-off helper does not parse inline code or URL tokens; it only wraps
        # diagnostic lines at whitespace and leaves headings, tables, and fences.
        if is_heading(line) or is_table_row(lines, number - 1):
            output.append(line)
            continue
        stripped = line.lstrip()
        if stripped.startswith('>'):
            prefix = blockquote_prefix(line)
        elif re.match(r'^(?:[-*+]\s+|\d+[.)]\s+)', stripped):
            prefix = list_prefix(line)
        else:
            prefix = ''
        wrapped = wrap_line(line, prefix)
        output.extend(wrapped)
        changed = True
    if changed:
        path.write_text('\n'.join(output) + ('\n' if lines else ''), encoding='utf-8')
    return int(changed)


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == '-':
        diagnostics = sys.stdin.read()
    else:
        source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.mdlint-current.txt')
        diagnostics = source.read_text(encoding='utf-8', errors='replace')
    grouped: dict[Path, set[int]] = {}
    for raw in diagnostics.splitlines():
        match = DIAG.match(raw)
        if match:
            grouped.setdefault(Path(match.group(1)), set()).add(int(match.group(2)))
    if not grouped:
        print('No MD013 diagnostics parsed', file=sys.stderr)
        return 1
    total = 0
    for path, line_numbers in sorted(grouped.items(), key=lambda item: str(item[0])):
        changed = process(path, line_numbers)
        total += changed
        print(f'{path}: targeted={len(line_numbers)} changed={changed}')
    print(f'changed={total} files={len(grouped)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
