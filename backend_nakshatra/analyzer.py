import sys
import re

def is_meaningful(text):
    if not text or len(text.strip()) < 2:
        return False
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if not words:
        # Check if it contains alphanumeric address (e.g. "Flat 101, Road 2")
        alphanumeric = re.findall(r"[a-zA-Z0-9]+", text.lower())
        return len(alphanumeric) > 0

    valid_words = 0
    for w in words:
        has_vowel = bool(re.search(r"[aeiouy]", w))
        no_triple = not bool(re.search(r"(.)\1{3,}", w))
        if has_vowel and 1 <= len(w) <= 30 and no_triple:
            valid_words += 1

    ratio = valid_words / len(words)
    return ratio >= 0.5

def analyze_input(text):
    if is_meaningful(text):
        print("Good Text")
    else:
        print("Garbage Text")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_input(sys.argv[1])
    else:
        print("Garbage Text")
