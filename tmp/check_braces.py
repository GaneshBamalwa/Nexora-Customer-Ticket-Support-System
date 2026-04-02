
with open(r'g:\DBS project\nexora-integrated\client\src\index.css', 'r') as f:
    content = f.read()
    brace_count = 0
    for i, char in enumerate(content):
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
        if brace_count < 0:
            print(f"Extra closing brace at position {i}")
            # Find line number
            line = content[:i].count('\n') + 1
            print(f"Line number: {line}")
            break
    else:
        if brace_count > 0:
            print(f"Unclosed opening brace(s): {brace_count}")
        else:
            print("Braces are balanced.")
