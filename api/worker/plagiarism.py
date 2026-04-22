import hashlib
import tokenize
import io
from typing import List, Set

def tokenize_python(code: str) -> List[str]:
    """Tokenize Python code, stripping variable names and comments"""
    tokens = []
    try:
        readline = io.StringIO(code).readline
        for tok in tokenize.generate_tokens(readline):
            # Keep structure, skip names/comments/whitespace
            if tok.type in (
                tokenize.NAME,      # variable names → normalize
                tokenize.COMMENT,
                tokenize.NL,
                tokenize.NEWLINE,
                tokenize.INDENT,
                tokenize.DEDENT,
                tokenize.ENCODING,
            ):
                if tok.type == tokenize.NAME:
                    # Keep keywords (if, for, while, def, class...)
                    # but normalize identifiers to "VAR"
                    keywords = {
                        'if','else','elif','for','while','def','class',
                        'return','import','from','in','not','and','or',
                        'True','False','None','try','except','with','as',
                        'pass','break','continue','raise','lambda','yield'
                    }
                    tokens.append(tok.string if tok.string in keywords else 'VAR')
            else:
                tokens.append(tok.string)
    except tokenize.TokenError:
        # Fallback: simple word tokenization
        tokens = code.split()
    return tokens

def tokenize_generic(code: str) -> List[str]:
    """Simple tokenizer for C++ and Java"""
    import re
    # Remove comments
    code = re.sub(r'//.*?\n', ' ', code)
    code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.DOTALL)
    # Remove string literals
    code = re.sub(r'".*?"', 'STR', code)
    # Normalize identifiers (words that aren't keywords)
    cpp_keywords = {
        'int','float','double','char','bool','void','string','auto',
        'if','else','for','while','do','return','class','struct',
        'public','private','protected','new','delete','include',
        'namespace','using','std','cout','cin','endl','true','false',
        'null','nullptr','static','const','main','System','out','println'
    }
    tokens = re.findall(r'[a-zA-Z_]\w*|[^\w\s]', code)
    return [t if t in cpp_keywords else 'VAR' for t in tokens]

def get_fingerprints(code: str, language: str, k: int = 5) -> Set[str]:
    """
    Winnowing algorithm:
    1. Tokenize and normalize code
    2. Create k-grams (sequences of k tokens)
    3. Hash each k-gram
    4. Return set of fingerprints
    """
    if language == "python":
        tokens = tokenize_python(code)
    else:
        tokens = tokenize_generic(code)

    if len(tokens) < k:
        # Code too short — just hash the whole thing
        return {hashlib.md5(" ".join(tokens).encode()).hexdigest()[:8]}

    # Generate k-grams
    kgrams = [" ".join(tokens[i:i+k]) for i in range(len(tokens) - k + 1)]

    # Hash each k-gram (take first 8 chars for brevity)
    hashes = [hashlib.md5(kg.encode()).hexdigest()[:8] for kg in kgrams]

    # Winnowing: use a sliding window to select minimum hashes
    # This reduces the fingerprint size while preserving similarity detection
    window_size = 4
    fingerprints = set()
    for i in range(len(hashes) - window_size + 1):
        window = hashes[i:i + window_size]
        fingerprints.add(min(window))

    return fingerprints

def similarity_score(code_a: str, code_b: str, language: str) -> float:
    """
    Returns similarity as a float between 0.0 and 1.0
    1.0 = identical structure, 0.0 = completely different
    """
    fp_a = get_fingerprints(code_a, language)
    fp_b = get_fingerprints(code_b, language)

    if not fp_a or not fp_b:
        return 0.0

    # Jaccard similarity: intersection / union
    intersection = len(fp_a & fp_b)
    union = len(fp_a | fp_b)
    return round(intersection / union, 3) if union > 0 else 0.0